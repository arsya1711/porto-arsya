export function normalizeQuestion(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

export function questionSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeQuestion(left);
  const normalizedRight = normalizeQuestion(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const longest = Math.max(normalizedLeft.length, normalizedRight.length);
  const characterScore = 1 - levenshtein(normalizedLeft, normalizedRight) / longest;
  const leftTokens = new Set(normalizedLeft.split(" "));
  const rightTokens = new Set(normalizedRight.split(" "));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const tokenScore = intersection / new Set([...leftTokens, ...rightTokens]).size;
  return Math.max(characterScore, tokenScore);
}

export function findSimilarQuestion(
  question: string,
  candidates: string[],
  threshold = 0.88,
) {
  if (normalizeQuestion(question).length < 12) return null;
  let best: { text: string; score: number } | null = null;
  for (const candidate of candidates) {
    const score = questionSimilarity(question, candidate);
    if (score >= threshold && (!best || score > best.score)) {
      best = { text: candidate, score };
    }
  }
  return best;
}
