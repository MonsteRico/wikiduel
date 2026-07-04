import wikiModule from "wikipedia";

export type WikipediaPageSnapshot = Readonly<{
  pageId: number;
  namespace: number;
  title: string;
  revisionId: number;
  revisionTimestamp: string;
  html: string;
  disambiguation: boolean;
}>;

export interface WikipediaGateway {
  fetchPage(title: string): Promise<WikipediaPageSnapshot>;
}

export type GatewayFailureKind = "not-found" | "rate-limited" | "unavailable" | "invalid-response";

export class WikipediaGatewayError extends Error {
  constructor(
    public readonly kind: GatewayFailureKind,
    public readonly retryAfterSeconds?: number,
    options?: ErrorOptions,
  ) {
    super(`Wikipedia gateway failed: ${kind}`, options);
  }
}

type GatewayDependencies = Readonly<{
  userAgent: string;
  request?: typeof fetch;
}>;

// wikipedia 2.5.0 publishes its callable client under the default property of
// the value Node exposes for its CommonJS/ESM bridge. Keep this one package quirk
// here; the rest of Wiki Duel only sees the WikipediaGateway contract.
const wiki = wikiModule.default;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function retryAfter(response: Response): number | undefined {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function packageError(error: unknown): WikipediaGatewayError {
  const record = asRecord(error);
  const message = error instanceof Error ? error.message : String(error);
  if (/No page with given title exists/i.test(message)) {
    return new WikipediaGatewayError("not-found", undefined, { cause: error });
  }
  const response = asRecord(record?.response) ?? asRecord(asRecord(record?.cause)?.response);
  const status = response?.status;
  if (status === 404) return new WikipediaGatewayError("not-found", undefined, { cause: error });
  if (status === 429) return new WikipediaGatewayError("rate-limited", undefined, { cause: error });
  return new WikipediaGatewayError("unavailable", undefined, { cause: error });
}

export function createWikipediaGateway(dependencies: GatewayDependencies): WikipediaGateway {
  const request = dependencies.request ?? fetch;
  wiki.setUserAgent(dependencies.userAgent);

  return {
    async fetchPage(title) {
      let packagePage: Awaited<ReturnType<typeof wiki.page>>;
      let html: string;
      try {
        // The package follows redirects before returning this page. Its identity
        // is therefore canonical even when title was an alias.
        packagePage = await wiki.page(title, { redirect: true });
        html = await packagePage.html({ redirect: true });
      } catch (error) {
        throw packageError(error);
      }

      if (
        !positiveInteger(packagePage.pageid)
        || !Number.isInteger(packagePage.ns)
        || !packagePage.title.trim()
        || typeof html !== "string"
      ) {
        throw new WikipediaGatewayError("invalid-response");
      }

      // The package gives us canonical identity and HTML, but not the exact
      // revision timestamp and disambiguation marker required by our contract.
      // Enrich that same canonical page ID with one narrow official API call.
      const url = new URL("https://en.wikipedia.org/w/api.php");
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        pageids: String(packagePage.pageid),
        prop: "revisions|pageprops",
        rvprop: "ids|timestamp",
      }).toString();

      let response: Response;
      try {
        response = await request(url, {
          headers: {
            "Api-User-Agent": dependencies.userAgent,
            "User-Agent": dependencies.userAgent,
          },
        });
      } catch (error) {
        throw new WikipediaGatewayError("unavailable", undefined, { cause: error });
      }
      if (response.status === 404) throw new WikipediaGatewayError("not-found");
      if (response.status === 429) throw new WikipediaGatewayError("rate-limited", retryAfter(response));
      if (!response.ok) throw new WikipediaGatewayError("unavailable");

      const body = asRecord(await response.json());
      const query = asRecord(body?.query);
      const pages = asRecord(query?.pages);
      const page = pages ? Object.values(pages).map(asRecord).find(Boolean) : undefined;
      const revisions = Array.isArray(page?.revisions) ? page.revisions : [];
      const revision = asRecord(revisions[0]);
      const revisionId = positiveInteger(revision?.revid);
      const revisionTimestamp = revision?.timestamp;
      if (
        positiveInteger(page?.pageid) !== packagePage.pageid
        || page?.title !== packagePage.title
        || page?.ns !== packagePage.ns
        || !revisionId
        || typeof revisionTimestamp !== "string"
        || !Number.isFinite(Date.parse(revisionTimestamp))
      ) {
        throw new WikipediaGatewayError("invalid-response");
      }

      return {
        pageId: packagePage.pageid,
        namespace: packagePage.ns,
        title: packagePage.title,
        revisionId,
        revisionTimestamp,
        html,
        disambiguation: Object.hasOwn(asRecord(page.pageprops) ?? {}, "disambiguation"),
      };
    },
  };
}
