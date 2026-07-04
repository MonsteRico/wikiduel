import {
  WikipediaGatewayError,
  type WikipediaGateway,
  type WikipediaPageSnapshot,
} from "./gateway.js";
import type {
  ArticleAttribution,
  ArticleNotPlayableReason,
  PlayableArticle,
  PlayableArticleResult,
} from "./model.js";
import { normalizeArticleDocument } from "./normalizer.js";

export interface PlayableArticleRepository {
  getByTitle(requestedTitle: string): Promise<PlayableArticleResult>;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function validRequestedTitle(title: string): boolean {
  return title.length > 0
    && title.length <= 255
    && !/[\u0000-\u001f\u007f#<>\[\]|{}]/.test(title);
}

function classification(snapshot: WikipediaPageSnapshot): ArticleNotPlayableReason | undefined {
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
      if (!validRequestedTitle(title)) return { ok: false, failure: { code: "invalid-title" } };

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

      const document = normalizeArticleDocument(snapshot.title, snapshot.html);
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
