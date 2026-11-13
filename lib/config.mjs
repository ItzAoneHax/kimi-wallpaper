import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  FITS,
  POSITIONS,
  PRESETS,
  ensureDataDir,
  readJson,
  writeJson,
} from './paths.mjs';

const SOURCES = ['auto', 'custom', 'preset', 'none'];
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp']);

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round(n, digits = 2) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function cleanFile(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const base = path.basename(value.trim());
  if (base !== value.trim()) return null;
  if (!IMAGE_EXTENSIONS.has(path.extname(base).toLowerCase())) return null;
  return base;
}

export function normalizeConfig(input) {
  const source = input && typeof input === 'object' ? input : {};
  const merged = { ...DEFAULT_CONFIG, ...source };
  const preset = PRESETS.includes(merged.preset) ? merged.preset : DEFAULT_CONFIG.preset;
  return {
    version: 1,
    enabled: merged.enabled !== false,
    source: SOURCES.includes(merged.source) ? merged.source : 'auto',
    preset,
    file: cleanFile(merged.file),
    fit: FITS.includes(merged.fit) ? merged.fit : DEFAULT_CONFIG.fit,
    position: POSITIONS.includes(merged.position) ? merged.position : DEFAULT_CONFIG.position,
    opacity: round(clamp(num(merged.opacity, DEFAULT_CONFIG.opacity), 0, 1)),
    blur: round(clamp(num(merged.blur, DEFAULT_CONFIG.blur), 0, 32)),
    dim: round(clamp(num(merged.dim, DEFAULT_CONFIG.dim), 0, 0.9)),
    glass: round(clamp(num(merged.glass, DEFAULT_CONFIG.glass), 0, 0.95)),
    updatedAt: typeof merged.updatedAt === 'string' ? merged.updatedAt : null,
  };
}

export function readConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    const next = normalizeConfig({ ...DEFAULT_CONFIG, updatedAt: new Date().toISOString() });
    writeJson(CONFIG_PATH, next);
    return next;
  }
  return normalizeConfig(readJson(CONFIG_PATH, DEFAULT_CONFIG));
}

export function writeConfig(patch) {
  ensureDataDir();
  const next = normalizeConfig({ ...readConfig(), ...patch, updatedAt: new Date().toISOString() });
  writeJson(CONFIG_PATH, next);
  return next;
}

export function resetConfig() {
  ensureDataDir();
  const next = normalizeConfig({ ...DEFAULT_CONFIG, updatedAt: new Date().toISOString() });
  writeJson(CONFIG_PATH, next);
  return next;
}

export function isImageFile(file) {
  try {
    return fs.statSync(file).isFile() && IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase());
  } catch {
    return false;
  }
}

export function wallpaperFilesIn(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.startsWith('wallpaper.') && IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));
  } catch {
    return [];
  }
}

export function describeConfig(config) {
  const c = normalizeConfig(config);
  if (!c.enabled) return '已关闭';
  if (c.source === 'custom') return '页面内自定义图片';
  if (c.source === 'none') return '无壁纸（恢复原背景）';
  if (c.source === 'preset') return `内置渐变：${c.preset}`;
  if (c.file) return `插件图片：${c.file}`;
  if (c.preset === 'none') return '无壁纸（恢复原背景）';
  return `内置渐变：${c.preset}`;
}
