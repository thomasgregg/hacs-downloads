import { describe, expect, it } from 'vitest';
import { formatGitHubStarCount, parseGitHubStarCount } from './github';

describe('parseGitHubStarCount', () => {
  it.each([
    [{ stargazers_count: 0 }, 0],
    [{ stargazers_count: 33 }, 33],
    [{ stargazers_count: 12_345 }, 12_345],
  ])('accepts a non-negative integer from GitHub', (payload, expected) => {
    expect(parseGitHubStarCount(payload)).toBe(expected);
  });

  it.each([
    null,
    {},
    { stargazers_count: -1 },
    { stargazers_count: 3.5 },
    { stargazers_count: '33' },
  ])('rejects missing or malformed repository data', (payload) => {
    expect(parseGitHubStarCount(payload)).toBeNull();
  });
});

describe('formatGitHubStarCount', () => {
  it('keeps small counts exact', () => {
    expect(formatGitHubStarCount(999)).toBe('999');
  });

  it('compacts four-digit counts for the header', () => {
    expect(formatGitHubStarCount(1_250)).toBe('1.3K');
  });

  it('avoids decimals for five-digit counts', () => {
    expect(formatGitHubStarCount(12_345)).toBe('12K');
  });
});
