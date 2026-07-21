import { z } from "zod";

const NavigationDestinationSchema = z.strictObject({
  pageId: z.number(),
  title: z.string(),
});

function createArticleInlineSchema<Child extends z.ZodType>(child: Child) {
  return z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("text"), value: z.string() }),
    z.strictObject({ type: z.literal("strong"), children: z.array(child) }),
    z.strictObject({ type: z.literal("emphasis"), children: z.array(child) }),
    z.strictObject({
      type: z.literal("navigation"),
      destination: NavigationDestinationSchema,
      children: z.array(child),
    }),
  ]);
}

const ArticleInlineShapeSchema = createArticleInlineSchema(z.unknown());

type DeepReadonly<Value> =
  Value extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

type ArticleInlineShape = DeepReadonly<z.infer<typeof ArticleInlineShapeSchema>>;
type ArticleTextInline = Extract<ArticleInlineShape, { type: "text" }>;

interface ArticleStrongInline
  extends Omit<Extract<ArticleInlineShape, { type: "strong" }>, "children"> {
  readonly children: readonly ArticleInline[];
}

interface ArticleEmphasisInline
  extends Omit<Extract<ArticleInlineShape, { type: "emphasis" }>, "children"> {
  readonly children: readonly ArticleInline[];
}

interface ArticleNavigationInline
  extends Omit<Extract<ArticleInlineShape, { type: "navigation" }>, "children"> {
  readonly children: readonly ArticleInline[];
}

export type ArticleInline =
  | ArticleTextInline
  | ArticleStrongInline
  | ArticleEmphasisInline
  | ArticleNavigationInline;

const ArticleInlineSchema: z.ZodType<ArticleInline> = z.lazy(
  () => createArticleInlineSchema(ArticleInlineSchema),
);

const ImageAttributionSchema = z.strictObject({
  descriptionUrl: z.string(),
  historyUrl: z.string(),
  creator: z.string().optional(),
  credit: z.string().optional(),
  licenseName: z.string(),
  licenseUrl: z.string(),
});

const ArticleFigureSchema = z.strictObject({
  type: z.literal("figure"),
  sourceUrl: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.string(),
  caption: z.array(ArticleInlineSchema),
  attribution: ImageAttributionSchema,
});

const ArticleMediaPlaceholderSchema = z.strictObject({
  type: z.literal("media-placeholder"),
  kind: z.enum(["audio", "video"]),
});

function createArticleBlockSchema<Child extends z.ZodType>(child: Child) {
  return z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("heading"),
      targetId: z.string(),
      level: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
      children: z.array(ArticleInlineSchema),
    }),
    z.strictObject({ type: z.literal("paragraph"), children: z.array(ArticleInlineSchema) }),
    z.strictObject({ type: z.literal("line"), children: z.array(ArticleInlineSchema) }),
    z.strictObject({
      type: z.literal("list"),
      ordered: z.boolean(),
      items: z.array(z.strictObject({
        children: z.array(ArticleInlineSchema),
        blocks: z.array(child),
      })),
    }),
    ArticleFigureSchema,
    ArticleMediaPlaceholderSchema,
    z.strictObject({
      type: z.literal("infobox"),
      title: z.array(ArticleInlineSchema).optional(),
      sections: z.array(z.strictObject({
        label: z.array(ArticleInlineSchema).optional(),
        items: z.array(z.strictObject({
          label: z.array(ArticleInlineSchema).optional(),
          blocks: z.array(child),
        })),
      })),
    }),
  ]);
}

const ArticleBlockShapeSchema = createArticleBlockSchema(z.unknown());
type ArticleBlockShape = DeepReadonly<z.infer<typeof ArticleBlockShapeSchema>>;
type ArticleListShape = Extract<ArticleBlockShape, { type: "list" }>;
type ArticleInfoboxShape = Extract<ArticleBlockShape, { type: "infobox" }>;

export type ArticleListItem =
  Omit<ArticleListShape["items"][number], "blocks">
  & { readonly blocks: readonly ArticleBlock[] };
export type ArticleList =
  Omit<ArticleListShape, "items"> & { readonly items: readonly ArticleListItem[] };
export type ArticleInfoboxItem =
  Omit<ArticleInfoboxShape["sections"][number]["items"][number], "blocks">
  & { readonly blocks: readonly ArticleBlock[] };
export type ArticleInfoboxSection =
  Omit<ArticleInfoboxShape["sections"][number], "items">
  & { readonly items: readonly ArticleInfoboxItem[] };
export type ArticleInfobox =
  Omit<ArticleInfoboxShape, "sections">
  & { readonly sections: readonly ArticleInfoboxSection[] };
export type ArticleBlock =
  | Exclude<ArticleBlockShape, { type: "list" | "infobox" }>
  | ArticleList
  | ArticleInfobox;

const ArticleBlockSchema: z.ZodType<ArticleBlock> = z.lazy(
  () => createArticleBlockSchema(ArticleBlockSchema),
);

const ArticleTableOfContentsEntrySchema = z.strictObject({
  targetId: z.string(),
  level: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  label: z.string(),
});

const ArticleDocumentSchema = z.strictObject({
  title: z.string(),
  tableOfContents: z.array(ArticleTableOfContentsEntrySchema),
  blocks: z.array(ArticleBlockSchema),
});

const ArticleAttributionSchema = z.strictObject({
  sourceUrl: z.string(),
  historyUrl: z.string(),
  licenseName: z.literal("Creative Commons Attribution-ShareAlike 4.0 International"),
  licenseUrl: z.literal("https://creativecommons.org/licenses/by-sa/4.0/"),
  modificationNotice: z.string(),
});

const PlayableArticleSchema = z.strictObject({
  identity: NavigationDestinationSchema,
  revision: z.strictObject({ id: z.number(), timestamp: z.string() }),
  attribution: ArticleAttributionSchema,
  document: ArticleDocumentSchema,
});

const ArticleNotPlayableReasonSchema = z.enum([
  "non-main-namespace",
  "disambiguation",
  "list",
  "calendar-year",
  "calendar-date",
]);

const PlayableArticleFailureSchema = z.discriminatedUnion("code", [
  z.strictObject({ code: z.literal("invalid-title") }),
  z.strictObject({ code: z.literal("article-not-found") }),
  z.strictObject({ code: z.literal("article-not-playable"), reason: ArticleNotPlayableReasonSchema }),
  z.strictObject({
    code: z.literal("upstream-rate-limited"),
    retryAfterSeconds: z.number().optional(),
  }),
  z.strictObject({ code: z.literal("upstream-unavailable") }),
  z.strictObject({ code: z.literal("article-normalization-failed") }),
  z.strictObject({ code: z.literal("article-attribution-incomplete") }),
]);

const PreviewArticleRequestSchema = z.strictObject({
  type: z.literal("preview-article"),
  requestId: z.string().min(1),
  requestedTitle: z.string(),
});

const PreviewOmissionDetailSchema = z.strictObject({
  reason: z.string(),
  subject: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

const PreviewOmissionBucketSchema = z.strictObject({
  count: z.number(),
  reasons: z.array(z.string()),
  examples: z.array(PreviewOmissionDetailSchema),
});

const PreviewDiagnosticsSchema = z.strictObject({
  requestedTitle: z.string(),
  wikipediaUrl: z.string().optional(),
  canonicalIdentity: NavigationDestinationSchema.optional(),
  revision: z.strictObject({ id: z.number(), timestamp: z.string() }).optional(),
  durationMs: z.number(),
  cacheOutcome: z.enum(["hit", "miss", "in-flight", "not-cached"]),
  emittedNodeCounts: z.strictObject({
    headings: z.number(),
    paragraphs: z.number(),
    lists: z.number(),
    listItems: z.number(),
    figures: z.number(),
    text: z.number(),
    strong: z.number(),
    emphasis: z.number(),
    navigation: z.number(),
  }),
  omissions: z.strictObject({
    structure: PreviewOmissionBucketSchema,
    links: PreviewOmissionBucketSchema,
    images: PreviewOmissionBucketSchema,
    imageAttribution: PreviewOmissionBucketSchema,
  }),
  retry: z.strictObject({
    attempts: z.number(),
    retryAfterSeconds: z.number().optional(),
  }),
});

const LobbyMemberSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  role: z.enum(["host", "opponent"]),
  connected: z.boolean(),
  ready: z.boolean(),
});

const LobbySchema = z.strictObject({
  code: z.string(),
  members: z.array(LobbyMemberSchema),
});

const DuelPromptSchema = z.strictObject({
  id: z.string(),
  start: NavigationDestinationSchema,
  target: NavigationDestinationSchema,
});

const DuelPlayerIdentitySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  role: z.enum(["host", "opponent"]),
  hp: z.number().int().min(0).max(100),
});

const PreparingDuelProjectionSchema = z.strictObject({
  id: z.string(),
  phase: z.literal("preparing"),
  round: z.strictObject({
    number: z.number().int().positive(),
    prompt: DuelPromptSchema,
  }),
  self: DuelPlayerIdentitySchema.extend({
    path: z.array(NavigationDestinationSchema),
    clicks: z.number().int().nonnegative(),
  }),
  opponent: DuelPlayerIdentitySchema,
});

const StartDuelRejectionReasonSchema = z.enum([
  "invalid-state",
  "not-host",
  "lobby-not-full",
  "players-not-ready",
]);

const ClientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ping") }),
  z.strictObject({ type: z.literal("create-lobby"), clientId: z.string() }),
  z.strictObject({
    type: z.literal("join-lobby"),
    clientId: z.string(),
    lobbyCode: z.string(),
  }),
  z.strictObject({ type: z.literal("set-ready"), ready: z.boolean() }),
  z.strictObject({ type: z.literal("start-duel") }),
  z.strictObject({ type: z.literal("leave-lobby") }),
  PreviewArticleRequestSchema,
]);

const TimestampSchema = { sentAt: z.string() };

const PreviewArticleResultMessageSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    type: z.literal("preview-article-result"),
    requestId: z.string(),
    requestedTitle: z.string(),
    ok: z.literal(true),
    article: PlayableArticleSchema,
    diagnostics: PreviewDiagnosticsSchema,
    ...TimestampSchema,
  }),
  z.strictObject({
    type: z.literal("preview-article-result"),
    requestId: z.string(),
    requestedTitle: z.string(),
    ok: z.literal(false),
    failure: PlayableArticleFailureSchema,
    diagnostics: PreviewDiagnosticsSchema,
    ...TimestampSchema,
  }),
]);

const PreviewErrorMessageSchema = z.strictObject({
  type: z.literal("preview-error"),
  requestId: z.string().optional(),
  requestedTitle: z.string().optional(),
  failure: z.strictObject({ code: z.enum(["malformed-message", "preview-unavailable"]) }),
  ...TimestampSchema,
});

const ServerMessageSchema = z.union([
  z.strictObject({ type: z.literal("welcome"), message: z.string(), ...TimestampSchema }),
  z.strictObject({ type: z.literal("pong"), message: z.string(), ...TimestampSchema }),
  z.strictObject({ type: z.literal("lobby-state"), lobby: LobbySchema, ...TimestampSchema }),
  z.strictObject({ type: z.literal("lobby-error"), message: z.string(), ...TimestampSchema }),
  z.strictObject({ type: z.literal("lobby-closed"), message: z.string(), ...TimestampSchema }),
  z.strictObject({
    type: z.literal("duel-state"),
    duel: PreparingDuelProjectionSchema,
    ...TimestampSchema,
  }),
  z.strictObject({
    type: z.literal("command-rejected"),
    command: z.enum(["create-lobby", "join-lobby", "set-ready", "start-duel"]),
    reason: StartDuelRejectionReasonSchema,
    ...TimestampSchema,
  }),
  z.strictObject({
    type: z.literal("duel-forfeited"),
    duelId: z.string(),
    winnerId: z.string(),
    reason: z.literal("player-disconnected"),
    message: z.string(),
    ...TimestampSchema,
  }),
  PreviewArticleResultMessageSchema,
  PreviewErrorMessageSchema,
]);

export type NavigationDestination = DeepReadonly<z.infer<typeof NavigationDestinationSchema>>;
export type ImageAttribution = DeepReadonly<z.infer<typeof ImageAttributionSchema>>;
export type ArticleFigure = DeepReadonly<z.infer<typeof ArticleFigureSchema>>;
export type ArticleMediaPlaceholder =
  DeepReadonly<z.infer<typeof ArticleMediaPlaceholderSchema>>;
export type ArticleTableOfContentsEntry =
  DeepReadonly<z.infer<typeof ArticleTableOfContentsEntrySchema>>;
export type ArticleDocument = DeepReadonly<z.infer<typeof ArticleDocumentSchema>>;
export type ArticleAttribution = DeepReadonly<z.infer<typeof ArticleAttributionSchema>>;
export type PlayableArticle = DeepReadonly<z.infer<typeof PlayableArticleSchema>>;
export type ArticleNotPlayableReason = z.infer<typeof ArticleNotPlayableReasonSchema>;
export type PlayableArticleFailure =
  DeepReadonly<z.infer<typeof PlayableArticleFailureSchema>>;
export type PreviewArticleRequest = DeepReadonly<z.infer<typeof PreviewArticleRequestSchema>>;
export type PreviewOmissionDetail =
  DeepReadonly<z.infer<typeof PreviewOmissionDetailSchema>>;
export type PreviewOmissionBucket =
  DeepReadonly<z.infer<typeof PreviewOmissionBucketSchema>>;
export type PreviewDiagnostics = DeepReadonly<z.infer<typeof PreviewDiagnosticsSchema>>;
export type LobbyMember = DeepReadonly<z.infer<typeof LobbyMemberSchema>>;
export type Lobby = DeepReadonly<z.infer<typeof LobbySchema>>;
export type DuelPrompt = DeepReadonly<z.infer<typeof DuelPromptSchema>>;
export type PreparingDuelProjection =
  DeepReadonly<z.infer<typeof PreparingDuelProjectionSchema>>;
export type StartDuelRejectionReason = z.infer<typeof StartDuelRejectionReasonSchema>;
export type ClientMessage = DeepReadonly<z.infer<typeof ClientMessageSchema>>;
export type PreviewArticleResultMessage =
  DeepReadonly<z.infer<typeof PreviewArticleResultMessageSchema>>;
export type PreviewErrorMessage = DeepReadonly<z.infer<typeof PreviewErrorMessageSchema>>;
export type PreviewMessage = PreviewArticleResultMessage | PreviewErrorMessage;
export type ServerMessage = DeepReadonly<z.infer<typeof ServerMessageSchema>>;

export type MalformedMessageFailure = Readonly<{ code: "malformed-message" }>;

export type DecodeResult<Message> =
  | Readonly<{ ok: true; message: Message }>
  | Readonly<{ ok: false; failure: MalformedMessageFailure }>;

function decode<Message>(schema: z.ZodType<Message>, value: unknown): DecodeResult<Message> {
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, message: result.data }
    : { ok: false, failure: { code: "malformed-message" } };
}

export function decodeClientMessage(value: unknown): DecodeResult<ClientMessage> {
  return decode(ClientMessageSchema, value);
}

export function decodeServerMessage(value: unknown): DecodeResult<ServerMessage> {
  return decode(ServerMessageSchema, value);
}
