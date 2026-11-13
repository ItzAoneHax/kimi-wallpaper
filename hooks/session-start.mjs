#!/usr/bin/env node
// SessionStart hook: make sure the in-page wallpaper is installed and the
// auto-repair watchdog is running. Detached and silent; the hook itself must
// return immediately. Changes take effect on the next renderer load.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let input = '';
const finish = () => {
  try {
    if (process.env.KIMI_WALLPAPER_DISABLE_HOOK !== '1') {
      const child = spawn(process.execPath, [path.join(root, 'lib', 'cli.mjs'), 'ensure'], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: { ...process.env },
      });
      child.unref();
    }
  } catch {
    // Hooks are fail-open by design.
  }
  process.exit(0);
};

process.stdin.on('data', (chunk) => {
  input += chunk;
  if (input.length > 200_000) input = input.slice(0, 200_000);
});
process.stdin.on('end', finish);
process.stdin.on('error', finish);
setTimeout(finish, 800).unref();
