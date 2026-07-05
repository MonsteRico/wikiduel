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
  return encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/gi, ":");
}

function attributionFor(snapshot: WikipediaPageSnapshot): ArticleAttribution | undefined {
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
  const source = safeUrl(metadata.sourceUrl, ["https://upload.wikimedia.org"]);
  const description = safeUrl(metadata.descriptionUrl, [
    "https://commons.wikimedia.org",
    "https://en.wikipedia.org",
  ]);
  const license = metadata.licenseUrl ? safeUrl(metadata.licenseUrl) : undefined;
  const licenseName = metadata.licenseName?.trim();
  const fileTitle = description ? descriptionFileTitle(description) : undefined;
  if (
    !source || !source.pathname.startsWith("/wikipedia/") || source.search || source.hash
    || !description || !fileTitle || !license || !licenseName || metadata.nonFree
    || metadata.restrictions.some((restriction) => /fair[ -]?use|non[ -]?free/i.test(restriction))
    || !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(metadata.mimeType)
    || !Number.isInteger(metadata.width) || metadata.width <= 0
    || !Number.isInteger(metadata.height) || metadata.height <= 0
    || (metadata.width === 1 && metadata.height === 1)
  ) return undefined;

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

export function createPlayableArticleRepository(gateway: WikipediaGateway): PlayableArticleRepository {
  return {
    async getByTitle(requestedTitle) {
      const title = requestedTitle.trim().replace(/_/g, " ");
      if (!isValidWikipediaTitle(title)) return { ok: false, failure: { code: "invalid-title" } };

      let snapshot: WikipediaPageSnapshot;
      try {
        snapshot = await gateway.fetchPage(title);
      } catch (error) {
        return gatewayFailure(error);
      }

      const reason = classification(snapshot);
      if (reason) return { ok: false, failure: { code: "article-not-playable", reason } };

      const attribution = attributionFor(snapshot);
      if (!attribution) return { ok: false, failure: { code: "article-attribution-incomplete" } };

      const candidates = extractCandidateLinkTitles(snapshot.html);
      const imageCandidates = extractCandidateImageTitles(snapshot.html);
      const figures = new Map<string, Omit<ArticleFigure, "type" | "alt" | "caption">>();
      if (imageCandidates.length > 0) {
        try {
          for (const metadata of await gateway.fetchImageMetadata(imageCandidates)) {
            const figure = safeFigure(metadata);
            if (figure && imageCandidates.includes(metadata.requestedTitle)) {
              figures.set(metadata.requestedTitle, figure);
            }
          }
        } catch {
          // Image failure degrades the article to safe text instead of rejecting it.
        }
      }
      let resolvedLinks;
      try {
        resolvedLinks = await gateway.resolveLinks(candidates);
      } catch (error) {
        return gatewayFailure(error);
      }
      const destinations = new Map<string, NavigationDestination>();
      for (const link of resolvedLinks) {
        if (link.exists && classification(link) === undefined) {
          destinations.set(link.requestedTitle, { pageId: link.pageId, title: link.title });
        }
      }
      const document = normalizeArticleDocument(snapshot.title, snapshot.html, destinations, figures);
      if (!document) return { ok: false, failure: { code: "article-normalization-failed" } };

      const article: PlayableArticle = {
        identity: { pageId: snapshot.pageId, title: snapshot.title },
        revision: { id: snapshot.revisionId, timestamp: snapshot.revisionTimestamp },
        attribution,
        document,
      };
      return { ok: true, article: deepFreeze(article) };
    },
  };
}
