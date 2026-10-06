import { describe, expect, it } from 'vitest';
import { buildGrowthSeries } from './App';
import { parseGitHubStarCount } from './github';

const history = {
  schemaVersion: 1 as const,
  snapshots: [
    { capturedAt: '2026-10-01T04:17:00Z', projects: { example: { total: 100, releases: {} } } },
    { capturedAt: '2026-10-02T04:17:00Z', projects: { example: { total: 100, releases: {}, stars: 10 } } },
    { capturedAt: '2026-10-03T04:17:00Z', projects: { example: { total: 100, releases: {}, stars: 13 } } },
    { capturedAt: '2026-10-04T04:17:00Z', projects: { example: { total: 100, releases: {}, stars: 12 } } },
    { capturedAt: '2026-10-11T04:17:00Z', projects: { example: { total: 100, releases: {}, stars: 0 } } },
  ],
};
const stars = (snapshot: { stars?: number }) => parseGitHubStarCount({ stargazers_count: snapshot.stars }) ?? Number.NaN;

describe('star growth history', () => {
  it('ignores snapshots without stars and preserves net decreases', () => {
    const result = buildGrowthSeries({ ...history, snapshots: history.snapshots.slice(0, 4) }, 'example', 'daily', stars);
    expect(result.map(point => point.value)).toEqual([3, -1]);
  });
  it('compares weekly endpoints and accepts zero stars', () => {
    expect(buildGrowthSeries(history, 'example', 'weekly', stars).map(point => point.value)).toEqual([-12]);
  });
  it('waits for a baseline instead of treating missing stars as zero', () => {
    expect(buildGrowthSeries({ ...history, snapshots: history.snapshots.slice(0, 2) }, 'example', 'daily', stars)).toEqual([]);
  });
});
