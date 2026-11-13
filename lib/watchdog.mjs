import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DATA_DIR,
  INPAGE_DISABLED_PATH,
  VERSION,
  WATCH_LOCK_PATH,
  WATCH_PATH,
  ensureDataDir,
  isAlive,
  logLine,
  readJson,
  writeJson,
} from './paths.mjs';

const WATCH_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'watch.mjs');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(cmd, args) {
  try {
    return spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true }).status === 0;
  } catch {
    return false;
  }
}

function readLockPid() {
  try {
    const pid = Number(fs.readFileSync(WATCH_LOCK_PATH, 'utf8').trim());
    return Number.isFinite(pid) && pid > 0 ? pid : 0;
  } catch {
    return 0;
  }
}

export function isInPageDisabled() {
  return fs.existsSync(INPAGE_DISABLED_PATH);
}

// electron-updater launches a silent installer named KimiCode-<version>-win-x64.exe
// and waits for the running app to exit. Writing into desktop-dist while it runs
// can race with the installer, so every writer backs off.
export function updateInProgress() {
  if (process.platform !== 'win32') return false;
  try {
    const out = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000,
    });
    return /KimiCode-\d[\d.]*-win-x64\.exe/i.test(out);
  } catch {
    return false;
  }
}

export function setInPageDisabled(disabled, reason = '') {
  if (disabled) {
    ensureDataDir();
    writeJson(INPAGE_DISABLED_PATH, {
      disabled: true,
      at: new Date().toISOString(),
      reason,
    });
    return;
  }
  try {
    fs.rmSync(INPAGE_DISABLED_PATH, { force: true });
  } catch {
    // ignore
  }
}

export function watchdogStatus() {
  const info = readJson(WATCH_PATH, null);
  const pid = Number(info?.pid) || readLockPid() || 0;
  const running = pid > 0 && isAlive(pid);
  return {
    disabled: isInPageDisabled(),
    running,
    pid: running ? pid : null,
    startedAt: running ? info?.startedAt || null : null,
    lastCheckAt: running ? info?.lastCheckAt || null : null,
    lastAction: running ? info?.lastAction || null : null,
    lastError: running ? info?.lastError || null : null,
    lastChangedAt: running ? info?.lastChangedAt || null : null,
    intervalMs: Number(info?.intervalMs) || 20_000,
    version: info?.version || null,
    app: info?.app || null,
    webDir: info?.webDir || null,
  };
}

export async function stopWatchdog() {
  const info = readJson(WATCH_PATH, null);
  const pid = Number(info?.pid) || readLockPid() || 0;
  let stopped = false;
  if (pid > 0 && isAlive(pid)) {
    try {
      process.kill(pid);
    } catch {
      // fall through to taskkill
    }
    await sleep(350);
    if (isAlive(pid) && process.platform === 'win32') {
      run('taskkill', ['/PID', String(pid), '/T', '/F']);
    }
    stopped = true;
  }
  try {
    fs.rmSync(WATCH_PATH, { force: true });
  } catch {
    // ignore
  }
  try {
    const lockPid = readLockPid();
    if (!lockPid || lockPid === pid || !isAlive(lockPid)) fs.rmSync(WATCH_LOCK_PATH, { force: true });
  } catch {
    // ignore
  }
  if (stopped) logLine('watch-stopped', String(pid));
  return { ok: true, stopped, pid: stopped ? pid : null };
}

export async function startWatchdog({ force = false, intervalMs = 0 } = {}) {
  if (isInPageDisabled()) {
    return { ok: false, error: '自动修复已关闭；先执行 install 开启' };
  }
  const current = watchdogStatus();
  if (current.running && !force) {
    return { ok: true, existing: true, pid: current.pid, status: current };
  }
  if (current.running && force) {
    await stopWatchdog();
  }
  ensureDataDir();
  const env = { ...process.env, KIMI_WALLPAPER_HOME: DATA_DIR };
  if (intervalMs > 0) env.KIMI_WALLPAPER_WATCH_MS = String(intervalMs);
  let child;
  try {
    child = spawn(process.execPath, [WATCH_SCRIPT], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: path.dirname(WATCH_SCRIPT),
      env,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  child.unref();
  const deadline = Date.now() + 1800;
  while (Date.now() < deadline) {
    await sleep(150);
    const status = watchdogStatus();
    if (status.running) {
      logLine('watch-started', String(status.pid));
      return { ok: true, existing: false, pid: status.pid, status };
    }
  }
  return { ok: false, error: '自动修复进程未启动（查看 watch.log）', pid: child.pid };
}
