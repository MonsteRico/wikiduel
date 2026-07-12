export function isPlayableArticleLabEnabled(mode: string = import.meta.env.MODE): boolean {
  return mode !== 'production'
}
