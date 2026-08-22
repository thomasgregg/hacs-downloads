# HACS Downloads

A multi-project download analytics dashboard for HACS repositories. It keeps the visual design of the original Oral-B Live dashboard, reads live release-asset counts from the public GitHub API, and deploys as a static GitHub Pages site.

## Tracked projects

- **Oral-B Live** — `thomasgregg/oralb-ha`, asset `oralb_live.zip`
- **ELCO Aerotop** — `thomasgregg/elco-aerotop`, asset `elco_aerotop.zip`

Only uploaded GitHub release assets have a public `download_count`. Repositories that rely on GitHub's automatic source archives cannot be measured by this dashboard until their release workflow uploads a dedicated asset.

## Local development

```bash
npm ci
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Add another project

Add one entry to the `PROJECTS` array near the top of `src/App.tsx`:

```ts
{
  id: 'repository-name',
  name: 'Display Name',
  owner: 'github-owner',
  repo: 'repository-name',
  assetName: 'integration.zip',
  mark: 'DN',
  description: 'the Display Name Home Assistant integration',
},
```

The selector, repository links, headings, accessibility labels, browser title, asset badge, cache, and shareable `?project=repository-name` URL update from this configuration.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the site after every push to `main`.

For the first deployment, open **Settings → Pages** in the GitHub repository and set **Source** to **GitHub Actions**. The resulting site is served at:

`https://thomasgregg.github.io/hacs-downloads/`
