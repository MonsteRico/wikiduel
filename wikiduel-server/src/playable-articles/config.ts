export type WikimediaConfig = Readonly<{ userAgent: string }>;

const GENERIC_USER_AGENTS = /^(?:mozilla|curl|wget|node|axios|wikipedia)(?:[/\s]|$)/i;
const IDENTIFYING_USER_AGENT = /^[A-Za-z][A-Za-z0-9._-]*\/[^\s()]+\s+\((?:https:\/\/[^\s()]+|[^\s()@]+@[^\s()@]+)\)$/;

export function loadWikimediaConfig(
  environment: Readonly<Record<string, string | undefined>>,
): WikimediaConfig {
  const userAgent = environment.WIKIMEDIA_USER_AGENT?.trim() ?? "";
  if (
    userAgent.length > 255
    || GENERIC_USER_AGENTS.test(userAgent)
    || !IDENTIFYING_USER_AGENT.test(userAgent)
  ) {
    throw new Error(
      "WIKIMEDIA_USER_AGENT must identify Wiki Duel with a version and HTTPS URL or email contact",
    );
  }
  return { userAgent };
}
