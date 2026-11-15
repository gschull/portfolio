import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('SQL checklist is linked, indexed and included in the Pages build', () => {
  const path = 'sql-report-reconciliation.html';
  const page = read(path);
  assert.ok(read('index.html').includes(`href="./${path}"`));
  assert.ok(read('sitemap.xml').includes(`https://gschull.github.io/portfolio/${path}`));
  assert.ok(read('.github/workflows/deploy.yml').includes(`cp index.html ${path} sitemap.xml`));
  assert.ok(page.includes(`rel="canonical" href="https://gschull.github.io/portfolio/${path}"`));
  assert.ok(page.includes('href="./#contact"'));
});
