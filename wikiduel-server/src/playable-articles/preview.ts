import type {
  ArticleBlock,
  ArticleInline,
  PlayableArticle,
  PlayableArticleFailure,
  PlayableArticleResult,
} from "./model.js";

export type PreviewArticleRequest = Readonly<{
  type: "preview-article";
  requestId: string;
  requestedTitle: string;
}>;

export type PreviewOmissionDetail = Readonly<{
  reason: string;
  subject?: string;
  properties?: Readonly<Record<string, unknown>>;
}>;

export type PreviewOmissionBucket = Readonly<{
  count: number;
  reasons: readonly string[];
  examples: readonly PreviewOmissionDetail[];
}>;

export type PreviewDiagnostics = Readonly<{
  requestedTitle: string;
  wikipediaUrl?: string;
  canonicalIdentity?: Readonly<{ pageId: number; title: string }>;
  revision?: Readonly<{ id: number; timestamp: string }>;
  durationMs: number;
  cacheOutcome: "hit" | "miss" | "in-flight" | "not-cached";
  emittedNodeCounts: Readonly<{
    headings: number;
    paragraphs: number;
    lists: number;
    listItems: number;
    figures: number;
    text: number;
    strong: number;
    emphasis: number;
    navigation: number;
  }>;
  omissions: Readonly<{
    structure: PreviewOmissionBucket;
    links: PreviewOmissionBucket;
    images: PreviewOmissionBucket;
    imageAttribution: PreviewOmissionBucket;
  }>;
  retry: Readonly<{
    attempts: number;
    retryAfterSeconds?: number;
  }>;
}>;

export type PreviewBuildDetails = Readonly<{
  omissions?: PreviewDiagnostics["omissions"];
  retry?: PreviewDiagnostics["retry"];
}>;

export type PreviewArticleResultMessage = Readonly<{
  type: "preview-article-result";
  requestId: string;
  requestedTitle: string;
  ok: true;
  article: PlayableArticle;
  diagnostics: PreviewDiagnostics;
}> | Readonly<{
  type: "preview-article-result";
  requestId: string;
  requestedTitle: string;
  ok: false;
  failure: PlayableArticleFailure;
  diagnostics: PreviewDiagnostics;
}>;

export type PreviewErrorMessage = Readonly<{
  type: "preview-error";
  requestId?: string;
  requestedTitle?: string;
  failure: Readonly<{ code: "malformed-message" | "preview-unavailable" }>;
}>;

export type PreviewMessage = PreviewArticleResultMessage | PreviewErrorMessage;

export function isPreviewRequest(value: unknown): value is PreviewArticleRequest {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return message.type === "preview-article"
    && typeof message.requestId === "string"
    && message.requestId.length > 0
    && typeof message.requestedTitle === "string";
}

type MutableCounts = {
  headings: number;
  paragraphs: number;
  lists: number;
  listItems: number;
  figures: number;
  text: number;
  strong: number;
  emphasis: number;
  navigation: number;
};

function countInline(inline: ArticleInline, counts: MutableCounts): void {
  if (inline.type === "text") {
    counts.text += 1;
    return;
  }
  if (inline.type === "strong") counts.strong += 1;
  if (inline.type === "emphasis") counts.emphasis += 1;
  if (inline.type === "navigation") counts.navigation += 1;
  inline.children.forEach((child) => countInline(child, counts));
}

function countBlock(block: ArticleBlock, counts: MutableCounts): void {
  if (block.type === "heading") counts.headings += 1;
  if (block.type === "paragraph") counts.paragraphs += 1;
  if (block.type === "list") {
    counts.lists += 1;
    block.items.forEach((item) => {
      counts.listItems += 1;
      item.children.forEach((child) => countInline(child, counts));
      item.blocks.forEach((child) => countBlock(child, counts));
    });
    return;
  }
  if (block.type === "figure") {
    counts.figures += 1;
    block.caption.forEach((child) => countInline(child, counts));
    return;
  }
  block.children.forEach((child) => countInline(child, counts));
}

function emptyOmission(): PreviewOmissionBucket {
  return { count: 0, reasons: [], examples: [] };
}

function emptyCounts(): MutableCounts {
  return {
    headings: 0,
    paragraphs: 0,
    lists: 0,
    listItems: 0,
    figures: 0,
    text: 0,
    strong: 0,
    emphasis: 0,
    navigation: 0,
  };
}

export function buildPreviewDiagnostics(
  requestedTitle: string,
  result: PlayableArticleResult,
  durationMs: number,
  cacheOutcome: PreviewDiagnostics["cacheOutcome"],
  details: PreviewBuildDetails = {},
): PreviewDiagnostics {
  const counts = emptyCounts();
  if (result.ok) result.article.document.blocks.forEach((block) => countBlock(block, counts));

  return {
    requestedTitle,
    ...(result.ok ? { wikipediaUrl: result.article.attribution.sourceUrl } : {}),
    ...(result.ok ? {
      canonicalIdentity: result.article.identity,
      revision: result.article.revision,
    } : {}),
    durationMs: Math.max(0, Math.round(durationMs)),
    cacheOutcome,
    emittedNodeCounts: counts,
    omissions: details.omissions ?? {
      structure: emptyOmission(),
      links: emptyOmission(),
      images: emptyOmission(),
      imageAttribution: emptyOmission(),
    },
    retry: details.retry ?? (result.ok || result.failure.code !== "upstream-rate-limited"
      ? { attempts: 0 }
      : {
        attempts: 0,
        ...(result.failure.retryAfterSeconds === undefined
          ? {}
          : { retryAfterSeconds: result.failure.retryAfterSeconds }),
      }),
  };
}

export function previewArticleResult(
  request: PreviewArticleRequest,
  result: PlayableArticleResult,
  diagnostics: PreviewDiagnostics,
): PreviewArticleResultMessage {
  return result.ok
    ? {
      type: "preview-article-result",
      requestId: request.requestId,
      requestedTitle: request.requestedTitle,
      ok: true,
      article: result.article,
      diagnostics,
    }
    : {
      type: "preview-article-result",
      requestId: request.requestId,
      requestedTitle: request.requestedTitle,
      ok: false,
      failure: result.failure,
      diagnostics,
    };
}

export function previewError(
  request: Partial<PreviewArticleRequest>,
  code: "malformed-message" | "preview-unavailable",
): PreviewErrorMessage {
  return {
    type: "preview-error",
    ...(request.requestId ? { requestId: request.requestId } : {}),
    ...(request.requestedTitle ? { requestedTitle: request.requestedTitle } : {}),
    failure: { code },
  };
}
