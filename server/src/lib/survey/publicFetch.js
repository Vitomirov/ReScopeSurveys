/** The per-survey open cap counts only when the definition is not already cached. */
export function countsSurveyWideFetch(cacheHit) {
  return cacheHit !== true
}
