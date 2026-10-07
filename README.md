# gschull / Engineering portfolio

A responsive engineering portfolio covering **verified contributions** to personal and **stl-dev-ops** projects: desktop applications, production reporting, systems automation, APIs, developer tooling, and research.

Public projects link to their source. Private work is represented by purpose, relevant skills, and carefully generalized descriptions, without internal project names, code, private links, credentials, customer information, or infrastructure details.

## Contribution scope and privacy

The initial review examined 23 personal and 99 organization repositories. GitHub's contributor lists identified gschull commit contributions in **99 repositories: 22 personal and 77 organization projects**. The portfolio includes **9 public projects and 90 sanitized private-project summaries**.

Repositories with no account-linked contribution evidence were excluded, including repositories owned by the account. Contributor evidence can miss work committed under unlinked identities or non-commit work; exclusions are conservative, not a claim that no work occurred.

Private project titles are descriptive aliases, not actual repository names. Skills and summaries reflect the reviewed documentation or explicit repository metadata. Where detailed documentation was unavailable, the description stays limited rather than inventing functionality. Contributions are not claims of sole authorship, production readiness, specific performance outcomes, employment history, or investment results.

Organization projects remain attributed to stl-dev-ops. Initial private-source evidence and raw repository inventories are **not included in this repository**. Only approved, sanitized summaries are published.

## Preview and validation

Requires Node.js 22 or newer; no dependencies need installing.

```powershell
node scripts/serve.mjs
node --test tests/sync-projects.test.mjs
```

The preview is http://127.0.0.1:4173. Use the preview server rather than opening the HTML directly because browsers restrict JSON requests from file URLs.

## Keep it current

```powershell
node scripts/sync-projects.mjs
```

- [Public project curation](data/curation.json): reviewed descriptions, skills, categories, and caveats.
- [Private work summaries](data/private-projects.json): manually reviewed, generalized entries. No source URLs or internal repository mapping fields are permitted.
- [Generated catalog](data/projects.json): the website's public-safe snapshot.
- [Refresh workflow](.github/workflows/refresh.yml): runs Mondays at 09:23 UTC, on manual dispatch, and after relevant maintenance changes.
- [Deployment workflow](.github/workflows/deploy.yml): deploys the static website to GitHub Pages after site changes or a successful refresh.

The refresh fetches all pages of public repositories and contributor lists, includes only projects with account-linked commit contributions, and excludes the portfolio itself. New verified public projects use the repository description until a reviewed description is added. Archived repositories and forks are explicitly labeled.

API errors fail the refresh visibly and preserve the last snapshot. Public repositories that disappear or become private are removed from the public inventory. Reviewed descriptions do not automatically change when the original README changes.

**Private work requires a deliberate review.** The public workflow never receives a token capable of reading private organization projects, never fetches private source, and never auto-publishes private metadata. When adding or updating private summaries, privately reverify contributions, confirm current disclosure permission, generalize internal identifiers, and update the catalog review date. Remove summaries when authorization changes; changing a repository's visibility cannot automatically revoke an independently reviewed summary.

An optional `GH_TOKEN` environment variable can raise GitHub API rate limits locally. Never commit a token. The public workflow uses the repository-scoped GitHub Actions token.

## Deployment

GitHub Pages must be configured with **GitHub Actions** as its build source. The deploy workflow publishes only the HTML, CSS, JavaScript, and generated project catalog, not maintenance scripts or source inventories. The website and repository are public.

GitHub Actions must remain enabled with the workflow's contents-write permission for refreshed snapshot commits. Deployment uses its own Pages permission. A successful refresh triggers a deployment through `workflow_run`, including when the refresh commit uses the Actions token.

## Content safeguards

- Private summaries have no clickable private repository links.
- Browser rendering uses text content rather than HTML injection.
- Research and scaffold projects carry appropriate limitations.
- Tests cover pagination, contribution filtering, public-only metadata handling, organization attribution, approved private-summary fields, and API failures.
