import test from "node:test";
import assert from "node:assert/strict";
import { buildProjects, buildPrivateProjects, fetchRepositories, sources } from "../scripts/sync-projects.mjs";

const repository = overrides => ({
  name: "example", owner: { login: "gschull" }, private: false, visibility: "public",
  html_url: "https://github.com/gschull/example", pushed_at: "2026-01-01T00:00:00Z",
  language: "Python", topics: [], contributionVerified: true, ...overrides
});
const inventory = repositories => [{ config: sources[0], repositories }];

test("exports only explicitly public repositories belonging to the expected owner", () => {
  const result = buildProjects(inventory([
    repository({}), repository({ private: true }), repository({ private: undefined }),
    repository({ visibility: "internal" }), repository({ owner: { login: "another-owner" } }),
    repository({ name: "portfolio", html_url: "https://github.com/gschull/portfolio" })
  ]), {});
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://github.com/gschull/example");
});

test("preserves curation and handles uncurated, archived, and forked projects", () => {
  const result = buildProjects(inventory([repository({ archived: true, fork: true })]), {
    "gschull/example": { description: "Reviewed summary", category: "Tooling", tags: ["Python"], featured: true }
  });
  assert.equal(result[0].description, "Reviewed summary");
  assert.deepEqual(result[0].tags, ["Python"]);
  assert.equal(result[0].archived, true);
  assert.equal(result[0].fork, true);
  assert.equal(buildProjects(inventory([repository({})]), {})[0].category, "Other projects");
});

test("keeps organization attribution separate from personal ownership", () => {
  const result = buildProjects([{ config: sources[1], repositories: [
    repository({ owner: { login: "stl-dev-ops" }, html_url: "https://github.com/stl-dev-ops/example" })
  ] }], {});
  assert.equal(result[0].source, "organization");
  assert.match(result[0].note, /does not imply sole authorship/);
});

test("rejects invalid dates and unexpected URLs", () => {
  assert.throws(() => buildProjects(inventory([repository({ pushed_at: "invalid" })]), {}), /Invalid/);
  assert.throws(() => buildProjects(inventory([repository({ html_url: "javascript:alert(1)" })]), {}), /Unexpected/);
});

test("fetches every page and does not truncate a 100-repository page", async () => {
  const requested = [];
  const result = await fetchRepositories("/users/gschull/repos", async url => {
    requested.push(url);
    return { ok: true, json: async () => requested.length === 1 ? Array.from({ length: 100 }, () => repository({})) : [repository({})] };
  }, "");
  assert.equal(result.length, 101);
  assert.match(requested[1], /page=2/);
});

test("surfaces API failures and invalid responses", async () => {
  await assert.rejects(fetchRepositories("/users/gschull/repos", async () => ({ ok: false, status: 403 }), ""), /HTTP 403/);
  await assert.rejects(fetchRepositories("/users/gschull/repos", async () => ({ ok: true, json: async () => ({ message: "bad response" }) }), ""), /expected a repository array/);
});

test("excludes public projects without verified account contributions", () => {
  assert.equal(buildProjects(inventory([repository({ contributionVerified: false })]), {}).length, 0);
});

test("private summaries reject source URLs, internal mapping fields and duplicate IDs", () => {
  const project = { id: "example", name: "Automation tool", source: "personal", category: "Automation", description: "High-level purpose.", tags: ["Python"] };
  const catalog = projects => ({ reviewedAt: "2026-10-07T00:00:00Z", projects });
  const safe = buildPrivateProjects(catalog([project]))[0];
  assert.equal(safe.visibility, "private-summary");
  assert.equal(safe.url, undefined);
  assert.throws(() => buildPrivateProjects(catalog([{ ...project, url: "https://github.com/private/project" }])), /Invalid/);
  assert.throws(() => buildPrivateProjects(catalog([{ ...project, repo: "internal-project" }])), /Invalid/);
  assert.throws(() => buildPrivateProjects(catalog([project, project])), /duplicate/);
});

test("empty GitHub repositories return no contributor evidence", async () => {
  assert.deepEqual(await fetchRepositories("/repos/example/empty/contributors", async () => ({ ok: true, status: 204 }), ""), []);
});
