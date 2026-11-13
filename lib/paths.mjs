import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WEB_DIR = path.join(PLUGIN_ROOT, 'web');
export const ASSETS_DIR = path.join(PLUGIN_ROOT, 'assets');

export const KIMI_CODE_HOME =
  process.env.KIMI_CODE_HOME && process.env.KIMI_CODE_HOME.trim().length > 0
    ? process.env.KIMI_CODE_HOME
    : path.join(os.homedir(), '.kimi-code');

export const DATA_DIR =
  process.env.KIMI_WALLPAPER_HOME && process.env.KIMI_WALLPAPER_HOME.trim().length > 0
    ? process.env.KIMI_WALLPAPER_HOME
    : path.join(KIMI_CODE_HOME, 'wallpaper');

export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
export const WATCH_PATH = path.join(DATA_DIR, 'watch.json');
export const WATCH_LOG_PATH = path.join(DATA_DIR, 'watch.log');
export const WATCH_LOCK_PATH = path.join(DATA_DIR, 'watch.lock');
export const INPAGE_DISABLED_PATH = path.join(DATA_DIR, 'inpage-disabled.json');
export const LOG_PATH = path.join(DATA_DIR, 'wallpaper.log');

export const INPAGE_ASSET_DIR = 'kimi-wallpaper';
export const BUNDLE_NAME = 'kimi-wallpaper.js';
export const VERSION = '1.1.4';

export const PRESETS = ['aurora', 'sunset', 'midnight', 'forest', 'paper', 'none'];
export const FITS = ['cover', 'contain', 'tile'];
export const POSITIONS = ['center', 'top', 'bottom', 'left', 'right'];

export const DEFAULT_CONFIG = {
  version: 1,
  enabled: true,
  source: 'auto',
  preset: 'aurora',
  file: null,
  fit: 'cover',
  position: 'center',
  opacity: 1,
  blur: 0,
  dim: 0.35,
  glass: 0.6,
};

export function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return DATA_DIR;
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  ensureDataDir();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function writeTextAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export function isAlive(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

export function logLine(...parts) {
  try {
    ensureDataDir();
    const line = `${new Date().toISOString()} ${parts.join(' ')}\n`;
    if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > 2 * 1024 * 1024) {
      fs.renameSync(LOG_PATH, `${LOG_PATH}.1`);
    }
    fs.appendFileSync(LOG_PATH, line);
  } catch {
    // Logging must never break the wallpaper.
  }
}
