import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  BUNDLE_NAME,
  DATA_DIR,
  INPAGE_ASSET_DIR,
  VERSION,
  WEB_DIR,
  logLine,
  writeTextAtomic,
} from './paths.mjs';
import { readConfig, wallpaperFilesIn } from './config.mjs';

export const MARKER_START = '<!-- kimi-wallpaper:inpage:start -->';
export const MARKER_END = '<!-- kimi-wallpaper:inpage:end -->';
export const OVERLAY_MARKER_START = '<!-- kimi-wallpaper:overlay:start -->';
export const OVERLAY_MARKER_END = '<!-- kimi-wallpaper:overlay:end -->';

const BUNDLE_SOURCE = path.join(WEB_DIR, 'inpage', 'wallpaper.js');
const OVERLAY_SOURCE = path.join(WEB_DIR, 'inpage', 'overlay.js');
const OVERLAY_HTML = 'browser-overlay.html';

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function bundleHash(bundle) {
  return crypto.createHash('sha1').update(bundle).digest('hex').slice(0, 10);
}

function firstExisting(candidates) {
  for (const file of candidates) {
    if (!file) continue;
    try {
      if (fs.statSync(file).isFile()) return file;
    } catch {
      // keep looking
    }
  }
  return null;
}

function runningAppPath() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "(Get-Process -Name 'Kimi Code' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)",
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 4000 }
    );
    return out.trim() || null;
  } catch {
    return null;
  }
}

function commonAppPaths() {
  const out = [];
  const local = process.env.LOCALAPPDATA;
  const pf = process.env.ProgramFiles;
  const pf86 = process.env['ProgramFiles(x86)'];
  if (process.platform === 'win32') {
    for (const base of [local && path.join(local, 'Programs'), pf, pf86]) {
      if (base) out.push(path.join(base, 'Kimi Code', 'Kimi Code.exe'));
    }
    for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
      out.push(`${letter}:\\Kimi Code\\Kimi Code.exe`);
      out.push(`${letter}:\\Program Files\\Kimi Code\\Kimi Code.exe`);
    }
  }
  if (process.platform === 'darwin') {
    out.push('/Applications/Kimi Code.app/Contents/MacOS/Kimi Code');
    out.push(path.join(os.homedir(), 'Applications', 'Kimi Code.app', 'Contents', 'MacOS', 'Kimi Code'));
  }
  if (process.platform === 'linux') {
    out.push('/opt/Kimi Code/kimi-code');
    out.push('/usr/lib/kimi-code/kimi-code');
    out.push(path.join(os.homedir(), '.local', 'share', 'kimi-code', 'kimi-code'));
  }
  return out;
}

function webDirFor(exe) {
  const root = path.dirname(exe);
  const candidates =
    process.platform === 'darwin'
      ? [path.join(root, '..', 'Resources', 'desktop-dist'), path.join(root, 'desktop-dist')]
      : [path.join(root, 'resources', 'desktop-dist'), path.join(root, 'desktop-dist')];
  for (const dir of candidates) {
    try {
      if (fs.statSync(path.join(dir, 'index.html')).isFile()) return { root, webDir: dir };
    } catch {
      // keep looking
    }
  }
  return null;
}

let cachedApp = null;
let cachedAppAt = 0;

export function findKimiCodeApp({ refresh = false, maxAgeMs = 60_000 } = {}) {
  if (!refresh && cachedApp && Date.now() - cachedAppAt < maxAgeMs) return cachedApp;
  const candidates = [
    process.env.KIMI_CODE_APP,
    runningAppPath(),
    ...commonAppPaths(),
  ].filter(Boolean);
  const seen = new Set();
  for (const file of candidates) {
    if (seen.has(file)) continue;
    seen.add(file);
    const found = webDirFor(file);
    if (found) {
      cachedApp = { exe: file, ...found };
      cachedAppAt = Date.now();
      return cachedApp;
    }
  }
  return null;
}

function bundleFile(webDir) {
  return path.join(webDir, 'assets', INPAGE_ASSET_DIR, BUNDLE_NAME);
}

function configFile(webDir) {
  return path.join(webDir, 'assets', INPAGE_ASSET_DIR, 'config.json');
}

function assetsDirFor(webDir) {
  return path.join(webDir, 'assets', INPAGE_ASSET_DIR);
}

function writeIfChanged(file, content) {
  try {
    if (readText(file) === content) return false;
  } catch {
    // missing file: write it
  }
  writeTextAtomic(file, content);
  return true;
}

function copyIfChanged(from, to) {
  try {
    const source = fs.statSync(from);
    const dest = fs.statSync(to);
    if (dest.size === source.size && dest.mtimeMs >= source.mtimeMs) return false;
  } catch {
    // missing destination: copy it
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function syncAssets(webDir, config, bundle, overlay) {
  const assetsDir = assetsDirFor(webDir);
  fs.mkdirSync(assetsDir, { recursive: true });

  let changed = false;
  changed = writeIfChanged(path.join(assetsDir, BUNDLE_NAME), bundle) || changed;
  if (overlay) {
    changed = writeIfChanged(path.join(assetsDir, 'overlay.js'), overlay) || changed;
  }

  const publicConfig = JSON.stringify(config, null, 2);
  changed = writeIfChanged(path.join(assetsDir, 'config.json'), publicConfig) || changed;

  let imageOk = true;
  if (config.file) {
    const from = path.join(DATA_DIR, config.file);
    const to = path.join(assetsDir, config.file);
    if (!fs.existsSync(from)) {
      imageOk = false;
    } else {
      changed = copyIfChanged(from, to) || changed;
    }
  }
  for (const name of wallpaperFilesIn(assetsDir)) {
    if (name === config.file) continue;
    try {
      fs.rmSync(path.join(assetsDir, name), { force: true });
      changed = true;
    } catch {
      // ignore
    }
  }
  return { assetsDir, changed, imageOk };
}

// Any plugin may nest its own registration inside the wallpaper block. The
// wallpaper watchdog owns the outer block, so it must carry these untouched
// instead of rewriting the block with only its own script.
const NESTED_INPAGE_BLOCK =
  /<!--\s*([^<>\s]+):inpage:start\s*-->[\s\S]*?<!--\s*\1:inpage:end\s*-->/g;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ownBundleScriptPattern() {
  const src = `/assets/${INPAGE_ASSET_DIR}/${BUNDLE_NAME}`;
  return new RegExp(
    `<script\\b[^>]*\\bsrc=["'][^"']*${escapeRegExp(src)}[^"']*["'][^>]*>\\s*</script>`,
    'gi'
  );
}

function nestedBlockPattern() {
  return new RegExp(NESTED_INPAGE_BLOCK.source, 'g');
}

function innerOf(block) {
  const startAt = block.indexOf(MARKER_START);
  const endAt = block.lastIndexOf(MARKER_END);
  if (startAt < 0 || endAt < startAt) return '';
  return block.slice(startAt + MARKER_START.length, endAt);
}

function gapSeparator(gap) {
  const trailing = gap.match(/(?:\r?\n)+$/);
  if (!trailing) return '\n';
  return (trailing[0].match(/\n/g) || []).length >= 2 ? '\n\n' : '\n';
}

function stripOwnScripts(text) {
  return text.replace(ownBundleScriptPattern(), '');
}

// Keeps nested plugin marker blocks (and any other non-wallpaper markup) in
// document order, deduplicated by plugin id. Layout gaps are preserved so a
// plugin that rewrites the same nested block does not cause a write loop.
function collectCarriedItems(html) {
  const seen = new Set();
  const items = [];
  for (const outer of html.matchAll(markerPattern(MARKER_START, MARKER_END))) {
    const inner = innerOf(outer[0]);
    let cursor = 0;
    for (const match of inner.matchAll(nestedBlockPattern())) {
      const before = inner.slice(cursor, match.index);
      const text = stripOwnScripts(before).trim();
      if (text) items.push({ separator: gapSeparator(before), text });
      const id = match[1].toLowerCase();
      if (!seen.has(id)) {
        seen.add(id);
        items.push({ separator: gapSeparator(before), text: match[0].trim() });
      }
      cursor = match.index + match[0].length;
    }
    const tail = stripOwnScripts(inner.slice(cursor)).trim();
    if (tail) items.push({ separator: '\n', text: tail });
  }
  return items;
}

function wallpaperBlock(hash, carried) {
  let block = `${MARKER_START}
<script src="/assets/${INPAGE_ASSET_DIR}/${BUNDLE_NAME}?v=${hash}"></script>`;
  for (const item of carried) block += `${item.separator}${item.text}`;
  return `${block}\n${MARKER_END}`;
}

function patchIndex(webDir, hash) {
  const file = path.join(webDir, 'index.html');
  const original = readText(file);
  const backup = `${file}.kimi-wallpaper.bak`;
  try {
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  } catch {
    // a backup is nice to have, not required
  }
  const block = wallpaperBlock(hash, collectCarriedItems(original));
  let next = original.replace(markerPattern(MARKER_START, MARKER_END), '');
  const moduleAt = next.search(/<script\s+type=["']module["']/i);
  if (moduleAt >= 0) {
    next = `${next.slice(0, moduleAt)}${block}\n${next.slice(moduleAt)}`;
  } else {
    next = next.replace(/<\/head>/i, `${block}\n</head>`);
  }
  if (next === original) return false;
  writeTextAtomic(file, next);
  return true;
}

function hasMarker(webDir) {
  try {
    return readText(path.join(webDir, 'index.html')).includes(MARKER_START);
  } catch {
    return false;
  }
}

function markerBlock(start, end, assetName, hash) {
  return `${start}
<script src="/assets/${INPAGE_ASSET_DIR}/${assetName}?v=${hash}"></script>
${end}`;
}

function markerPattern(start, end) {
  return new RegExp(
    `\\s*${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`,
    'g'
  );
}

function patchOverlay(webDir, hash) {
  const file = path.join(webDir, OVERLAY_HTML);
  let original;
  try {
    original = readText(file);
  } catch {
    return false;
  }
  const block = markerBlock(OVERLAY_MARKER_START, OVERLAY_MARKER_END, 'overlay.js', hash);
  const next = original.replace(markerPattern(OVERLAY_MARKER_START, OVERLAY_MARKER_END), '').replace(
    /<\/head>/i,
    `${block}\n</head>`
  );
  if (next === original) return false;
  writeTextAtomic(file, next);
  return true;
}

function overlayStatus(webDir) {
  const overlayPath = path.join(webDir, OVERLAY_HTML);
  let supported = false;
  try {
    supported = fs.statSync(overlayPath).isFile();
  } catch {
    supported = false;
  }
  if (!supported) return { overlaySupported: false, overlayPatched: false, overlayCurrent: false };
  let source;
  try {
    source = readText(OVERLAY_SOURCE);
  } catch {
    return { overlaySupported: true, overlayPatched: false, overlayCurrent: false };
  }
  const hash = bundleHash(source);
  let overlayPatched = false;
  let markerCurrent = false;
  try {
    const html = readText(overlayPath);
    overlayPatched = html.includes(OVERLAY_MARKER_START);
    markerCurrent = html.includes(`overlay.js?v=${hash}`);
  } catch {
    overlayPatched = false;
  }
  let bundleCurrent = false;
  try {
    bundleCurrent = readText(path.join(assetsDirFor(webDir), 'overlay.js')) === source;
  } catch {
    bundleCurrent = false;
  }
  return {
    overlaySupported: true,
    overlayPatched,
    overlayCurrent: overlayPatched && bundleCurrent && markerCurrent,
  };
}

function markerCurrent(webDir, hash) {
  try {
    const html = readText(path.join(webDir, 'index.html'));
    return html.includes(MARKER_START) && html.includes(`${BUNDLE_NAME}?v=${hash}`);
  } catch {
    return false;
  }
}

function appOrRefresh() {
  let app = findKimiCodeApp();
  if (app && !fs.existsSync(path.join(app.webDir, 'index.html'))) {
    app = findKimiCodeApp({ refresh: true });
  }
  return app;
}

export function inPageStatus() {
  const app = appOrRefresh();
  if (!app) {
    return { ok: false, installed: false, error: '没有找到 Kimi Code 安装目录' };
  }
  const config = readConfig();
  const bundle = bundleFile(app.webDir);
  const configPath = configFile(app.webDir);
  const sourceBundle = readText(BUNDLE_SOURCE);
  const hash = bundleHash(sourceBundle);
  let bundleCurrent = false;
  try {
    bundleCurrent = readText(bundle) === sourceBundle;
  } catch {
    bundleCurrent = false;
  }
  const markerOk = markerCurrent(app.webDir, hash);
  let configCurrent = false;
  try {
    configCurrent = readText(configPath) === JSON.stringify(config, null, 2);
  } catch {
    configCurrent = false;
  }
  const imageOk = !config.file || fs.existsSync(path.join(assetsDirFor(app.webDir), config.file));
  const installed = hasMarker(app.webDir) && fs.existsSync(bundle);
  const overlay = overlayStatus(app.webDir);
  const overlayOk = !overlay.overlaySupported || overlay.overlayCurrent;
  return {
    ok: true,
    installed,
    current: installed && bundleCurrent && configCurrent && imageOk && markerOk && overlayOk,
    bundleCurrent,
    configCurrent,
    imageOk,
    markerCurrent: markerOk,
    overlaySupported: overlay.overlaySupported,
    overlayPatched: overlay.overlayPatched,
    overlayCurrent: overlay.overlayCurrent,
    hash,
    app: app.exe,
    webDir: app.webDir,
    assetsDir: assetsDirFor(app.webDir),
    bundle,
    config: config,
    version: VERSION,
  };
}

export function installInPage({ quiet = false } = {}) {
  const app = appOrRefresh();
  if (!app) {
    return { ok: false, error: '没有找到 Kimi Code 安装目录，请确认客户端已安装并运行过一次' };
  }
  try {
    fs.accessSync(app.webDir, fs.constants.W_OK);
  } catch {
    return {
      ok: false,
      error: `没有写入权限：${app.webDir}。请以管理员身份运行一次安装命令。`,
      app: app.exe,
      webDir: app.webDir,
    };
  }
  if (!fs.existsSync(BUNDLE_SOURCE)) {
    return { ok: false, error: `插件缺少页内脚本：${BUNDLE_SOURCE}` };
  }

  const config = readConfig();
  const bundle = readText(BUNDLE_SOURCE);
  const hash = bundleHash(bundle);
  let overlay = null;
  try {
    overlay = readText(OVERLAY_SOURCE);
  } catch {
    overlay = null;
  }
  const synced = syncAssets(app.webDir, config, bundle, overlay);
  const patched = patchIndex(app.webDir, hash);
  const overlayPatched = overlay ? patchOverlay(app.webDir, bundleHash(overlay)) : false;
  const changed = synced.changed || patched || overlayPatched;
  const result = {
    ok: true,
    app: app.exe,
    webDir: app.webDir,
    assetsDir: synced.assetsDir,
    bundle: bundleFile(app.webDir),
    config,
    hash,
    overlayPatched,
    imageOk: synced.imageOk,
    changed,
    needsRestart: changed,
  };
  try {
    fs.writeFileSync(
      path.join(synced.assetsDir, 'install.json'),
      JSON.stringify(
        {
          version: VERSION,
          hash,
          app: app.exe,
          webDir: app.webDir,
          installedAt: new Date().toISOString(),
          bundle: result.bundle,
        },
        null,
        2
      )
    );
  } catch {
    // ignore
  }
  if (!quiet) logLine('inpage-install', app.webDir, changed ? 'changed' : 'unchanged');
  return result;
}

// Nested registrations belong to other plugins, so removing the wallpaper must
// not delete them. They become standalone marker blocks in front of the app's
// main module instead.
function collectNestedBlocks(html) {
  const seen = new Set();
  const blocks = [];
  for (const outer of html.matchAll(markerPattern(MARKER_START, MARKER_END))) {
    const inner = innerOf(outer[0]);
    for (const match of inner.matchAll(nestedBlockPattern())) {
      const id = match[1].toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      blocks.push({ id, text: match[0].trim() });
    }
  }
  return blocks;
}

function insertBeforeMainModule(html, block) {
  const moduleAt = html.search(/<script\s+type=["']module["']/i);
  if (moduleAt >= 0) {
    return `${html.slice(0, moduleAt)}${block}\n${html.slice(moduleAt)}`;
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${block}\n</head>`);
  const bodyEnd = html.search(/<\/body>/i);
  if (bodyEnd >= 0) return `${html.slice(0, bodyEnd)}${block}\n${html.slice(bodyEnd)}`;
  return `${html}\n${block}`;
}

export function removeInPage() {
  const app = appOrRefresh();
  if (!app) return { ok: false, error: '没有找到 Kimi Code 安装目录' };
  const file = path.join(app.webDir, 'index.html');
  try {
    fs.accessSync(app.webDir, fs.constants.W_OK);
  } catch {
    return { ok: false, error: `没有写入权限：${app.webDir}` };
  }
  try {
    const original = readText(file);
    const carried = collectNestedBlocks(original);
    let next = original.replace(markerPattern(MARKER_START, MARKER_END), '');
    if (carried.length > 0) {
      const present = new Set();
      for (const match of next.matchAll(nestedBlockPattern())) {
        present.add(match[1].toLowerCase());
      }
      const blocks = carried.filter((item) => !present.has(item.id)).map((item) => item.text);
      if (blocks.length > 0) next = insertBeforeMainModule(next, blocks.join('\n'));
    }
    if (next !== original) writeTextAtomic(file, next);
  } catch {
    // ignore
  }
  try {
    const overlayFile = path.join(app.webDir, OVERLAY_HTML);
    const original = readText(overlayFile);
    const next = original.replace(markerPattern(OVERLAY_MARKER_START, OVERLAY_MARKER_END), '');
    if (next !== original) writeTextAtomic(overlayFile, next);
  } catch {
    // ignore
  }
  try {
    fs.rmSync(assetsDirFor(app.webDir), { recursive: true, force: true });
  } catch {
    // ignore
  }
  try {
    fs.rmSync(`${file}.kimi-wallpaper.bak`, { force: true });
  } catch {
    // ignore
  }
  logLine('inpage-remove', app.webDir);
  return { ok: true, app: app.exe, webDir: app.webDir };
}

export function ensureInPage() {
  try {
    return installInPage({ quiet: true });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export { BUNDLE_SOURCE, patchIndex };
