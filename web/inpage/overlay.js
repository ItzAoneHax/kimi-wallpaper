/* Kimi Code browser-overlay glass.
 *
 * Injected into resources/desktop-dist/browser-overlay.html by lib/inpage.mjs.
 * The desktop app renders registered menus (model picker, permission picker,
 * workspace/browser menus, ...) inside this separate overlay window, so the
 * main in-page wallpaper stylesheet never reaches them. This file gives those
 * menus the same translucent surface as the rest of the wallpaper.
 */
(() => {
  'use strict';

  const STYLE_ID = 'kimi-wallpaper-overlay-style';
  const ROOT_CLASS = 'kimi-wallpaper-overlay';
  const CONFIG_URL = '/assets/kimi-wallpaper/config.json';
  const OVERLAY_BUILD = '2026-11-13.45';

  const CSS = `
html.${ROOT_CLASS} .ui-menu {
  background: var(--kw-menu-surface, rgba(41, 41, 41, 0.44)) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  backdrop-filter: blur(20px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.15) !important;
}
html.${ROOT_CLASS} .ui-seg {
  background: color-mix(in srgb, var(--color-surface-sunken, #121212) 38%, transparent) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  backdrop-filter: blur(14px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.15) !important;
}
html.${ROOT_CLASS} .ui-seg .ui-seg__item.is-on {
  background: var(--kw-active-surface, rgba(41, 41, 41, 0.4)) !important;
  box-shadow: inset 0 0 0 1px var(--kw-card-border, rgba(255, 255, 255, 0.18)), inset 0 0 14px rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(12px) saturate(1.2) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.2) !important;
}
html.${ROOT_CLASS} .ui-menu-item-row:hover,
html.${ROOT_CLASS} .ui-menu-item.is-active {
  background: rgba(255, 255, 255, 0.06) !important;
}
`;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.add(ROOT_CLASS);
  }

  function setGlass(glass) {
    const value = Number(glass);
    const safe = Number.isFinite(value) ? Math.min(0.95, Math.max(0, value)) : 0.6;
    const alpha = Math.round((1 - safe) * 100);
    const menuAlpha = Math.max(10, Math.min(72, alpha - 22));
    const activeAlpha = Math.max(32, Math.min(88, alpha + 8));
    const root = document.documentElement.style;
    root.setProperty(
      '--kw-menu-surface',
      `color-mix(in srgb, var(--color-menu-bg, #1f1f1f) ${menuAlpha}%, transparent)`
    );
    root.setProperty(
      '--kw-active-surface',
      `color-mix(in srgb, var(--color-surface-raised, #292929) ${activeAlpha}%, transparent)`
    );
    root.setProperty(
      '--kw-card-border',
      'color-mix(in srgb, var(--color-line, rgba(255, 255, 255, 0.18)) 90%, transparent)'
    );
  }

  async function init() {
    injectStyle();
    try {
      const response = await fetch(CONFIG_URL, { cache: 'no-store' });
      if (!response.ok) return;
      const config = await response.json();
      if (config.enabled === false || config.source === 'none') {
        document.documentElement.classList.remove(ROOT_CLASS);
        return;
      }
      setGlass(config.glass);
    } catch {
      // The static defaults in CSS already keep the menus readable.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.__kimiWallpaperOverlay = { build: OVERLAY_BUILD };
})();
