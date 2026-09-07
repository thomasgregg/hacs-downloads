import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsPath = path.join(projectRoot, 'src', 'projects.json');
const historyPath = path.join(projectRoot, 'public', 'download-history.json');
const githubApiVersion = '2022-11-28';
const retentionDays = 400;

function resolveAssetName(project, tag) {
  if (project.assetName) return project.assetName;
  const version = tag.replace(/^v/i, '');
  return project.assetNameTemplate
    .replaceAll('{tag}', tag)
    .replaceAll('{version}', version);
}

async function fetchProject(project) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hacs-downloads-history',
    'X-GitHub-Api-Version': githubApiVersion,
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(`https://api.github.com/repos/${project.owner}/${project.repo}/releases?per_page=100`, { headers });
  if (!response.ok) throw new Error(`${project.owner}/${project.repo}: GitHub returned ${response.status}`);

  const payload = await response.json();
  const releases = Object.fromEntries(payload.flatMap((release) => {
    if (release.draft || !release.published_at) return [];
    const expectedAssetName = resolveAssetName(project, release.tag_name);
    const asset = release.assets.find((candidate) => candidate.name === expectedAssetName);
    return asset ? [[release.tag_name, asset.download_count]] : [];
  }));

  return {
    total: Object.values(releases).reduce((sum, downloads) => sum + downloads, 0),
    releases,
  };
}

const projects = JSON.parse(await readFile(projectsPath, 'utf8'));
const history = JSON.parse(await readFile(historyPath, 'utf8'));
const capturedAt = new Date().toISOString();
const capturedDate = capturedAt.slice(0, 10);
const projectEntries = await Promise.all(projects.map(async (project) => [project.id, await fetchProject(project)]));
const nextSnapshot = { capturedAt, projects: Object.fromEntries(projectEntries) };
const retentionStart = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
const retainedSnapshots = history.snapshots.filter((snapshot) => (
  Date.parse(snapshot.capturedAt) >= retentionStart
  && snapshot.capturedAt.slice(0, 10) !== capturedDate
));

retainedSnapshots.push(nextSnapshot);
retainedSnapshots.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));

await writeFile(historyPath, `${JSON.stringify({ schemaVersion: 1, snapshots: retainedSnapshots }, null, 2)}\n`);
console.log(`Captured ${capturedDate}: ${projectEntries.length} projects, ${retainedSnapshots.length} retained snapshots.`);
