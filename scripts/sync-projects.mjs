import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
export const sources = [
  { owner: "gschull", source: "personal", endpoint: "/users/gschull/repos?type=owner" },
  { owner: "stl-dev-ops", source: "organization", endpoint: "/orgs/stl-dev-ops/repos?type=public" }
];

export async function fetchRepositories(endpoint, fetcher = fetch, token = process.env.GH_TOKEN) {
  const repositories = [];
  for (let page = 1; ; page++) {
    const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetcher(`https://api.github.com${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`, {
      headers, signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`GitHub ${endpoint} page ${page}: HTTP ${response.status}`);
    if (response.status === 204) return repositories;
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`GitHub ${endpoint}: expected a repository array`);
    repositories.push(...batch);
    if (batch.length < 100) return repositories;
  }
}

export function buildProjects(inventories, curation) {
  const projects = [];
  for (const { config, repositories } of inventories) {
    for (const repo of repositories) {
      // Explicit public status prevents privileged tokens from exporting private metadata.
      if (repo.private !== false || repo.visibility && repo.visibility !== "public") continue;
      if (repo.owner?.login.toLowerCase() !== config.owner.toLowerCase()) continue;
      if (repo.contributionVerified !== true) continue;
      if (config.source === "personal" && repo.name.toLowerCase() === "portfolio") continue;
      if (!repo.name || !repo.html_url || !repo.pushed_at || Number.isNaN(Date.parse(repo.pushed_at))) {
        throw new Error(`Invalid public repository metadata for ${config.owner}`);
      }
      if (repo.html_url !== `https://github.com/${repo.owner.login}/${repo.name}`) {
        throw new Error(`Unexpected source URL for ${repo.name}`);
      }
      const key = `${config.owner}/${repo.name}`;
      const curated = curation[key] ?? {};
      projects.push({
        name: repo.name,
        owner: config.owner,
        source: config.source,
        visibility: "public",
        url: repo.html_url,
        description: curated.description || repo.description || `Public ${repo.language || "software"} repository. See its source and documentation for details.`,
        category: curated.category || "Other projects",
        tags: [...new Set([...(curated.tags || []), ...(repo.language ? [repo.language] : []), ...(repo.topics || [])])].slice(0, 8),
        note: curated.note || (config.source === "organization" ? "Organization-owned repository; inclusion does not imply sole authorship or verified contribution." : ""),
        featured: curated.featured === true,
        archived: repo.archived === true,
        fork: repo.fork === true,
        pushedAt: repo.pushed_at
      });
    }
  }
  return projects.sort((a, b) => Number(b.featured) - Number(a.featured) || Date.parse(b.pushedAt) - Date.parse(a.pushedAt) || a.url.localeCompare(b.url));
}

export function buildPrivateProjects(catalog) {
  if (!Array.isArray(catalog.projects) || Number.isNaN(Date.parse(catalog.reviewedAt))) {
    throw new Error("Invalid reviewed private-project catalog.");
  }
  const ids = new Set();
  const allowedKeys = new Set(["id", "name", "source", "description", "category", "tags", "note", "featured"]);
  return catalog.projects.map(project => {
    if (Object.keys(project).some(key => !allowedKeys.has(key)) ||
        !project.id || ids.has(project.id) || !project.name || !project.description ||
        !project.category || !Array.isArray(project.tags) ||
        !["personal", "organization"].includes(project.source)) {
      throw new Error("Invalid or duplicate sanitized private-project entry.");
    }
    ids.add(project.id);
    return {
      ...project,
      owner: project.source === "personal" ? "gschull" : "stl-dev-ops",
      visibility: "private-summary",
      reviewedAt: catalog.reviewedAt,
      featured: project.featured === true,
      note: [project.note, "Contribution verified during the private-source review. Internal names, source code, and implementation details are withheld."].filter(Boolean).join(" ")
    };
  });
}

export async function synchronize() {
  const curation = JSON.parse(await readFile(path.join(root, "data", "curation.json"), "utf8"));
  const catalog = JSON.parse(await readFile(path.join(root, "data", "private-projects.json"), "utf8"));
  const inventories = [];
  for (const config of sources) {
    const repositories = await fetchRepositories(config.endpoint);
    for (const repo of repositories) {
      if (repo.private !== false || repo.owner?.login.toLowerCase() !== config.owner.toLowerCase() ||
          config.source === "personal" && repo.name.toLowerCase() === "portfolio") continue;
      const contributors = await fetchRepositories(`/repos/${repo.owner.login}/${repo.name}/contributors`);
      repo.contributionVerified = contributors.some(contributor =>
        contributor.login?.toLowerCase() === "gschull" && contributor.contributions > 0
      );
    }
    inventories.push({ config, repositories });
  }
  const publicProjects = buildProjects(inventories, curation);
  if (!publicProjects.length) throw new Error("Refusing to replace the portfolio with an empty public snapshot.");
  const projects = [...publicProjects, ...buildPrivateProjects(catalog)]
    .sort((a, b) => Number(b.featured) - Number(a.featured));
  const snapshot = { updatedAt: new Date().toISOString(), projects };
  await writeFile(path.join(root, "data", "projects.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Refreshed ${publicProjects.length} public projects plus ${projects.length - publicProjects.length} reviewed private summaries.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  synchronize().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
