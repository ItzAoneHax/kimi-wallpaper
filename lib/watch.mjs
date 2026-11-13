#!/usr/bin/env node
// Resident auto-repair loop. It lives outside Kimi Code, so it can notice an
// app update while the client is closed and patch desktop-dist before the next
// launch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSION,
  WATCH_LOCK_PATH,
  WATCH_LOG_PATH,
  WATCH_PATH,
  ensureDataDir,
  isAlive,
  readJson,
  writeJson,
} from './paths.mjs';
import { inPageStatus, installInPage, removeInPage } from './inpage.mjs';
import { isInPageDisabled, updateInProgress } from './watchdog.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INTERVAL = Math.min(
  300_000,
  Math.max(2_000, Number(process.env.KIMI_WALLPAPER_WATCH_MS) || 20_000)
);

function log(...parts) {
  try {
    ensureDataDir();
    if (fs.existsSync(WATCH_LOG_PATH) && fs.statSync(WATCH_LOG_PATH).size > 1024 * 1024) {
      fs.renameSync(WATCH_LOG_PATH, `${WATCH_LOG_PATH}.1`);
    }
    fs.appendFileSync(WATCH_LOG_PATH, `${new Date().toISOString()} ${parts.join(' ')}\n`);
  } catch {
    // logging must not stop the loop
  }
}

function writeStatus(patch) {
  const previous = readJson(WATCH_PATH, null) || {};
  writeJson(WATCH_PATH, {
    ...previous,
    pid: process.pid,
    version: VERSION,
    intervalMs: INTERVAL,
    lastCheckAt: new Date().toISOString(),
    ...patch,
  });
}

function acquireLock() {
  let current = 0;
  try {
    current = Number(fs.readFileSync(WATCH_LOCK_PATH, 'utf8').trim()) || 0;
  } catch {
    current = 0;
  }
  if (current > 0 && current !== process.pid && isAlive(current)) return false;
  try {
    fs.rmSync(WATCH_LOCK_PATH, { force: true });
  } catch {
    // ignore
  }
  try {
    fs.writeFileSync(WATCH_LOCK_PATH, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try {
    const pid = Number(fs.readFileSync(WATCH_LOCK_PATH, 'utf8').trim()) || 0;
    if (pid === process.pid) fs.rmSync(WATCH_LOCK_PATH, { force: true });
  } catch {
    // ignore
  }
}

function pluginStillInstalled() {
  return fs.existsSync(path.join(PLUGIN_ROOT, 'kimi.plugin.json'));
}

function tick() {
  if (isInPageDisabled()) {
    log('disabled');
    return 'stop';
  }
  if (!pluginStillInstalled()) {
    log('plugin-removed');
    try {
      removeInPage();
    } catch (err) {
      log('plugin-removed-cleanup-failed', err instanceof Error ? err.message : String(err));
    }
    return 'stop';
  }
  if (updateInProgress()) {
    writeStatus({ lastAction: 'update-in-progress', lastError: '' });
    return 'update';
  }

  let status;
  try {
    status = inPageStatus();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeStatus({ lastAction: 'error', lastError: message });
    log('status-failed', message);
    return 'keep';
  }
  if (!status.ok) {
    writeStatus({ lastAction: 'waiting', lastError: status.error || '' });
    return 'keep';
  }
  if (status.current) {
    writeStatus({ lastAction: 'ok', lastError: '', app: status.app, webDir: status.webDir });
    return 'keep';
  }

  let result;
  try {
    result = installInPage({ quiet: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeStatus({ lastAction: 'error', lastError: message });
    log('repair-failed', message);
    return 'keep';
  }
  if (!result.ok) {
    writeStatus({ lastAction: 'error', lastError: result.error || 'install failed' });
    log('repair-failed', result.error || 'install failed');
    return 'keep';
  }
  if (!result.imageOk) {
    const missing = result.config?.file ? `缺少图片：${result.config.file}` : '壁纸图片不可用';
    writeStatus({ lastAction: 'image-missing', lastError: missing });
    log('image-missing', result.config?.file || '');
    return 'keep';
  }
  writeStatus({
    lastAction: 'repaired',
    lastError: '',
    app: result.app,
    webDir: result.webDir,
    lastChangedAt: new Date().toISOString(),
  });
  log('repaired', result.webDir);
  return 'keep';
}

function main() {
  if (!acquireLock()) {
    log('already-running');
    return;
  }
  if (isInPageDisabled()) {
    releaseLock();
    return;
  }
  process.on('exit', releaseLock);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  writeStatus({ startedAt: new Date().toISOString(), lastAction: 'starting', lastError: '' });
  log('started', `pid=${process.pid}`, `interval=${INTERVAL}ms`);
  const loop = () => {
    const state = tick();
    if (state === 'stop') {
      releaseLock();
      return;
    }
    setTimeout(loop, state === 'update' ? 2000 : INTERVAL);
  };
  loop();
}

main();
