import wikipedia from "wikipedia";

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

type PackagePage = Readonly<{
  pageId: number;
  namespace: number;
  title: string;
  html(): Promise<string>;
}>;

type WikipediaPackageClient = Readonly<{
  setUserAgent(userAgent: string): void;
  page(title: string, options: Readonly<{ redirect: true }>): Promise<PackagePage>;
}>;

type GatewayDependencies = Readonly<{
  userAgent: string;
  packageClient?: WikipediaPackageClient;
  request?: typeof fetch;
}>;

export function resolveWikipediaPackageClient(moduleValue: unknown): WikipediaPackageClient {
  // wikipedia's ESM export works at runtime but its package export map presents the
  // module namespace to NodeNext. Keep that mismatch contained inside the gateway.
  type RuntimeClient = {
    setUserAgent(userAgent: string): void;
    page(title: string, options: { redirect: boolean }): Promise<{
      pageid: number;
      ns: number;
      title: string;
      html(options: { redirect: boolean }): Promise<string>;
    }>;
  };
  const candidate = moduleValue as RuntimeClient & { default?: RuntimeClient };
  const client = typeof candidate.page === "function" ? candidate : candidate.default;
  if (!client || typeof client.page !== "function" || typeof client.setUserAgent !== "function") {
    throw new WikipediaGatewayError("invalid-response");
  }
  return {
    setUserAgent: (userAgent) => client.setUserAgent(userAgent),
    page: async (title, options) => {
      const page = await client.page(title, options);
      return {
        pageId: page.pageid,
        namespace: page.ns,
        title: page.title,
        html: () => page.html({ redirect: true }),
      };
    },
  };
}

function defaultPackageClient(): WikipediaPackageClient {
  return resolveWikipediaPackageClient(wikipedia);
}

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
  const packageClient = dependencies.packageClient ?? defaultPackageClient();
  const request = dependencies.request ?? fetch;
  packageClient.setUserAgent(dependencies.userAgent);

  return {
    async fetchPage(title) {
      let packagePage: PackagePage;
      let html: string;
      try {
        packagePage = await packageClient.page(title, { redirect: true });
        html = await packagePage.html();
      } catch (error) {
        throw packageError(error);
      }

      if (
        !positiveInteger(packagePage.pageId)
        || !Number.isInteger(packagePage.namespace)
        || !packagePage.title.trim()
        || typeof html !== "string"
      ) {
        throw new WikipediaGatewayError("invalid-response");
      }

      const url = new URL("https://en.wikipedia.org/w/api.php");
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        pageids: String(packagePage.pageId),
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
        positiveInteger(page?.pageid) !== packagePage.pageId
        || page?.title !== packagePage.title
        || page?.ns !== packagePage.namespace
        || !revisionId
        || typeof revisionTimestamp !== "string"
        || !Number.isFinite(Date.parse(revisionTimestamp))
      ) {
        throw new WikipediaGatewayError("invalid-response");
      }

      return {
        pageId: packagePage.pageId,
        namespace: packagePage.namespace,
        title: packagePage.title,
        revisionId,
        revisionTimestamp,
        html,
        disambiguation: Object.hasOwn(asRecord(page.pageprops) ?? {}, "disambiguation"),
      };
    },
  };
}
