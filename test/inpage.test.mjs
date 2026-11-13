import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-wallpaper-test-'));
const WEB_DIR = path.join(ROOT, 'resources', 'desktop-dist');
const DATA_DIR = path.join(ROOT, 'data');
process.env.KIMI_CODE_APP = path.join(ROOT, 'Kimi Code.exe');
process.env.KIMI_WALLPAPER_HOME = DATA_DIR;
fs.mkdirSync(WEB_DIR, { recursive: true });

const { installInPage, removeInPage } = await import('../lib/inpage.mjs');

const INDEX = path.join(WEB_DIR, 'index.html');
const MODULE_TAG = '<script type="module" src="/assets/index.js"></script>';
const WALLPAPER_START = '<!-- kimi-wallpaper:inpage:start -->';
const WALLPAPER_END = '<!-- kimi-wallpaper:inpage:end -->';
const SKILL_START = '<!-- kimi-skill-mcp:inpage:start -->';
const SKILL_END = '<!-- kimi-skill-mcp:inpage:end -->';
const SKILL_BLOCK = `${SKILL_START}
<script src="/assets/kimi-skill-mcp/kimi-skill-mcp.js?v=abc"></script>
${SKILL_END}`;
const TOKEN_BLOCK = `<!-- kimi-token-usage:inpage:start -->
<script src="/assets/kimi-token-usage/kimi-token-usage.js?v=def"></script>
<!-- kimi-token-usage:inpage:end -->`;
const BASE_HTML = `<!doctype html>
<html>
<head><title>test</title></head>
<body>
<div id="app"></div>
</body>
${MODULE_TAG}
</html>
`;

function resetIndex(html = BASE_HTML) {
  fs.writeFileSync(INDEX, html);
}

function readIndex() {
  return fs.readFileSync(INDEX, 'utf8');
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function install() {
  return installInPage({ quiet: true });
}

test.after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
});

test('install preserves and deduplicates nested plugin registrations', () => {
  resetIndex();
  assert.equal(install().ok, true);
  assert.equal(install().changed, false);
  assert.equal(install().changed, false);

  let html = readIndex();
  assert.equal(count(html, WALLPAPER_START), 1);
  assert.equal(count(html, '/assets/kimi-wallpaper/kimi-wallpaper.js'), 1);

  // kimi-skill-mcp registers inside the wallpaper block when it sees one.
  html = html.replace(WALLPAPER_END, `\n${SKILL_BLOCK}\n${WALLPAPER_END}`);
  resetIndex(html);

  for (let i = 0; i < 3; i += 1) {
    assert.equal(install().changed, false);
  }

  html = readIndex();
  assert.equal(count(html, WALLPAPER_START), 1);
  assert.equal(count(html, WALLPAPER_END), 1);
  assert.equal(count(html, '/assets/kimi-wallpaper/kimi-wallpaper.js'), 1);
  assert.equal(count(html, SKILL_START), 1);
  assert.equal(count(html, SKILL_END), 1);
  assert.ok(html.indexOf('/assets/kimi-wallpaper/kimi-wallpaper.js') < html.indexOf(SKILL_START));
  assert.ok(html.indexOf(SKILL_END) < html.indexOf(WALLPAPER_END));
});

test('duplicate and multiple nested registrations keep one copy each in order', () => {
  resetIndex();
  install();

  let html = readIndex();
  html = html.replace(WALLPAPER_END, `${SKILL_BLOCK}\n${TOKEN_BLOCK}\n${SKILL_BLOCK}\n${WALLPAPER_END}`);
  resetIndex(html);

  assert.equal(install().changed, true);
  assert.equal(install().changed, false);

  html = readIndex();
  assert.equal(count(html, SKILL_START), 1);
  assert.equal(count(html, TOKEN_BLOCK), 1);
  assert.ok(html.indexOf('/assets/kimi-wallpaper/kimi-wallpaper.js') < html.indexOf(SKILL_START));
  assert.ok(html.indexOf(SKILL_END) < html.indexOf('<!-- kimi-token-usage:inpage:start -->'));
  assert.ok(html.indexOf('<!-- kimi-token-usage:inpage:end -->') < html.indexOf(WALLPAPER_END));
});

test('removeInPage keeps nested registrations as standalone blocks', () => {
  resetIndex();
  install();

  let html = readIndex();
  html = html.replace(WALLPAPER_END, `${SKILL_BLOCK}\n${WALLPAPER_END}`);
  resetIndex(html);
  install();

  assert.equal(removeInPage().ok, true);

  html = readIndex();
  assert.equal(html.includes(WALLPAPER_START), false);
  assert.equal(html.includes('/assets/kimi-wallpaper/kimi-wallpaper.js'), false);
  assert.equal(count(html, SKILL_START), 1);
  assert.equal(count(html, SKILL_END), 1);
  assert.ok(html.indexOf(SKILL_START) < html.indexOf(MODULE_TAG));
  assert.ok(html.indexOf(SKILL_END) < html.indexOf(MODULE_TAG));

  assert.equal(removeInPage().ok, true);
  html = readIndex();
  assert.equal(count(html, SKILL_START), 1);
  assert.ok(html.indexOf(SKILL_START) < html.indexOf(MODULE_TAG));
});
