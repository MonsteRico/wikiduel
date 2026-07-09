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

export type WikipediaResolvedLink = Readonly<
  | { requestedTitle: string; exists: false }
  | {
      requestedTitle: string;
      exists: true;
      pageId: number;
      namespace: number;
      title: string;
      disambiguation: boolean;
    }
>;

export type WikipediaImageMetadata = Readonly<{
  requestedTitle: string;
  sourceUrl: string;
  width: number;
  height: number;
  mimeType: string;
  descriptionUrl: string;
  creatorHtml?: string;
  creditHtml?: string;
  licenseName?: string;
  licenseUrl?: string;
  nonFree: boolean;
  restrictions: readonly string[];
}>;

export interface WikipediaGateway {
  fetchPage(title: string, options?: GatewayRequestOptions): Promise<WikipediaPageSnapshot>;
  resolveLinks(
    titles: readonly string[],
    options?: GatewayRequestOptions,
  ): Promise<readonly WikipediaResolvedLink[]>;
  fetchImageMetadata(
    titles: readonly string[],
    options?: GatewayRequestOptions,
  ): Promise<readonly WikipediaImageMetadata[]>;
}

export type GatewayRequestOptions = Readonly<{ signal?: AbortSignal }>;

export type GatewayFailureKind =
  | "not-found"
  | "rate-limited"
  | "back-pressure"
  | "transient"
  | "unavailable"
  | "invalid-response";

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

// wikipedia 2.5.0 is CommonJS despite publishing an ESM import target. Node
// exposes its callable client under a nested default, while Vite unwraps that
// bridge. Keep this one package quirk here; the rest of Wiki Duel only sees the
// WikipediaGateway contract.
type WikipediaClient = typeof wikiModule.default;
const wiki = (typeof (wikiModule as { setUserAgent?: unknown }).setUserAgent === "function"
  ? wikiModule
  : wikiModule.default) as WikipediaClient;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function parsedRetryAfter(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1_000)) : undefined;
}

function retryAfter(response: Response): number | undefined {
  return parsedRetryAfter(response.headers.get("retry-after"));
}

function packageRetryAfter(response: Record<string, unknown> | undefined): number | undefined {
  const headers = response?.headers;
  if (headers instanceof Headers) return parsedRetryAfter(headers.get("retry-after"));
  const headerRecord = asRecord(headers);
  return parsedRetryAfter(headerRecord?.["retry-after"] ?? headerRecord?.["Retry-After"]);
}

function metadataText(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  // `extmetadata` entries are objects shaped like `{ value: string }`, and the
  // useful license fields are sometimes absent or blank. Collapse that API shape
  // at the boundary so repository policy never reaches into Wikimedia internals.
  const entry = asRecord(metadata?.[key]);
  return typeof entry?.value === "string" && entry.value.trim() ? entry.value : undefined;
}

function metadataBoolean(metadata: Record<string, unknown> | undefined, key: string): boolean {
  // Wikimedia boolean-ish metadata is represented as text. Treat any present
  // value except common false spellings as true so conservative safety flags
  // such as NonFree cannot be bypassed by an unexpected truthy string.
  const value = metadataText(metadata, key)?.toLocaleLowerCase("en-US");
  return value !== undefined && !["", "0", "false", "no"].includes(value);
}

function aliasesFrom(query: Record<string, unknown>): ReadonlyMap<string, string> {
  // The action API reports normalization and redirects separately. Both mean
  // "the page data may be under a different title than the caller requested",
  // so we merge them into one alias map shared by link and image lookups.
  const aliases = new Map<string, string>();
  for (const entry of [
    ...(Array.isArray(query.normalized) ? query.normalized : []),
    ...(Array.isArray(query.redirects) ? query.redirects : []),
  ]) {
    const alias = asRecord(entry);
    if (typeof alias?.from === "string" && typeof alias.to === "string") {
      aliases.set(alias.from, alias.to);
    }
  }
  return aliases;
}

function canonicalTitle(requestedTitle: string, aliases: ReadonlyMap<string, string>): string {
  // Follow alias chains defensively because normalization can feed a redirect.
  // The visited set prevents a malformed upstream response from trapping the
  // gateway in a loop while still preserving the original requestedTitle later.
  let title = requestedTitle;
  const visited = new Set<string>();
  while (aliases.has(title) && !visited.has(title)) {
    visited.add(title);
    title = aliases.get(title)!;
  }
  return title;
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
  if (status === 429) {
    return new WikipediaGatewayError("rate-limited", packageRetryAfter(response), { cause: error });
  }
  if (status === "maxlag" || /maxlag/i.test(message)) {
    return new WikipediaGatewayError("back-pressure", undefined, { cause: error });
  }
  if (typeof status === "number" && status >= 500) {
    return new WikipediaGatewayError("transient", undefined, { cause: error });
  }
  if (
    status === undefined
    && (error instanceof TypeError || /network|fetch|socket|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(message))
  ) {
    return new WikipediaGatewayError("transient", undefined, { cause: error });
  }
  return new WikipediaGatewayError("unavailable", undefined, { cause: error });
}

function responseFailure(response: Response, notFound = false): WikipediaGatewayError | undefined {
  if (notFound && response.status === 404) return new WikipediaGatewayError("not-found");
  if (response.status === 429) {
    return new WikipediaGatewayError("rate-limited", retryAfter(response));
  }
  if (response.status >= 500) return new WikipediaGatewayError("transient");
  if (!response.ok) return new WikipediaGatewayError("unavailable");
  return undefined;
}

function throwIfBackPressure(body: Record<string, unknown> | undefined): void {
  const apiError = asRecord(body?.error);
  if (apiError?.code === "maxlag") throw new WikipediaGatewayError("back-pressure");
}

export function createWikipediaGateway(dependencies: GatewayDependencies): WikipediaGateway {
  const request = dependencies.request ?? fetch;
  wiki.setUserAgent(dependencies.userAgent);

  return {
    async fetchPage(title, options) {
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
          signal: options?.signal,
          headers: {
            "Api-User-Agent": dependencies.userAgent,
            "User-Agent": dependencies.userAgent,
          },
        });
      } catch (error) {
        throw new WikipediaGatewayError("transient", undefined, { cause: error });
      }
      const failure = responseFailure(response, true);
      if (failure) throw failure;

      const body = asRecord(await response.json());
      throwIfBackPressure(body);
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
    // Image rendering needs data the `wikipedia` package does not expose:
    // thumbnail URL, dimensions, MIME type, description page, and machine-
    // readable license/creator metadata. Keep that enrichment here so callers
    // receive one project-owned shape instead of raw action API objects.
    async fetchImageMetadata(titles, options): Promise<readonly WikipediaImageMetadata[]> {
      if (titles.length === 0) return [];
      if (titles.length > 50) {
        // `titles=` is capped at 50 pages for this anonymous/user request mode.
        // Batching here keeps the repository simple and preserves input order
        // semantics by concatenating each slice's translated results.
        const images: WikipediaImageMetadata[] = [];
        for (let start = 0; start < titles.length; start += 50) {
          images.push(...await this.fetchImageMetadata(titles.slice(start, start + 50), options));
        }
        return images;
      }

      const url = new URL("https://en.wikipedia.org/w/api.php");
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        redirects: "1",
        titles: titles.join("|"),
        prop: "imageinfo",
        iiprop: "url|size|mime|mediatype|extmetadata",
        iiurlwidth: "800",
        iiextmetadatalanguage: "en",
        iiextmetadatafilter: [
          "Artist", "Credit", "Attribution", "LicenseShortName", "LicenseUrl",
          "UsageTerms", "NonFree", "Restrictions",
        ].join("|"),
      }).toString();

      let response: Response;
      try {
        response = await request(url, {
          signal: options?.signal,
          headers: {
            "Api-User-Agent": dependencies.userAgent,
            "User-Agent": dependencies.userAgent,
          },
        });
      } catch (error) {
        throw new WikipediaGatewayError("transient", undefined, { cause: error });
      }
      const failure = responseFailure(response);
      if (failure) throw failure;

      const body = asRecord(await response.json());
      throwIfBackPressure(body);
      const query = asRecord(body?.query);
      if (!query || !Array.isArray(query.pages)) throw new WikipediaGatewayError("invalid-response");
      const aliases = aliasesFrom(query);
      const pages = query.pages.map(asRecord);
      const images: WikipediaImageMetadata[] = [];
      for (const requestedTitle of titles) {
        // Return metadata under the original requested title even when Wikimedia
        // normalizes or redirects it. The normalizer's figure map is keyed by
        // the title found in article HTML, not necessarily the canonical title.
        const title = canonicalTitle(requestedTitle, aliases);
        const page = pages.find((candidate) => candidate?.title === title);
        const info = asRecord(Array.isArray(page?.imageinfo) ? page.imageinfo[0] : undefined);
        const metadata = asRecord(info?.extmetadata);
        const width = positiveInteger(info?.thumbwidth);
        const height = positiveInteger(info?.thumbheight);
        if (
          !info || typeof info.thumburl !== "string" || !width
          || !height || typeof info.mime !== "string"
          || typeof info.descriptionurl !== "string"
        ) continue;
        // Prefer explicit Attribution over Artist when available: Wikimedia
        // files can use Attribution for the exact credit line requested by the
        // uploader, while Artist may be a looser creator field.
        const creator = metadataText(metadata, "Attribution") ?? metadataText(metadata, "Artist");
        const credit = metadataText(metadata, "Credit");
        const licenseName = metadataText(metadata, "LicenseShortName")
          ?? metadataText(metadata, "UsageTerms");
        const licenseUrl = metadataText(metadata, "LicenseUrl");
        const restrictionValue = metadataText(metadata, "Restrictions");
        images.push({
          requestedTitle,
          sourceUrl: info.thumburl,
          width,
          height,
          mimeType: info.mime,
          descriptionUrl: info.descriptionurl,
          ...(creator ? { creatorHtml: creator } : {}),
          ...(credit ? { creditHtml: credit } : {}),
          ...(licenseName ? { licenseName } : {}),
          ...(licenseUrl ? { licenseUrl } : {}),
          nonFree: metadataBoolean(metadata, "NonFree"),
          restrictions: restrictionValue
            ? restrictionValue.split("|").map((value) => value.trim()).filter(Boolean)
            : [],
        });
      }
      return images;
    },
    // wikipedia@2.5.0 exposes links as source-page title strings only. It does
    // not bulk-resolve redirects, existence, namespaces, or page properties,
    // so this missing contract uses the official query API in 50-title batches.
    async resolveLinks(titles, options): Promise<readonly WikipediaResolvedLink[]> {
      if (titles.length === 0) return [];
      if (titles.length > 50) {
        const resolved: WikipediaResolvedLink[] = [];
        for (let start = 0; start < titles.length; start += 50) {
          resolved.push(...await this.resolveLinks(titles.slice(start, start + 50), options));
        }
        return resolved;
      }

      const url = new URL("https://en.wikipedia.org/w/api.php");
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        redirects: "1",
        titles: titles.join("|"),
        prop: "pageprops",
      }).toString();

      let response: Response;
      try {
        response = await request(url, {
          signal: options?.signal,
          headers: {
            "Api-User-Agent": dependencies.userAgent,
            "User-Agent": dependencies.userAgent,
          },
        });
      } catch (error) {
        throw new WikipediaGatewayError("transient", undefined, { cause: error });
      }
      const failure = responseFailure(response);
      if (failure) throw failure;

      const body = asRecord(await response.json());
      throwIfBackPressure(body);
      const query = asRecord(body?.query);
      if (!query || !Array.isArray(query.pages)) {
        throw new WikipediaGatewayError("invalid-response");
      }
      const aliases = aliasesFrom(query);
      const pages = query.pages.map(asRecord);

      return titles.map((requestedTitle): WikipediaResolvedLink => {
        const title = canonicalTitle(requestedTitle, aliases);
        const page = pages.find((candidate) => candidate?.title === title);
        if (!page || Object.hasOwn(page, "missing")) {
          return { requestedTitle, exists: false };
        }
        const pageId = positiveInteger(page.pageid);
        if (!pageId || !Number.isInteger(page.ns) || typeof page.title !== "string") {
          throw new WikipediaGatewayError("invalid-response");
        }
        return {
          requestedTitle,
          exists: true,
          pageId,
          namespace: page.ns as number,
          title: page.title,
          disambiguation: Object.hasOwn(asRecord(page.pageprops) ?? {}, "disambiguation"),
        };
      });
    },
  };
}
