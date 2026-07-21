import type {
  NavigationDestination,
  PlayableArticleFailure,
} from "@wikiduel/contracts";

export type PromptMetadata = Readonly<Record<string, string>>;

export type PromptEndpointResolution =
  | Readonly<{
      ok: true;
      article: Readonly<{ identity: NavigationDestination }>;
    }>
  | Readonly<{ ok: false; failure: PlayableArticleFailure }>;

export interface PromptEndpointResolver {
  getByTitle(requestedTitle: string): Promise<PromptEndpointResolution>;
}

export type Prompt = Readonly<{
  id: string;
  start: NavigationDestination;
  target: NavigationDestination;
  enabled: boolean;
  metadata?: PromptMetadata;
}>;

export type PromptCatalog = Readonly<{
  prompts: readonly Prompt[];
}>;

export type PromptCatalogDiagnosticCode =
  | "invalid-document"
  | "unsupported-version"
  | "unknown-field"
  | "invalid-field"
  | "invalid-record"
  | "duplicate-id"
  | "endpoint-not-playable"
  | "identical-endpoints"
  | "duplicate-ordered-pair"
  | "no-enabled-prompts"
  | "seed-file-unreadable"
  | "invalid-json";

export type PromptCatalogDiagnostic = Readonly<{
  code: PromptCatalogDiagnosticCode;
  path: string;
  message: string;
}>;

export type PromptCatalogLoadResult =
  | Readonly<{ ok: true; catalog: PromptCatalog }>
  | Readonly<{ ok: false; diagnostics: readonly PromptCatalogDiagnostic[] }>;

type PromptSeedRecord = Readonly<{
  id: string;
  start: string;
  target: string;
  enabled: boolean;
  metadata?: Readonly<Record<string, string>>;
}>;

type PromptSeedDocument = Readonly<{
  version: 1;
  prompts: readonly PromptSeedRecord[];
}>;

const ROOT_FIELDS = new Set(["version", "prompts"]);
const PROMPT_FIELDS = new Set(["id", "start", "target", "enabled", "metadata"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diagnostic(
  code: PromptCatalogDiagnosticCode,
  path: string,
  message: string,
): PromptCatalogDiagnostic {
  return { code, path, message };
}

function describePlayableArticleFailure(failure: PlayableArticleFailure): string {
  return failure.code === "article-not-playable"
    ? `${failure.code} (${failure.reason})`
    : failure.code;
}

function parseSeed(input: unknown):
  | Readonly<{ ok: true; seed: PromptSeedDocument }>
  | Readonly<{ ok: false; diagnostics: readonly PromptCatalogDiagnostic[] }> {
  if (!isObject(input)) {
    return {
      ok: false,
      diagnostics: [diagnostic(
        "invalid-document",
        "$",
        "Prompt seed must be an object with version and prompts fields.",
      )],
    };
  }

  const diagnostics: PromptCatalogDiagnostic[] = [];
  if (input.version !== 1) {
    diagnostics.push(diagnostic(
      "unsupported-version",
      "$.version",
      "Prompt seed version must be 1.",
    ));
  }
  for (const field of Object.keys(input)) {
    if (!ROOT_FIELDS.has(field)) {
      diagnostics.push(diagnostic(
        "unknown-field",
        `$.${field}`,
        `Prompt seed contains unknown field '${field}'.`,
      ));
    }
  }
  if (!Array.isArray(input.prompts)) {
    diagnostics.push(diagnostic(
      "invalid-field",
      "$.prompts",
      "prompts must be an array.",
    ));
    return { ok: false, diagnostics };
  }

  const records: PromptSeedRecord[] = [];
  const firstIndexById = new Map<string, number>();
  input.prompts.forEach((value, index) => {
    const path = `$.prompts[${index}]`;
    if (!isObject(value)) {
      diagnostics.push(diagnostic(
        "invalid-record",
        path,
        "Each Prompt must be an object.",
      ));
      return;
    }

    for (const field of Object.keys(value)) {
      if (!PROMPT_FIELDS.has(field)) {
        diagnostics.push(diagnostic(
          "unknown-field",
          `${path}.${field}`,
          `Prompt contains unknown field '${field}'.`,
        ));
      }
    }

    const requiredStrings = ["id", "start", "target"] as const;
    for (const field of requiredStrings) {
      if (typeof value[field] !== "string" || value[field].trim().length === 0) {
        diagnostics.push(diagnostic(
          "invalid-field",
          `${path}.${field}`,
          `${field} must be a non-empty string.`,
        ));
      }
    }
    if (typeof value.enabled !== "boolean") {
      diagnostics.push(diagnostic(
        "invalid-field",
        `${path}.enabled`,
        "enabled must be a boolean.",
      ));
    }
    if (typeof value.id === "string" && value.id.trim().length > 0) {
      const firstIndex = firstIndexById.get(value.id);
      if (firstIndex === undefined) {
        firstIndexById.set(value.id, index);
      } else {
        diagnostics.push(diagnostic(
          "duplicate-id",
          `${path}.id`,
          `Prompt ID '${value.id}' duplicates $.prompts[${firstIndex}].id.`,
        ));
      }
    }

    let metadata: Readonly<Record<string, string>> | undefined;
    if (value.metadata !== undefined) {
      if (!isObject(value.metadata)) {
        diagnostics.push(diagnostic(
          "invalid-field",
          `${path}.metadata`,
          "metadata must be an object containing string values.",
        ));
      } else {
        metadata = {};
        for (const [key, metadataValue] of Object.entries(value.metadata)) {
          if (typeof metadataValue !== "string") {
            diagnostics.push(diagnostic(
              "invalid-field",
              `${path}.metadata.${key}`,
              "Prompt metadata values must be strings.",
            ));
          } else {
            metadata = { ...metadata, [key]: metadataValue };
          }
        }
      }
    }

    if (
      typeof value.id === "string" && value.id.trim().length > 0
      && typeof value.start === "string" && value.start.trim().length > 0
      && typeof value.target === "string" && value.target.trim().length > 0
      && typeof value.enabled === "boolean"
    ) {
      records.push({
        id: value.id,
        start: value.start,
        target: value.target,
        enabled: value.enabled,
        ...(metadata === undefined ? {} : { metadata }),
      });
    }
  });

  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, seed: { version: 1, prompts: records } };
}

export async function loadPromptCatalog(
  input: unknown,
  resolver: PromptEndpointResolver,
): Promise<PromptCatalogLoadResult> {
  const parsed = parseSeed(input);
  if (!parsed.ok) return parsed;
  const { seed } = parsed;
  const resolutions = await Promise.all(seed.prompts.map(async (record, index) => {
    const [startResult, targetResult] = await Promise.all([
      resolver.getByTitle(record.start),
      resolver.getByTitle(record.target),
    ]);

    const diagnostics: PromptCatalogDiagnostic[] = [];
    if (!startResult.ok) {
      diagnostics.push(diagnostic(
        "endpoint-not-playable",
        `$.prompts[${index}].start`,
        `Start '${record.start}' failed Playable Article validation: ${describePlayableArticleFailure(startResult.failure)}.`,
      ));
    }
    if (!targetResult.ok) {
      diagnostics.push(diagnostic(
        "endpoint-not-playable",
        `$.prompts[${index}].target`,
        `Target '${record.target}' failed Playable Article validation: ${describePlayableArticleFailure(targetResult.failure)}.`,
      ));
    }
    if (!startResult.ok || !targetResult.ok) return { diagnostics };

    return {
      diagnostics,
      prompt: Object.freeze({
        id: record.id,
        start: Object.freeze({ ...startResult.article.identity }),
        target: Object.freeze({ ...targetResult.article.identity }),
        enabled: record.enabled,
        ...(record.metadata === undefined
          ? {}
          : { metadata: Object.freeze({ ...record.metadata }) }),
      }),
    };
  }));

  const endpointDiagnostics = resolutions.flatMap((resolution) => resolution.diagnostics);
  if (endpointDiagnostics.length > 0) return { ok: false, diagnostics: endpointDiagnostics };
  const prompts = resolutions.flatMap((resolution) =>
    resolution.prompt === undefined ? [] : [resolution.prompt]
  );
  const identicalEndpointDiagnostics = prompts.flatMap((prompt, index) =>
    prompt.start.pageId === prompt.target.pageId
      ? [diagnostic(
          "identical-endpoints",
          `$.prompts[${index}].target`,
          `Prompt '${prompt.id}' start and target both resolve to '${prompt.start.title}' (page ${prompt.start.pageId}).`,
        )]
      : []
  );
  if (identicalEndpointDiagnostics.length > 0) {
    return { ok: false, diagnostics: identicalEndpointDiagnostics };
  }
  const firstPromptByPair = new Map<string, Readonly<{ id: string; index: number }>>();
  const duplicatePairDiagnostics: PromptCatalogDiagnostic[] = [];
  prompts.forEach((prompt, index) => {
    const pair = `${prompt.start.pageId}->${prompt.target.pageId}`;
    const first = firstPromptByPair.get(pair);
    if (first === undefined) {
      firstPromptByPair.set(pair, { id: prompt.id, index });
      return;
    }
    duplicatePairDiagnostics.push(diagnostic(
      "duplicate-ordered-pair",
      `$.prompts[${index}]`,
      `Prompt '${prompt.id}' duplicates the canonical ordered pair from Prompt '${first.id}' at $.prompts[${first.index}].`,
    ));
  });
  if (duplicatePairDiagnostics.length > 0) {
    return { ok: false, diagnostics: duplicatePairDiagnostics };
  }
  if (!prompts.some((prompt) => prompt.enabled)) {
    return {
      ok: false,
      diagnostics: [diagnostic(
        "no-enabled-prompts",
        "$.prompts",
        "Prompt Catalog must contain at least one enabled Prompt.",
      )],
    };
  }

  return {
    ok: true,
    catalog: Object.freeze({ prompts: Object.freeze(prompts) }),
  };
}
