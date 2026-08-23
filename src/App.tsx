'use client';

import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  GitBranch,
  Info,
  Layers3,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type ProjectConfig = {
  id: string;
  name: string;
  owner: string;
  repo: string;
  assetName: string;
  mark: string;
  description: string;
};

type ReleaseMetric = {
  version: string;
  downloads: number;
  publishedAt: string;
  size: number;
  url: string;
};

type GitHubRelease = {
  tag_name: string;
  published_at: string | null;
  html_url: string;
  draft: boolean;
  assets: Array<{
    name: string;
    download_count: number;
    size: number;
  }>;
};

type DashboardSnapshot = {
  releases: ReleaseMetric[];
  updatedAt: string;
};

// Add another project here once its releases include an uploaded, countable asset.
const PROJECTS: readonly ProjectConfig[] = [
  {
    id: 'oralb-ha',
    name: 'Oral-B Live',
    owner: 'thomasgregg',
    repo: 'oralb-ha',
    assetName: 'oralb_live.zip',
    mark: 'OB',
    description: 'the Oral-B Live Home Assistant integration',
  },
  {
    id: 'elco-aerotop',
    name: 'ELCO Aerotop',
    owner: 'thomasgregg',
    repo: 'elco-aerotop',
    assetName: 'elco_aerotop.zip',
    mark: 'EA',
    description: 'the ELCO Aerotop Home Assistant integration',
  },
  {
    id: 'intex-ha',
    name: 'Intex SX2100',
    owner: 'thomasgregg',
    repo: 'intex-ha',
    assetName: 'intex_sx2100.zip',
    mark: 'IX',
    description: 'the Intex SX2100 Pool Pump Home Assistant integration',
  },
  {
    id: 'frigate-delivery-card',
    name: 'Frigate Delivery Card',
    owner: 'thomasgregg',
    repo: 'frigate-delivery-card',
    assetName: 'frigate-delivery-card.js',
    mark: 'FD',
    description: 'the Frigate Delivery Home Assistant dashboard card',
  },
];

const DEFAULT_PROJECT_ID = PROJECTS[0].id;
const LAST_PROJECT_KEY = 'hacs-downloads-selected-project-v1';
const RATE_LIMIT_RESET_KEY = 'hacs-downloads-rate-limit-reset-v1';
const REFRESH_INTERVAL_MS = 300_000;

function getProject(projectId: string) {
  return PROJECTS.find((candidate) => candidate.id === projectId) ?? PROJECTS[0];
}

function getInitialProjectId() {
  try {
    const queryProject = new URLSearchParams(window.location.search).get('project');
    if (queryProject && PROJECTS.some((project) => project.id === queryProject)) return queryProject;
    const storedProject = window.localStorage.getItem(LAST_PROJECT_KEY);
    if (storedProject && PROJECTS.some((project) => project.id === storedProject)) return storedProject;
  } catch {
    // The default project works when URL or storage access is unavailable.
  }
  return DEFAULT_PROJECT_ID;
}

function snapshotCacheKey(projectId: string) {
  return `hacs-downloads-snapshot-${projectId}-v1`;
}

function readRateLimitReset(): number | null {
  try {
    const resetAt = Number(window.localStorage.getItem(RATE_LIMIT_RESET_KEY));
    if (Number.isFinite(resetAt) && resetAt > Date.now()) return resetAt;
    window.localStorage.removeItem(RATE_LIMIT_RESET_KEY);
  } catch {
    // Rate-limit backoff still works for the current page without storage.
  }
  return null;
}

function readCachedSnapshot(projectId: string): DashboardSnapshot | null {
  try {
    const cached = window.localStorage.getItem(snapshotCacheKey(projectId));
    if (!cached) return null;
    const snapshot = JSON.parse(cached) as DashboardSnapshot;
    if (!Array.isArray(snapshot.releases) || !snapshot.releases.length || Number.isNaN(Date.parse(snapshot.updatedAt))) return null;
    const isValid = snapshot.releases.every((release) => (
      typeof release.version === 'string'
      && typeof release.downloads === 'number'
      && typeof release.publishedAt === 'string'
      && typeof release.size === 'number'
      && typeof release.url === 'string'
    ));
    return isValid ? snapshot : null;
  } catch {
    return null;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en').format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    month: 'short',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function timeAgo(date: Date | null) {
  if (!date) return 'Waiting for GitHub';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function StatCard({ label, value, note, icon, primary = false, loading = false }: { label: string; value: string; note: ReactNode; icon: ReactNode; primary?: boolean; loading?: boolean }) {
  return (
    <article className={`stat-card${primary ? ' stat-primary' : ''}${loading ? ' is-loading' : ''}`} aria-busy={loading}>
      <div className="stat-topline">
        <span className="stat-label">{label}</span>
        <span className="stat-icon" aria-hidden="true">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

export default function Home() {
  const [projectId, setProjectId] = useState(getInitialProjectId);
  const project = useMemo(() => getProject(projectId), [projectId]);
  const [initialSnapshot] = useState(() => readCachedSnapshot(projectId));
  const [initialRateLimitReset] = useState(readRateLimitReset);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(initialSnapshot);
  const [status, setStatus] = useState<'limited' | 'loading' | 'ready' | 'stale'>(initialRateLimitReset ? 'limited' : 'loading');
  const [refreshState, setRefreshState] = useState<'idle' | 'refreshing' | 'updated' | 'error'>('idle');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => initialSnapshot ? new Date(initialSnapshot.updatedAt) : null);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(initialRateLimitReset);
  const [range, setRange] = useState<'all' | 'recent'>('all');
  const requestSequence = useRef(0);
  const inFlightProject = useRef<string | null>(null);
  const rateLimitResetRef = useRef<number | null>(initialRateLimitReset);

  const refresh = useCallback(async (force = false) => {
    const resetAt = rateLimitResetRef.current;
    if (resetAt && resetAt > Date.now()) {
      setStatus('limited');
      setRefreshState('error');
      return;
    }
    if (resetAt) {
      rateLimitResetRef.current = null;
      setRateLimitReset(null);
      try {
        window.localStorage.removeItem(RATE_LIMIT_RESET_KEY);
      } catch {
        // Continue with the live request when storage is unavailable.
      }
    }

    const cachedSnapshot = readCachedSnapshot(project.id);
    const cacheAge = cachedSnapshot ? Date.now() - Date.parse(cachedSnapshot.updatedAt) : Number.POSITIVE_INFINITY;
    if (!force && cachedSnapshot && cacheAge < REFRESH_INTERVAL_MS) {
      setSnapshot(cachedSnapshot);
      setLastUpdated(new Date(cachedSnapshot.updatedAt));
      setStatus('ready');
      setRefreshState('idle');
      return;
    }
    if (inFlightProject.current === project.id) return;

    const requestId = ++requestSequence.current;
    inFlightProject.current = project.id;
    setStatus('loading');
    setRefreshState('refreshing');
    try {
      const response = await fetch(`https://api.github.com/repos/${project.owner}/${project.repo}/releases?per_page=100`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!response.ok) {
        const remaining = response.headers.get('X-RateLimit-Remaining');
        if (response.status === 403 && remaining === '0') {
          const resetSeconds = Number(response.headers.get('X-RateLimit-Reset'));
          const parsedReset = resetSeconds * 1000;
          const nextReset = Number.isFinite(parsedReset) && parsedReset > Date.now() ? parsedReset : Date.now() + REFRESH_INTERVAL_MS;
          rateLimitResetRef.current = nextReset;
          setRateLimitReset(nextReset);
          try {
            window.localStorage.setItem(RATE_LIMIT_RESET_KEY, String(nextReset));
          } catch {
            // The current page still respects the rate-limit reset.
          }
          if (requestId === requestSequence.current) {
            setStatus('limited');
            setRefreshState('error');
          }
          return;
        }
        throw new Error(`GitHub returned ${response.status}`);
      }
      const payload = await response.json() as GitHubRelease[];
      const metrics = payload.flatMap((release) => {
        const asset = release.assets.find((candidate) => candidate.name === project.assetName);
        if (!asset || release.draft || !release.published_at) return [];
        return [{
          version: release.tag_name,
          downloads: asset.download_count,
          publishedAt: release.published_at,
          size: asset.size,
          url: release.html_url,
        }];
      }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      if (metrics.length === 0) throw new Error('No tracked assets found');
      if (requestId !== requestSequence.current) return;

      const updatedAt = new Date().toISOString();
      const nextSnapshot = { releases: metrics, updatedAt };
      setSnapshot(nextSnapshot);
      setLastUpdated(new Date(updatedAt));
      try {
        window.localStorage.setItem(snapshotCacheKey(project.id), JSON.stringify(nextSnapshot));
      } catch {
        // The live dashboard still works when storage is unavailable.
      }
      setStatus('ready');
      setRefreshState('updated');
    } catch {
      if (requestId !== requestSequence.current) return;
      setStatus('stale');
      setRefreshState('error');
    } finally {
      if (inFlightProject.current === project.id) inFlightProject.current = null;
    }
  }, [project]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!rateLimitReset) return;
    const delay = Math.max(0, rateLimitReset - Date.now() + 1_000);
    const timer = window.setTimeout(() => {
      rateLimitResetRef.current = null;
      setRateLimitReset(null);
      try {
        window.localStorage.removeItem(RATE_LIMIT_RESET_KEY);
      } catch {
        // Continue with the automatic retry when storage is unavailable.
      }
      void refresh(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [rateLimitReset, refresh]);

  useEffect(() => {
    if (refreshState !== 'updated') return;
    const timer = window.setTimeout(() => setRefreshState('idle'), 2_400);
    return () => window.clearTimeout(timer);
  }, [refreshState]);

  useEffect(() => {
    const title = `${project.name} · HACS Download Analytics`;
    const description = `Live GitHub release download analytics for ${project.description}.`;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  }, [project]);

  const selectProject = (nextProjectId: string) => {
    const nextProject = getProject(nextProjectId);
    const cachedSnapshot = readCachedSnapshot(nextProject.id);
    requestSequence.current += 1;
    setProjectId(nextProject.id);
    setSnapshot(cachedSnapshot);
    setLastUpdated(cachedSnapshot ? new Date(cachedSnapshot.updatedAt) : null);
    setStatus(rateLimitResetRef.current && rateLimitResetRef.current > Date.now() ? 'limited' : 'loading');
    setRefreshState('idle');
    setRange('all');
    try {
      window.localStorage.setItem(LAST_PROJECT_KEY, nextProject.id);
      const url = new URL(window.location.href);
      url.searchParams.set('project', nextProject.id);
      window.history.replaceState({}, '', url);
    } catch {
      // Selection remains functional without storage or history access.
    }
  };

  const releases = snapshot?.releases ?? [];

  const summary = useMemo(() => {
    if (!releases.length) return null;
    const total = releases.reduce((sum, release) => sum + release.downloads, 0);
    const leader = [...releases].sort((a, b) => b.downloads - a.downloads)[0];
    const activeCount = Math.max(1, releases.filter((release) => release.downloads > 0).length);
    return {
      total,
      latest: releases[0],
      leader,
      leaderShare: total ? Math.round((leader.downloads / total) * 100) : 0,
      average: Math.round(total / activeCount),
    };
  }, [releases]);

  const chartReleases = useMemo(() => {
    const selected = range === 'recent' ? releases.slice(0, 5) : releases;
    return [...selected].reverse();
  }, [range, releases]);
  const maxDownloads = Math.max(1, ...chartReleases.map((release) => release.downloads));
  const isInitialLoad = !summary && status === 'loading';
  const emptyNote = isInitialLoad
    ? 'Loading live GitHub data…'
    : status === 'limited'
      ? 'GitHub rate limit reached; retry is automatic'
      : 'GitHub data is temporarily unavailable';
  const repositoryUrl = `https://github.com/${project.owner}/${project.repo}`;

  return (
    <main className="dashboard-shell" id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="HACS Downloads analytics home">
          <span className="brand-mark" aria-hidden="true">{project.mark}</span>
          <span>
            <strong>HACS Downloads</strong>
            <small>{project.name} analytics</small>
          </span>
        </a>
        <div className="header-actions">
          <label className="project-selector">
            <span className="sr-only">Tracked project</span>
            <Layers3 size={14} aria-hidden="true" />
            <select value={project.id} onChange={(event) => selectProject(event.target.value)}>
              {PROJECTS.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}
            </select>
            <ChevronDown className="selector-chevron" size={13} aria-hidden="true" />
          </label>
          <span className={`live-pill status-${status}`}>
            <i /> {status === 'limited' ? 'GitHub rate limit' : status === 'stale' ? (summary ? 'Recent snapshot' : 'Data unavailable') : status === 'loading' ? 'Connecting…' : 'Live from GitHub'}
          </span>
          <a className="github-button" href={repositoryUrl} target="_blank" rel="noreferrer">
            <GitBranch size={14} aria-hidden="true" /> <span className="github-label">Repository</span> <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow"><Sparkles size={13} /> Project adoption dashboard</p>
          <h1>HACS downloads,<br />made visible.</h1>
          <p className="hero-copy">A clear, live view of release asset downloads across every tracked release of <strong>{project.name}</strong>.</p>
        </div>
        <div className="hero-refresh">
          <span>Last refreshed</span>
          <strong>{timeAgo(lastUpdated)}</strong>
          <button
            type="button"
            className={`refresh-button state-${refreshState}`}
            onClick={() => void refresh(true)}
            aria-label={`Refresh ${project.name} download data`}
            disabled={refreshState === 'refreshing' || status === 'limited'}
          >
            {refreshState === 'updated'
              ? <Check size={14} aria-hidden="true" />
              : <RefreshCw size={14} className={refreshState === 'refreshing' ? 'is-spinning' : ''} aria-hidden="true" />}
            <span aria-live="polite">
              {status === 'limited' && rateLimitReset
                ? `Retry at ${formatTime(rateLimitReset)}`
                : refreshState === 'refreshing'
                ? 'Refreshing…'
                : refreshState === 'updated'
                  ? 'Updated'
                  : refreshState === 'error'
                    ? 'Try again'
                    : 'Refresh data'}
            </span>
          </button>
        </div>
      </section>

      <section className="stats-grid" aria-label={`${project.name} download summary`}>
        <StatCard primary loading={isInitialLoad} label="Total downloads" value={summary ? formatNumber(summary.total) : '—'} icon={<Download size={18} />} note={summary ? <>Across {releases.length} tracked releases</> : emptyNote} />
        <StatCard loading={isInitialLoad} label="Latest release" value={summary ? formatNumber(summary.latest.downloads) : '—'} icon={<Activity size={18} />} note={summary ? <><span className="version-chip">{summary.latest.version}</span> asset downloads</> : emptyNote} />
        <StatCard loading={isInitialLoad} label="Most downloaded" value={summary ? formatNumber(summary.leader.downloads) : '—'} icon={<TrendingUp size={18} />} note={summary ? <><span className="version-chip">{summary.leader.version}</span> · {summary.leaderShare}% of total</> : emptyNote} />
        <StatCard loading={isInitialLoad} label="Active-release avg." value={summary ? formatNumber(summary.average) : '—'} icon={<BarChart3 size={18} />} note={summary ? <>Average among downloaded versions</> : emptyNote} />
      </section>

      <section className="analytics-grid">
        <article className="panel chart-card" aria-labelledby="release-performance-title">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Release performance</p>
              <h2 id="release-performance-title">Downloads by version</h2>
            </div>
            <div className="segmented-control" aria-label="Chart range">
              <button className={range === 'all' ? 'active' : ''} onClick={() => setRange('all')} type="button">All</button>
              <button className={range === 'recent' ? 'active' : ''} onClick={() => setRange('recent')} type="button">Recent 5</button>
            </div>
          </div>
          <div className="chart-area">
            <span className="grid-line grid-line-100" />
            <span className="grid-line grid-line-50" />
            <div className="bar-chart" role="img" aria-label={`Bar chart showing ${project.name} release asset downloads by version`}>
              {!summary && <div className={`data-placeholder${isInitialLoad ? ' is-loading' : ''}`}>{emptyNote}</div>}
              {chartReleases.map((release) => (
                <a className="bar-column" href={release.url} target="_blank" rel="noreferrer" key={release.version} aria-label={`${release.version}: ${release.downloads} downloads`}>
                  <span className="bar-value">{release.downloads || '–'}</span>
                  <div className="bar-track">
                    <span style={{ height: `${Math.max((release.downloads / maxDownloads) * 100, release.downloads ? 7 : 0)}%` }} />
                  </div>
                  <span className="bar-label">{release.version}</span>
                </a>
              ))}
            </div>
          </div>
          <p className="chart-caption">Versions are shown chronologically. Select a bar to open its GitHub release.</p>
        </article>

        <aside className="panel insight-card" aria-labelledby="distribution-title">
          <div className="card-heading compact">
            <div>
              <p className="eyebrow">Distribution</p>
              <h2 id="distribution-title">Download share</h2>
            </div>
            <Package size={18} aria-hidden="true" />
          </div>
          {summary ? <>
            <div className="donut-wrap">
              <div className="donut" style={{ '--share': `${summary.leaderShare * 3.6}deg` } as CSSProperties}>
                <div><strong>{summary.leaderShare}%</strong><span>top version</span></div>
              </div>
            </div>
            <div className="leader-row">
              <span><i /> {summary.leader.version}</span>
              <strong>{formatNumber(summary.leader.downloads)}</strong>
            </div>
            <div className="leader-row secondary">
              <span><i /> Other releases</span>
              <strong>{formatNumber(summary.total - summary.leader.downloads)}</strong>
            </div>
            <div className="insight-note">
              <TrendingUp size={16} />
              <p><strong>{summary.leader.version}</strong> currently drives most tracked download activity.</p>
            </div>
          </> : <div className={`insight-placeholder${isInitialLoad ? ' is-loading' : ''}`}>{emptyNote}</div>}
        </aside>
      </section>

      <section className="panel releases-panel" aria-labelledby="release-table-title">
        <div className="card-heading table-heading">
          <div>
            <p className="eyebrow">Detailed breakdown</p>
            <h2 id="release-table-title">Tracked releases</h2>
          </div>
          <span className="asset-pill"><Package size={13} /> {project.assetName}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Version</th><th>Published</th><th>Asset size</th><th>Share</th><th className="align-right">Downloads</th><th><span className="sr-only">Open</span></th></tr>
            </thead>
            <tbody>
              {!summary && <tr className="empty-row"><td colSpan={6}>{emptyNote}</td></tr>}
              {releases.map((release, index) => {
                const share = summary?.total ? Math.round((release.downloads / summary.total) * 100) : 0;
                return (
                  <tr key={release.version}>
                    <td><span className="release-version">{release.version}</span>{index === 0 && <span className="latest-tag">Latest</span>}</td>
                    <td><span className="date-cell"><CalendarDays size={14} /> {formatDate(release.publishedAt)}</span></td>
                    <td>{Math.round(release.size / 1024)} KB</td>
                    <td><span className="share-cell"><i><b style={{ width: `${share}%` }} /></i>{share}%</span></td>
                    <td className="align-right"><strong className="download-count">{formatNumber(release.downloads)}</strong></td>
                    <td><a className="row-link" href={release.url} target="_blank" rel="noreferrer" aria-label={`Open ${release.version} release`}><ExternalLink size={14} /></a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="method-card">
        <Info size={18} aria-hidden="true" />
        <div><strong>What this measures</strong><p>GitHub counts every tracked release asset download, including first installs, upgrades and redownloads. It is a useful adoption signal, but it is not a unique-user count.</p></div>
        <a href="https://docs.github.com/en/rest/releases/assets#about-release-assets" target="_blank" rel="noreferrer">Methodology <ExternalLink size={12} /></a>
      </section>

      <footer>
        <span>HACS Downloads · {project.name}</span>
        <span>Data refreshes automatically every 5 minutes</span>
      </footer>
    </main>
  );
}
