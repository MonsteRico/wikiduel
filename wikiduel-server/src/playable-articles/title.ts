const FORBIDDEN_TITLE_CHARACTERS = new Set("#<>[]|{}");

export function isValidWikipediaTitle(title: string): boolean {
  if (title.length === 0 || title.length > 255) return false;

  for (const character of title) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x1f || codePoint === 0x7f || FORBIDDEN_TITLE_CHARACTERS.has(character)) {
      return false;
    }
  }

  return true;
}
