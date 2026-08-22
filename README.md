# HACS Download Analytics

A static, multi-repository dashboard for visualizing download activity across HACS projects. The dashboard reads release-asset statistics directly from the public GitHub API and presents totals, release trends, download share, and per-version details in a responsive interface.

The project requires no backend, database, analytics service, or GitHub token. It can be hosted on GitHub Pages and configured to monitor any number of compatible public repositories.

## Features

- Monitor multiple GitHub repositories from one dashboard
- Switch projects with a built-in repository selector
- Display total downloads and per-release download counts
- Compare release performance and download distribution
- Link directly to source repositories and individual releases
- Preserve the selected project in the URL and browser storage
- Cache recent results locally to reduce GitHub API usage
- Handle GitHub API rate limits with automatic retry behavior
- Deploy automatically to GitHub Pages with GitHub Actions

## How the data is collected

GitHub exposes a `download_count` for files uploaded to a release. For each configured project, the dashboard requests up to 100 published releases and finds the asset whose filename exactly matches the configured `assetName`.

This means a compatible repository must:

1. Be publicly accessible.
2. Publish GitHub releases.
3. Upload a dedicated release asset, such as a ZIP file, to each release.
4. Use a consistent asset filename across releases.

GitHub's automatically generated source-code archives are not release assets and do not expose the download count used by this dashboard. Draft releases and releases without the configured asset are excluded.

## Project configuration

Projects are defined in the `PROJECTS` array near the top of [`src/App.tsx`](src/App.tsx). Each object represents one repository and one release asset:

```ts
{
  id: 'project-id',
  name: 'Project Name',
  owner: 'github-owner',
  repo: 'github-repository',
  assetName: 'release-asset.zip',
  mark: 'PN',
  description: 'the Project Name Home Assistant integration',
},
```

| Field | Purpose |
| --- | --- |
| `id` | Unique, URL-safe identifier used in shareable links and browser cache keys. |
| `name` | Human-readable name shown throughout the dashboard and browser title. |
| `owner` | GitHub account or organization that owns the repository. |
| `repo` | GitHub repository name without the owner or URL. |
| `assetName` | Exact, case-sensitive filename of the uploaded release asset to count. |
| `mark` | Short initials displayed in the dashboard brand mark. |
| `description` | Project description used in the page metadata. |

### Add a project

1. Confirm that the repository has at least one published release containing the asset you want to track.
2. Add a new object to `PROJECTS` with a unique `id`.
3. Run `npm run dev` and select the project in the dashboard.
4. Confirm that the release totals appear and the repository and release links are correct.
5. Commit and push the change to deploy it.

The selector and all project-specific headings, labels, links, metadata, asset badges, cache entries, and shareable URLs are generated automatically from this configuration.

### Edit a project

Update the relevant object in `PROJECTS`. Changes to `name`, `owner`, `repo`, `assetName`, `mark`, or `description` take effect on the next build.

Avoid changing an existing `id` unless necessary. The identifier is part of the project's shareable URL and local cache key, so changing it invalidates old links and creates a new browser cache entry.

### Remove a project

Delete its object from `PROJECTS`. Also check any shared links that use its `?project=<id>` parameter. If a requested project no longer exists, the dashboard falls back to the default project.

### Change the default project

Move the desired project to the first position in `PROJECTS`. The first entry is used when there is no valid project in the URL or browser storage.

### Reorder projects

Reorder the objects in `PROJECTS`. The selector follows the same order as the array.

## Shareable project URLs

Selecting a project updates the query string without reloading the page:

```text
https://example.github.io/repository-name/?project=project-id
```

Opening that URL selects the matching project. When no valid query parameter is present, the dashboard restores the last selection saved in the browser or uses the first configured project.

## Local development

Requirements:

- Node.js 22.13 or newer
- npm

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Create and preview a production build:

```bash
npm run build
npm run preview
```

The production files are written to `dist/`.

## GitHub Pages deployment

The workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and deploys the dashboard whenever a commit is pushed to `main`. It can also be started manually from the repository's **Actions** tab.

To enable deployment:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push a commit to `main` or run the deployment workflow manually.

### Configure the Pages path

The Vite `base` value in [`vite.config.ts`](vite.config.ts) must match the GitHub Pages repository path:

```ts
export default defineConfig({
  base: '/repository-name/',
  plugins: [react()],
});
```

For a repository site, use `/<repository-name>/`. For a user or organization site served from the domain root, use `/`.

## Caching and GitHub API limits

The dashboard uses the unauthenticated public GitHub API. GitHub applies a shared rate limit to requests from the same public IP address. To conserve requests, each project's latest successful response is cached in `localStorage` and reused for five minutes.

If the limit is reached, the dashboard keeps any cached data visible, displays the retry time reported by GitHub, and retries automatically after the limit resets. No GitHub credentials are embedded in the client-side application.

For a high-traffic public deployment, consider routing requests through a small server-side proxy with appropriate caching and authentication. Do not place a GitHub access token in frontend code.

## Current limitations

- Only public repositories are supported by the client-side implementation.
- One exact asset filename is tracked per configured project.
- The dashboard requests the first 100 releases returned by the GitHub API.
- Download totals count asset downloads, not unique users or HACS installations.
- Historic counts are GitHub's current cumulative values; the dashboard does not store time-series snapshots.

## Technology

- React
- TypeScript
- Vite
- GitHub REST API
- GitHub Actions and GitHub Pages

## License

No license has been specified. Add a license file before redistributing or accepting third-party contributions.
