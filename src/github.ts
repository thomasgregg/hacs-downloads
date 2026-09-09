export function parseGitHubStarCount(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const count = (value as { stargazers_count?: unknown }).stargazers_count;
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function formatGitHubStarCount(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
    notation: value >= 1_000 ? 'compact' : 'standard',
  }).format(value);
}
