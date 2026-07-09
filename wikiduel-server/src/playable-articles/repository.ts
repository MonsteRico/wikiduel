import {
  WikipediaGatewayError,
  type WikipediaGateway,
  type WikipediaImageMetadata,
  type WikipediaPageSnapshot,
} from "./gateway.js";
import type {
  ArticleAttribution,
  ArticleFigure,
  ArticleNotPlayableReason,
  NavigationDestination,
  PlayableArticle,
  PlayableArticleResult,
} from "./model.js";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

import {
  extractCandidateImageTitles,
  extractCandidateLinkTitles,
  normalizeArticleDocument,
} from "./normalizer.js";
import { isValidWikipediaTitle } from "./title.js";

export interface PlayableArticleRepository {
  getByTitle(requestedTitle: string): Promise<PlayableArticleResult>;
}

export interface PlayableArticleRepositoryLogger {
  debug(details: Readonly<Record<string, unknown>>, message: string): void;
  warn(details: Readonly<Record<string, unknown>>, message: string): void;
}

export type PlayableArticleRepositoryOptions = Readonly<{
  logger?: PlayableArticleRepositoryLogger;
  random?: () => number;
}>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function classification(
  snapshot: Pick<WikipediaPageSnapshot, "namespace" | "title" | "disambiguation">,
): ArticleNotPlayableReason | undefined {
  // This is the single policy seam for removing unsuitable pages from Wiki Duel's
  // playable graph. Add a deterministic check here when playtesting identifies a
  // new class of article to exclude, and add the corresponding reason to
  // ArticleNotPlayableReason so callers receive a stable, explainable outcome.
  if (snapshot.namespace !== 0) return "non-main-namespace";
  if (snapshot.disambiguation) return "disambiguation";
  if (/^Lists? of /i.test(snapshot.title)) return "list";
  if (/^(?:[1-9]\d{0,3}|[1-9]\d{0,3} BC)$/.test(snapshot.title)) return "calendar-year";
  if (new RegExp(`^(?:${MONTHS.join("|")}) (?:[1-9]|[12]\\d|3[01])$`).test(snapshot.title)) {
    return "calendar-date";
  }
  return undefined;
}

function articleTitleSegment(title: string): string {
  // Wikipedia article URLs spell spaces as underscores and leave the namespace
  // colon readable. Keeping this conversion here makes attribution URLs match
  // the canonical MediaWiki shape without letting callers hand-build paths.
  return encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/gi, ":");
}

function attributionFor(snapshot: WikipediaPageSnapshot): ArticleAttribution | undefined {
  // Article attribution is required for the whole Playable Article: without a
  // stable oldid and timestamp we cannot tell users which revision we modified.
  // Image attribution is handled separately so bad media can be omitted without
  // rejecting an otherwise valid article.
  if (
    !Number.isInteger(snapshot.revisionId)
    || snapshot.revisionId <= 0
    || !snapshot.revisionTimestamp
    || !Number.isFinite(Date.parse(snapshot.revisionTimestamp))
  ) return undefined;

  const title = articleTitleSegment(snapshot.title);
  return {
    sourceUrl: `https://en.wikipedia.org/wiki/${title}?oldid=${snapshot.revisionId}`,
    historyUrl: `https://en.wikipedia.org/w/index.php?title=${title}&action=history`,
    licenseName: "Creative Commons Attribution-ShareAlike 4.0 International",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    modificationNotice: "Wiki Duel simplified and modified this Wikipedia article.",
  };
}

function safeUrl(value: string, origins?: readonly string[]): URL | undefined {
  // All externally supplied URLs are parsed through this helper before use so
  // the policy is expressed on structured URL fields, not brittle string checks.
  // HTTPS prevents mixed-content and downgrade surprises; rejecting credentials
  // avoids preserving attacker-controlled authority text in rendered links.
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  if (origins && !origins.includes(url.origin)) return undefined;
  return url;
}

function plainText(html: string | undefined): string | undefined {
  // Wikimedia creator/credit fields are HTML fragments supplied by file pages.
  // The article contract only needs readable attribution text, so we parse the
  // fragment, keep text nodes, and deliberately skip executable or embedded
  // subtrees instead of trying to sanitize and preserve markup.
  if (!html) return undefined;
  const fragment = parseFragment(html);
  const parts: string[] = [];
  const excluded = new Set(["script", "style", "template", "noscript", "svg", "math"]);
  const visit = (nodes: readonly DefaultTreeAdapterMap["node"][]) => {
    for (const node of nodes) {
      if (node.nodeName === "#text" && "value" in node) {
        parts.push(node.value);
      } else if (
        "childNodes" in node
        && (!("tagName" in node) || !excluded.has(node.tagName))
      ) {
        visit(node.childNodes);
      }
    }
  };
  visit(fragment.childNodes);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text || undefined;
}

function descriptionFileTitle(url: URL): string | undefined {
  // The image-history URL is not returned by imageinfo, but MediaWiki history is
  // keyed by the file page title. Deriving that title only from an approved,
  // query-free `/wiki/File:*` description URL ties history back to the same file
  // identity and avoids trusting a separate, caller-supplied title for links.
  if (url.search || url.hash || !url.pathname.startsWith("/wiki/")) return undefined;
  try {
    const title = decodeURIComponent(url.pathname.slice("/wiki/".length));
    return /^File:/i.test(title) && isValidWikipediaTitle(title) ? title : undefined;
  } catch {
    return undefined;
  }
}

function safeFigure(
  metadata: WikipediaImageMetadata,
): Omit<ArticleFigure, "type" | "alt" | "caption"> | undefined {
  // This is the repository's image policy reducer. The gateway translates
  // Wikimedia's response into project-owned fields; this function decides
  // whether those fields are safe and complete enough to become article output.
  // Returning undefined is intentional degradation: unsafe media disappears, but
  // the surrounding article can still be playable as text.
  const source = safeUrl(metadata.sourceUrl, ["https://upload.wikimedia.org"]);
  const description = safeUrl(metadata.descriptionUrl, [
    "https://commons.wikimedia.org",
    "https://en.wikipedia.org",
  ]);
  const license = metadata.licenseUrl ? safeUrl(metadata.licenseUrl) : undefined;
  const licenseName = metadata.licenseName?.trim();
  const fileTitle = description ? descriptionFileTitle(description) : undefined;
  // The source check is narrower than "any upload.wikimedia.org URL": thumbnails
  // must be ordinary `/wikipedia/` media with no query/hash. That keeps redirect
  // endpoints, tracking parameters, and non-file service URLs out of the render
  // contract even when they came from upstream metadata.
  if (
    !source || !source.pathname.startsWith("/wikipedia/") || source.search || source.hash
    || !description || !fileTitle || !license || !licenseName || metadata.nonFree
    || metadata.restrictions.some((restriction) => /fair[ -]?use|non[ -]?free/i.test(restriction))
    || !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(metadata.mimeType)
    || !Number.isInteger(metadata.width) || metadata.width <= 0
    || !Number.isInteger(metadata.height) || metadata.height <= 0
    || (metadata.width === 1 && metadata.height === 1)
  ) return undefined;

  // History lives on the same wiki as the approved description page: Commons
  // files should link to Commons history, while local enwiki files should link
  // to enwiki history. Reusing `fileTitle` keeps the attribution links coherent.
  const history = new URL("/w/index.php", description.origin);
  history.search = new URLSearchParams({ title: fileTitle, action: "history" }).toString();
  const creator = plainText(metadata.creatorHtml);
  const credit = plainText(metadata.creditHtml);
  return {
    sourceUrl: source.href,
    width: metadata.width,
    height: metadata.height,
    attribution: {
      descriptionUrl: description.href,
      historyUrl: history.href,
      ...(creator ? { creator } : {}),
      ...(credit ? { credit } : {}),
      licenseName,
      licenseUrl: license.href,
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function gatewayFailure(error: unknown): PlayableArticleResult {
  if (error instanceof WikipediaGatewayError) {
    if (error.kind === "not-found") return { ok: false, failure: { code: "article-not-found" } };
    if (error.kind === "rate-limited") {
      return {
        ok: false,
        failure: error.retryAfterSeconds === undefined
          ? { code: "upstream-rate-limited" }
          : { code: "upstream-rate-limited", retryAfterSeconds: error.retryAfterSeconds },
      };
    }
  }
  return { ok: false, failure: { code: "upstream-unavailable" } };
}

export function createPlayableArticleRepository(
  gateway: WikipediaGateway,
  options: PlayableArticleRepositoryOptions = {},
): PlayableArticleRepository {
  const logger: PlayableArticleRepositoryLogger = options.logger ?? {
    debug: () => undefined,
    warn: () => undefined,
  };
  const random = options.random ?? Math.random;
  const articlesByPageId = new Map<number, PlayableArticle>();
  const pageIdsByTitle = new Map<string, number>();
  const buildsByTitle = new Map<string, Promise<PlayableArticleResult>>();

  async function waitForRetry(title: string, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    return new Promise((resolve) => {
      const delayMilliseconds = 50 + Math.floor(random() * 150);
      logger.debug(
        { requestedTitle: title, event: "retry", delayMilliseconds },
        "Retrying transient Playable Article upstream request",
      );
      const timer = setTimeout(() => finish(true), delayMilliseconds);
      const onAbort = () => finish(false);
      const finish = (mayRetry: boolean) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve(mayRetry);
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  async function withTransientRetry<T>(
    operation: () => Promise<T>,
    title: string,
    signal: AbortSignal,
    retryState: { available: boolean },
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        !(error instanceof WikipediaGatewayError)
        || error.kind !== "transient"
        || !retryState.available
      ) throw error;
      retryState.available = false;
      if (!await waitForRetry(title, signal)) throw error;
      return operation();
    }
  }

  async function buildArticle(
    title: string,
    signal: AbortSignal,
    retryState: { available: boolean },
  ): Promise<PlayableArticleResult> {
    const snapshot = await withTransientRetry(
      () => gateway.fetchPage(title, { signal }),
      title,
      signal,
      retryState,
    );

    const canonicalArticle = articlesByPageId.get(snapshot.pageId);
    if (canonicalArticle) return { ok: true, article: canonicalArticle };

    const reason = classification(snapshot);
    if (reason) return { ok: false, failure: { code: "article-not-playable", reason } };

    const attribution = attributionFor(snapshot);
    if (!attribution) return { ok: false, failure: { code: "article-attribution-incomplete" } };

    const candidates = extractCandidateLinkTitles(snapshot.html);
    const imageCandidates = extractCandidateImageTitles(snapshot.html);
    const figures = new Map<string, Omit<ArticleFigure, "type" | "alt" | "caption">>();
    if (imageCandidates.length > 0) {
      const metadataResults = await withTransientRetry(
        () => gateway.fetchImageMetadata(imageCandidates, { signal }),
        title,
        signal,
        retryState,
      );
      for (const metadata of metadataResults) {
        const figure = safeFigure(metadata);
        if (figure && imageCandidates.includes(metadata.requestedTitle)) {
          figures.set(metadata.requestedTitle, figure);
        }
      }
    }
    const resolvedLinks = await withTransientRetry(
      () => gateway.resolveLinks(candidates, { signal }),
      title,
      signal,
      retryState,
    );
    const destinations = new Map<string, NavigationDestination>();
    for (const link of resolvedLinks) {
      if (link.exists && classification(link) === undefined) {
        destinations.set(link.requestedTitle, { pageId: link.pageId, title: link.title });
      }
    }
    const document = normalizeArticleDocument(snapshot.title, snapshot.html, destinations, figures);
    if (!document) return { ok: false, failure: { code: "article-normalization-failed" } };

    return {
      ok: true,
      article: deepFreeze<PlayableArticle>({
        identity: { pageId: snapshot.pageId, title: snapshot.title },
        revision: { id: snapshot.revisionId, timestamp: snapshot.revisionTimestamp },
        attribution,
        document,
      }),
    };
  }

  async function buildWithinBudget(title: string): Promise<PlayableArticleResult> {
    const controller = new AbortController();
    let deadlineTimer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<PlayableArticleResult>((resolve) => {
      deadlineTimer = setTimeout(() => {
        controller.abort();
        resolve({ ok: false, failure: { code: "upstream-unavailable" } });
      }, 15_000);
    });
    const work = (async (): Promise<PlayableArticleResult> => {
      try {
        return await buildArticle(title, controller.signal, { available: true });
      } catch (error) {
        return gatewayFailure(error);
      }
    })();
    const result = await Promise.race([work, deadline]);
    clearTimeout(deadlineTimer!);

    if (result.ok && !controller.signal.aborted) {
      articlesByPageId.set(result.article.identity.pageId, result.article);
      pageIdsByTitle.set(title, result.article.identity.pageId);
      pageIdsByTitle.set(result.article.identity.title, result.article.identity.pageId);
    } else if (!result.ok) {
      logger.warn(
        { requestedTitle: title, failureCode: result.failure.code },
        "Playable Article build failed",
      );
    }
    return result;
  }

  return {
    async getByTitle(requestedTitle) {
      const title = requestedTitle.trim().replace(/_/g, " ");
      if (!isValidWikipediaTitle(title)) return { ok: false, failure: { code: "invalid-title" } };

      const cachedPageId = pageIdsByTitle.get(title);
      const cachedArticle = cachedPageId === undefined ? undefined : articlesByPageId.get(cachedPageId);
      if (cachedArticle) {
        logger.debug({ requestedTitle: title, event: "cache-hit" }, "Playable Article cache hit");
        return { ok: true, article: cachedArticle };
      }

      const existingBuild = buildsByTitle.get(title);
      if (existingBuild) {
        logger.debug(
          { requestedTitle: title, event: "in-flight-hit" },
          "Playable Article build already in flight",
        );
        return existingBuild;
      }

      logger.debug({ requestedTitle: title, event: "cache-miss" }, "Playable Article cache miss");
      const build = buildWithinBudget(title);
      buildsByTitle.set(title, build);
      try {
        return await build;
      } finally {
        if (buildsByTitle.get(title) === build) buildsByTitle.delete(title);
      }
    },
  };
}
