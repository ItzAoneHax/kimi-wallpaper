#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, VERSION, ensureDataDir, logLine } from './paths.mjs';
import {
  describeConfig,
  isImageFile,
  normalizeConfig,
  readConfig,
  resetConfig,
  wallpaperFilesIn,
  writeConfig,
} from './config.mjs';
import { findKimiCodeApp, inPageStatus, installInPage, removeInPage } from './inpage.mjs';
import {
  isInPageDisabled,
  setInPageDisabled,
  startWatchdog,
  stopWatchdog,
  updateInProgress,
  watchdogStatus,
} from './watchdog.mjs';

const argv = process.argv.slice(2);
const command = argv[0] || 'help';

function parseArgs(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq > 0) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(argv.slice(1));

function pad(text, width) {
  let w = 0;
  for (const ch of text) {
    w += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60]/.test(ch) ? 2 : 1;
  }
  return text + ' '.repeat(Math.max(0, width - w));
}

function percent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function printStatus() {
  const inpage = inPageStatus();
  const watch = watchdogStatus();
  const config = readConfig();
  console.log(`Kimi 壁纸 v${VERSION}`);
  if (!inpage.ok) {
    console.log(`${pad('页内注入', 10)} ${inpage.error}`);
  } else {
    console.log(`${pad('客户端', 10)} ${inpage.app}`);
    console.log(`${pad('页面目录', 10)} ${inpage.webDir}`);
    console.log(
      `${pad('页内注入', 10)} ${
        inpage.installed ? (inpage.current ? '已安装且是最新' : '已安装，需要更新（install）') : '未安装'
      }`
    );
    console.log(`${pad('壁纸', 10)} ${describeConfig(config)}`);
    console.log(
      `${pad('外观', 10)} ${config.fit} · 透明度 ${percent(config.opacity)} · 模糊 ${config.blur}px · 遮罩 ${percent(
        config.dim
      )} · 玻璃 ${percent(config.glass)} · 悬浮提示 ${config.tips ? '跟随主题' : '原生'}`
    );
  }
  console.log(
    `${pad('自动修复', 10)} ${
      watch.disabled
        ? '已关闭（remove）'
        : watch.running
          ? `运行中 · pid ${watch.pid} · 每 ${Math.round(watch.intervalMs / 1000)} 秒检查`
          : '未运行（install 或重启会话）'
    }`
  );
  if (watch.running) {
    console.log(
      `${pad('最近检查', 10)} ${watch.lastCheckAt || '—'} · ${watch.lastAction || '—'}${
        watch.lastError ? ` · ${watch.lastError}` : ''
      }`
    );
  }
  console.log(`${pad('数据目录', 10)} ${DATA_DIR}`);
  if (inpage.ok && inpage.installed) {
    console.log('提示：修改壁纸后重启 Kimi Code，或在窗口里按 Ctrl+R 刷新。');
  }
}

function printJson() {
  const inpage = inPageStatus();
  const watch = watchdogStatus();
  console.log(
    JSON.stringify(
      {
        ok: inpage.ok,
        version: VERSION,
        dataDir: DATA_DIR,
        config: readConfig(),
        inpage,
        watch,
      },
      null,
      2
    )
  );
}

function removeOldWallpapers(keep) {
  for (const name of wallpaperFilesIn(DATA_DIR)) {
    if (name === keep) continue;
    try {
      fs.rmSync(path.join(DATA_DIR, name), { force: true });
    } catch {
      // ignore
    }
  }
}

function applyInstall() {
  const result = installInPage();
  if (!result.ok) return result;
  if (!result.imageOk) {
    result.warning = `配置里的图片不存在：${path.join(DATA_DIR, result.config.file || '')}`;
  }
  return result;
}

async function cmdInstall() {
  if (updateInProgress()) {
    console.error('Kimi Code 正在更新，等安装完成后再执行 install。');
    return 1;
  }
  setInPageDisabled(false);
  const result = applyInstall();
  if (!result.ok) {
    console.error(`安装失败：${result.error}`);
    return 1;
  }
  console.log(`已安装到：${result.webDir}`);
  if (result.warning) console.error(result.warning);
  console.log(result.changed ? '页内脚本或壁纸配置有更新，重启 Kimi Code 后生效。' : '页内脚本已是最新。');
  const watch = await startWatchdog({ force: true });
  if (watch.ok) console.log('自动修复已启动：Kimi Code 更新后会自动重新注入。');
  else console.error(`自动修复启动失败：${watch.error}`);
  console.log('如果当前窗口还没变化，请重启 Kimi Code（或按 Ctrl+R 刷新）。');
  return 0;
}

async function cmdRemove() {
  if (updateInProgress()) {
    console.error('Kimi Code 正在更新，等安装完成后再执行 remove。');
    return 1;
  }
  setInPageDisabled(true, 'cli remove');
  const watch = await stopWatchdog();
  if (watch.stopped) console.log(`自动修复已停止 (pid ${watch.pid})。`);
  const result = removeInPage();
  if (!result.ok) {
    console.error(`还原失败：${result.error}`);
    return 1;
  }
  console.log(`已从 ${result.webDir} 移除页内壁纸和素材。`);
  console.log('自动修复已关闭；重启 Kimi Code 后页面恢复原样。');
  return 0;
}

function cmdSet() {
  const image = positional[0];
  if (!image) {
    console.error('用法：node lib/cli.mjs set <图片路径> [--fit cover|contain|tile] [--opacity 0-1] [--blur 0-32] [--dim 0-0.9] [--glass 0-0.95] [--tips on|off]');
    return 1;
  }
  const source = path.resolve(process.cwd(), image);
  if (!isImageFile(source)) {
    console.error(`不是可用的图片文件：${source}`);
    console.error('支持 png / jpg / jpeg / webp / gif / avif / bmp。');
    return 1;
  }
  ensureDataDir();
  const ext = path.extname(source).toLowerCase();
  const targetName = `wallpaper${ext}`;
  const target = path.join(DATA_DIR, targetName);
  if (path.resolve(source) !== path.resolve(target)) fs.copyFileSync(source, target);
  removeOldWallpapers(targetName);

  const patch = {
    enabled: true,
    source: 'auto',
    file: targetName,
  };
  for (const key of ['fit', 'position']) {
    if (typeof flags[key] === 'string') patch[key] = flags[key];
  }
  for (const key of ['opacity', 'blur', 'dim', 'glass']) {
    if (flags[key] !== undefined) patch[key] = Number(flags[key]);
  }
  if (flags.tips !== undefined) patch.tips = flags.tips !== 'false' && flags.tips !== '0' && flags.tips !== 'off';
  const config = writeConfig(patch);
  const result = applyInstall();
  if (!result.ok) {
    console.error(`壁纸已保存，但页内注入失败：${result.error}`);
    return 1;
  }
  console.log(`壁纸已保存：${target}`);
  console.log(`当前配置：${describeConfig(config)}`);
  console.log('重启 Kimi Code 或按 Ctrl+R 刷新后生效；也可以打开设置 → 壁纸调整。');
  return 0;
}

function cmdPreset() {
  const name = positional[0];
  if (!name) {
    console.error('用法：node lib/cli.mjs preset <aurora|sunset|midnight|forest|paper|none>');
    return 1;
  }
  if (!['aurora', 'sunset', 'midnight', 'forest', 'paper', 'none'].includes(name)) {
    console.error(`未知渐变：${name}`);
    return 1;
  }
  removeOldWallpapers(null);
  const config = writeConfig({
    enabled: name !== 'none',
    source: 'auto',
    preset: name,
    file: null,
  });
  const result = applyInstall();
  if (!result.ok) {
    console.error(`页内注入失败：${result.error}`);
    return 1;
  }
  console.log(`已切换到${describeConfig(config)}。`);
  console.log('重启 Kimi Code 或按 Ctrl+R 刷新后生效。');
  return 0;
}

function cmdConfig() {
  const patch = {};
  for (const key of ['fit', 'position', 'source']) {
    if (typeof flags[key] === 'string') patch[key] = flags[key];
  }
  if (typeof flags.preset === 'string') {
    patch.preset = flags.preset;
    patch.file = null;
    patch.enabled = flags.preset !== 'none';
    removeOldWallpapers(null);
  }
  for (const key of ['opacity', 'blur', 'dim', 'glass']) {
    if (flags[key] !== undefined) patch[key] = Number(flags[key]);
  }
  if (flags.tips !== undefined) patch.tips = flags.tips !== 'false' && flags.tips !== '0' && flags.tips !== 'off';
  if (flags.enabled !== undefined) patch.enabled = flags.enabled !== 'false' && flags.enabled !== '0';
  if (Object.keys(patch).length === 0) {
    const config = readConfig();
    console.log(JSON.stringify(config, null, 2));
    return 0;
  }
  const config = writeConfig(patch);
  const result = applyInstall();
  if (!result.ok) {
    console.error(`页内注入失败：${result.error}`);
    return 1;
  }
  console.log(`已更新：${describeConfig(config)}`);
  console.log(
    `${config.fit} · 透明度 ${percent(config.opacity)} · 模糊 ${config.blur}px · 遮罩 ${percent(
      config.dim
    )} · 玻璃 ${percent(config.glass)} · 悬浮提示 ${config.tips ? '跟随主题' : '原生'}`
  );
  console.log('页面会自动读取新配置（最多 30 秒），或按 Ctrl+R 立即刷新。');
  return 0;
}

function cmdReset() {
  removeOldWallpapers(null);
  resetConfig();
  const result = applyInstall();
  if (!result.ok) {
    console.error(`页内注入失败：${result.error}`);
    return 1;
  }
  console.log('已恢复默认配置（极光渐变）。');
  console.log('重启 Kimi Code 或按 Ctrl+R 刷新后生效。');
  return 0;
}

function cmdPath() {
  const app = findKimiCodeApp();
  if (!app) {
    console.error('没有找到 Kimi Code 安装目录');
    return 1;
  }
  console.log(app.exe);
  console.log(app.webDir);
  return 0;
}

function cmdDoctor() {
  const checks = [];
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push(['Node.js', nodeMajor >= 18, process.versions.node]);
  const app = findKimiCodeApp();
  checks.push(['Kimi Code 安装', Boolean(app), app ? app.exe : '未找到（请先启动一次客户端）']);
  if (app) {
    const inpage = inPageStatus();
    checks.push(['页内注入', inpage.installed, inpage.installed ? inpage.webDir : '未安装（install）']);
    checks.push([
      '页内脚本版本',
      inpage.current,
      inpage.current ? '与插件一致' : inpage.installed ? '需要重新 install' : '—',
    ]);
    checks.push([
      '壁纸图片',
      inpage.imageOk,
      inpage.config?.file ? path.join(DATA_DIR, inpage.config.file) : '使用内置渐变',
    ]);
    try {
      fs.accessSync(app.webDir, fs.constants.W_OK);
      checks.push(['安装目录可写', true, app.webDir]);
    } catch {
      checks.push(['安装目录可写', false, '需要管理员权限运行 install']);
    }
  }
  const config = normalizeConfig(readConfig());
  checks.push(['配置', true, describeConfig(config)]);
  checks.push(['配置目录', fs.existsSync(DATA_DIR), DATA_DIR]);
  const watch = watchdogStatus();
  checks.push(['自动修复开关', true, watch.disabled ? '已关闭（remove）' : '开启']);
  checks.push([
    '自动修复',
    watch.disabled || watch.running,
    watch.disabled
      ? '已关闭'
      : watch.running
        ? `pid ${watch.pid}${watch.lastAction ? ` · ${watch.lastAction}` : ''}`
        : '未运行（install 或重启会话）',
  ]);
  for (const [label, ok, detail] of checks) {
    console.log(`${ok ? '✓' : '!'} ${pad(label, 16)} ${detail}`);
  }
  return checks.every(([, ok]) => ok) ? 0 : 1;
}

async function cmdEnsure() {
  if (isInPageDisabled()) return 0;
  if (updateInProgress()) return 0;
  const result = installInPage({ quiet: true });
  if (!result.ok) return 0;
  await startWatchdog({ force: true });
  return 0;
}

function cmdHelp() {
  console.log(`Kimi 壁纸 v${VERSION}

用法：node lib/cli.mjs <命令>

  install               安装/更新页内壁纸，并启动自动修复
  remove                移除页内壁纸，并关闭自动修复
  status [--json]       查看注入状态、当前壁纸和自动修复
  set <图片>            用本地图片作为壁纸（支持 png/jpg/webp/gif/avif/bmp）
  preset <名称>         切换内置渐变：aurora/sunset/midnight/forest/paper/none
  config [选项]         查看或修改外观，不改图片
  reset                 恢复默认配置（极光渐变）
  path                  打印 Kimi Code 可执行文件与页面目录
  doctor                逐项自检
  ensure                静默确保注入（插件 hook 使用）

set / config 选项：
  --fit cover|contain|tile   铺满 / 完整 / 平铺（默认 cover）
  --position center|top|bottom|left|right
  --opacity 0-1              壁纸透明度（默认 1）
  --blur 0-32                模糊像素（默认 0）
  --dim 0-0.9                主题色遮罩强度（默认 0.35）
  --glass 0-0.95             侧栏/面板的透明度（默认 0.6）
  --tips on|off              悬浮提示气泡跟随主题（默认 on）

示例：
  node lib/cli.mjs set D:\\Pictures\\wallpaper.jpg --dim 0.45
  node lib/cli.mjs preset midnight
  node lib/cli.mjs config --glass 0.7 --blur 6
`);
  return 0;
}

async function main() {
  switch (command) {
    case 'install':
      return cmdInstall();
    case 'remove':
    case 'uninstall':
      return cmdRemove();
    case 'status':
      if (flags.json) {
        printJson();
        return 0;
      }
      printStatus();
      return inPageStatus().ok ? 0 : 1;
    case 'set':
      return cmdSet();
    case 'preset':
      return cmdPreset();
    case 'config':
      return cmdConfig();
    case 'reset':
      return cmdReset();
    case 'path':
      return cmdPath();
    case 'doctor':
      return cmdDoctor();
    case 'ensure':
      return cmdEnsure();
    case 'help':
    case '--help':
    case '-h':
      return cmdHelp();
    default:
      console.error(`未知命令：${command}`);
      return cmdHelp();
  }
}

main()
  .then(async (code) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    process.exit(code);
  })
  .catch((err) => {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    console.error(message);
    try {
      logLine('cli-fatal', message.split('\n')[0]);
    } catch {
      // ignore
    }
    process.exit(1);
  });
