/* Kimi Code in-page wallpaper.
 *
 * Injected by lib/inpage.mjs into resources/desktop-dist/index.html. The page
 * is same-origin with Kimi Code's own server, so the config and plugin image
 * are loaded from /assets/kimi-wallpaper/. No network access, no tokens.
 */
(() => {
  'use strict';

  if (window.__kimiWallpaper && typeof window.__kimiWallpaper.destroy === 'function') {
    try {
      window.__kimiWallpaper.destroy();
    } catch {
      // Re-initialise below even if the old instance failed to clean up.
    }
  }

  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  const ASSET_BASE = SCRIPT_SRC ? new URL('./', SCRIPT_SRC).href : '/assets/kimi-wallpaper/';
  const CONFIG_URL = new URL('config.json', ASSET_BASE).href;
  const SETTINGS_KEY = 'kimi-wallpaper.settings.v1';
  const DB_NAME = 'kimi-wallpaper';
  const DB_STORE = 'images';
  const ROOT_ID = 'kimi-wallpaper-layer';
  const STYLE_ID = 'kimi-wallpaper-style';
  const DEBUG_ID = 'kimi-wallpaper-debug';
  const SETTINGS_TAB_ID = 'kimi-wallpaper-tab';
  const SETTINGS_PANEL_ID = 'kimi-wallpaper-settings';
  const SETTINGS_STYLE_ID = 'kimi-wallpaper-settings-style';
  const SETTINGS_SURFACE_SELECTOR = '.settings-dialog, .settings-tab-list';
  const FADE_LIST_SELECTOR = '.sm-picker__models';
  const REFRESH_MS = 30_000;
  const WALLPAPER_BUILD = '2026-11-26.1';

  // Scoped-style attribute names used by Kimi Code's own settings UI. They are
  // read from the live dialog when it opens and only fall back to these values
  // if the markup is not rendered yet.
  const SCOPE_FALLBACK = {
    shell: 'data-v-8884d5da',
    row: 'data-v-546e584c',
    seg: 'data-v-89d04b87',
    toggle: 'data-v-a90ee7fe',
    button: 'data-v-b94190a9',
  };

  const PRESETS = {
    aurora: {
      label: '极光',
      css:
        'radial-gradient(1100px 700px at 12% 8%, rgba(124,58,237,.92), transparent 62%),' +
        'radial-gradient(900px 600px at 88% 18%, rgba(6,182,212,.72), transparent 58%),' +
        'radial-gradient(900px 700px at 55% 100%, rgba(244,114,182,.5), transparent 62%),' +
        'linear-gradient(135deg, #0b1020 0%, #111b33 48%, #0b1020 100%)',
    },
    sunset: {
      label: '日落',
      css:
        'radial-gradient(900px 600px at 15% 20%, rgba(255,154,158,.95), transparent 62%),' +
        'radial-gradient(900px 700px at 85% 25%, rgba(251,194,235,.9), transparent 62%),' +
        'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)',
    },
    midnight: {
      label: '午夜',
      css:
        'radial-gradient(800px 600px at 20% 15%, rgba(59,130,246,.34), transparent 62%),' +
        'radial-gradient(900px 700px at 80% 80%, rgba(168,85,247,.24), transparent 62%),' +
        'linear-gradient(135deg, #050816 0%, #0b1224 52%, #050816 100%)',
    },
    forest: {
      label: '森林',
      css:
        'radial-gradient(900px 600px at 15% 10%, rgba(34,197,94,.55), transparent 62%),' +
        'radial-gradient(900px 700px at 85% 30%, rgba(16,185,129,.34), transparent 62%),' +
        'linear-gradient(135deg, #061a12 0%, #0b2b1d 52%, #04120c 100%)',
    },
    paper: {
      label: '纸张',
      css:
        'repeating-linear-gradient(0deg, rgba(0,0,0,.022) 0 1px, transparent 1px 4px),' +
        'radial-gradient(900px 600px at 20% 10%, #fff7ed, transparent 62%),' +
        'linear-gradient(135deg, #fdf6e3 0%, #f5ead2 100%)',
    },
    none: { label: '无', css: 'none' },
  };

  const FITS = ['cover', 'contain', 'tile'];
  const POSITIONS = ['center', 'top', 'bottom', 'left', 'right'];
  const SOURCES = ['auto', 'custom', 'preset', 'none'];
  const DEFAULTS = {
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
    tips: true,
    customName: '',
  };
  const SETTING_KEYS = [
    'enabled',
    'source',
    'preset',
    'fit',
    'position',
    'opacity',
    'blur',
    'dim',
    'glass',
    'tips',
    'customName',
  ];

  const PAGE_CSS = `
html.kimi-wallpaper-on,
html.kimi-wallpaper-on body,
html.kimi-wallpaper-on #app {
  background: transparent !important;
}
html.kimi-wallpaper-on #app {
  z-index: 1 !important;
}
#kimi-wallpaper-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  contain: strict;
  background: var(--color-bg, #121212);
}
#kimi-wallpaper-layer[hidden] {
  display: none !important;
}
#kimi-wallpaper-layer .kw-photo {
  position: absolute;
  inset: 0;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  opacity: var(--kw-opacity, 1);
  transform: translateZ(0);
  will-change: opacity;
}
#kimi-wallpaper-layer .kw-media {
  position: absolute;
  inset: 0;
}
#kimi-wallpaper-layer .kw-media.has-blur {
  backdrop-filter: blur(var(--kw-blur, 0px));
  -webkit-backdrop-filter: blur(var(--kw-blur, 0px));
}
#kimi-wallpaper-layer .kw-veil {
  position: absolute;
  inset: 0;
  background: var(--color-bg, #121212);
  opacity: var(--kw-dim, 0.35);
}
html.kimi-wallpaper-on .app-shell,
html.kimi-wallpaper-on .app,
html.kimi-wallpaper-on .con,
html.kimi-wallpaper-on .global-preview,
html.kimi-wallpaper-on .pt-shell,
html.kimi-wallpaper-on .pt-body,
html.kimi-wallpaper-on .chat-layout,
html.kimi-wallpaper-on .chat-main,
html.kimi-wallpaper-on .panes,
html.kimi-wallpaper-on .chat-scroll,
html.kimi-wallpaper-on .content-wrap,
html.kimi-wallpaper-on .chat,
html.kimi-wallpaper-on .pt-shell,
html.kimi-wallpaper-on .ptt,
html.kimi-wallpaper-on .pt-body,
html.kimi-wallpaper-on .agent-panel,
html.kimi-wallpaper-on .file-preview,
html.kimi-wallpaper-on .fp-code {
  background: transparent !important;
  background-image: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
html.kimi-wallpaper-on .app > .side,
html.kimi-wallpaper-on .side,
html.kimi-wallpaper-on .custom-titlebar,
html.kimi-wallpaper-on .sidebar-actions,
html.kimi-wallpaper-on .side-footer,
html.kimi-wallpaper-on .status-seg {
  background: var(--kw-sidebar-surface, rgba(18, 18, 18, 0.55)) !important;
}
html.kimi-wallpaper-on .sidebar-actions {
  border-bottom: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
}
html.kimi-wallpaper-on .ui-seg .ui-seg__item.is-on {
  background: var(--kw-active-surface, rgba(41, 41, 41, 0.4)) !important;
  box-shadow: inset 0 0 0 1px var(--kw-card-border, rgba(255, 255, 255, 0.18)), inset 0 0 14px rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(12px) saturate(1.2) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.2) !important;
}
html.kimi-wallpaper-on .ui-seg {
  background: color-mix(in srgb, var(--color-surface-sunken, #121212) 38%, transparent) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  backdrop-filter: blur(14px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .topbar,
html.kimi-wallpaper-on .chat-header,
html.kimi-wallpaper-on .panel-tab-bar,
html.kimi-wallpaper-on .session-info.is-sidebar,
html.kimi-wallpaper-on .session-info.is-floating,
html.kimi-wallpaper-on .fup-titlebar,
html.kimi-wallpaper-on .fup-side {
  background: var(--kw-surface, rgba(18, 18, 18, 0.55)) !important;
}
html.kimi-wallpaper-on .topbar,
html.kimi-wallpaper-on .panel-tab-bar,
html.kimi-wallpaper-on .session-info.is-sidebar,
html.kimi-wallpaper-on .session-info.is-floating {
  backdrop-filter: blur(18px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .panel-add-menu,
html.kimi-wallpaper-on .workspace-hover-card,
html.kimi-wallpaper-on .ui-menu,
html.kimi-wallpaper-on .ui-select__menu,
html.kimi-wallpaper-on .mention-menu:not(.is-sheet),
html.kimi-wallpaper-on .slash-menu:not(.is-sheet),
html.kimi-wallpaper-on .ws-panel {
  background: var(--kw-menu-surface, rgba(41, 41, 41, 0.82)) !important;
  backdrop-filter: blur(20px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.15) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
}
html.kimi-wallpaper-on .ui-dialog {
  background: color-mix(in srgb, #ffffff 10%, var(--kw-dialog-surface, rgba(41, 41, 41, 0.22))) !important;
  backdrop-filter: blur(28px) saturate(1.2) !important;
  -webkit-backdrop-filter: blur(28px) saturate(1.2) !important;
}
html.kimi-wallpaper-on .settings-dialog {
  background: color-mix(in srgb, var(--color-bg, #121212) 52%, transparent) !important;
  backdrop-filter: blur(28px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(28px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .ui-dialog__head,
html.kimi-wallpaper-on .ui-dialog__foot {
  background: var(--kw-card-header, rgba(41, 41, 41, 0.54)) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
}
/* Settings subpages pin their own header and footer bands to the scroll
   container and paint them with the opaque theme background. Left alone they
   cut the wallpaper into black strips, so they get the same glass surface as
   the dialog chrome. The footer's offset shadow repeats --color-bg below the
   band and has to go for the same reason. */
html.kimi-wallpaper-on .re-page-head,
html.kimi-wallpaper-on .pf-head-sticky,
html.kimi-wallpaper-on .ap-top,
html.kimi-wallpaper-on .re-foot,
html.kimi-wallpaper-on .pf-foot,
html.kimi-wallpaper-on .ap-foot {
  background: var(--kw-card-header, rgba(41, 41, 41, 0.54)) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  box-shadow: none !important;
}
html.kimi-wallpaper-on .ui-dialog__overlay {
  background: rgba(0, 0, 0, 0.22) !important;
}
html.kimi-wallpaper-on .settings-group,
html.kimi-wallpaper-on .pu-group,
html.kimi-wallpaper-on .sc-group,
html.kimi-wallpaper-on .setting-card,
html.kimi-wallpaper-on .pp-group,
html.kimi-wallpaper-on .rcp-group,
html.kimi-wallpaper-on .rc-devices__list,
html.kimi-wallpaper-on .rc-devices__empty,
html.kimi-wallpaper-on .archive-empty,
html.kimi-wallpaper-on .usage .card {
  background: var(--kw-card-surface, rgba(41, 41, 41, 0.46)) !important;
  border: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
}
html.kimi-wallpaper-on .appr,
html.kimi-wallpaper-on .composer-card,
html.kimi-wallpaper-on .u-bub,
html.kimi-wallpaper-on .ui-card,
html.kimi-wallpaper-on .dock-work-panel {
  background: var(--kw-card-surface, rgba(41, 41, 41, 0.46)) !important;
  border: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18) !important;
}
/* Code blocks paint their own theme background on the inner pre/editor layers,
   which would hide the wallpaper. Keep one slightly thicker glass surface on
   the container and make every nested renderer transparent. */
html.kimi-wallpaper-on .code-block-container {
  --code-bg: transparent !important;
  --vscode-editor-background: transparent !important;
  --markstream-code-fallback-bg: transparent !important;
  --markstream-code-theme-bg: transparent !important;
  --markstream-pre-resolved-theme-bg: transparent !important;
  --markstream-diff-editor-bg: transparent !important;
  --markstream-diff-shell-bg: transparent !important;
  --markstream-diff-panel-bg: transparent !important;
  --markstream-diff-panel-bg-soft: transparent !important;
  --markstream-diff-panel-bg-strong: transparent !important;
  --markstream-diff-gutter-bg: transparent !important;
  --diffs-bg: color-mix(in srgb, var(--color-surface-raised, #292929) 38%, transparent) !important;
  background: var(--kw-glass-surface, rgba(41, 41, 41, 0.6)) !important;
  border: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(18px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .turn-files .ui-card {
  background: color-mix(in srgb, #ffffff 8%, var(--kw-glass-surface, rgba(41, 41, 41, 0.6))) !important;
  border: 1px solid color-mix(in srgb, #ffffff 18%, transparent) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(18px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .turn-files .ui-card .ui-card__head {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
}
html.kimi-wallpaper-on .code-block-container .code-block-header {
  background: var(--kw-glass-header, rgba(41, 41, 41, 0.68)) !important;
  border-bottom: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
html.kimi-wallpaper-on .code-block-container .code-block-shell-content,
html.kimi-wallpaper-on .code-block-container .code-editor-layer,
html.kimi-wallpaper-on .code-block-container .code-editor-container,
html.kimi-wallpaper-on .code-block-container .stream-diffs-shell,
html.kimi-wallpaper-on .code-block-container diffs-container,
html.kimi-wallpaper-on .code-block-container pre,
html.kimi-wallpaper-on .code-block-container pre > code {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
}
html.kimi-wallpaper-on .code-block-container diffs-container {
  --diffs-bg: color-mix(in srgb, var(--color-surface-raised, #292929) 38%, transparent) !important;
  --diffs-light-bg: color-mix(in srgb, var(--color-surface-raised, #292929) 38%, transparent) !important;
  --diffs-dark-bg: color-mix(in srgb, var(--color-surface-raised, #292929) 38%, transparent) !important;
}
html.kimi-wallpaper-on .code-block-header,
html.kimi-wallpaper-on .ui-card__head,
html.kimi-wallpaper-on .ui-card__foot {
  background: var(--kw-card-header, rgba(41, 41, 41, 0.54)) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
}
html.kimi-wallpaper-on .toc-directory {
  background: var(--kw-card-surface, rgba(41, 41, 41, 0.46)) !important;
  border: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  backdrop-filter: blur(20px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .toc-directory:before,
html.kimi-wallpaper-on .toc-directory:after {
  background-image: none !important;
}
html.kimi-wallpaper-on .btd,
html.kimi-wallpaper-on .btd-changes,
html.kimi-wallpaper-on .btd-stack {
  background: transparent !important;
}
html.kimi-wallpaper-on .u-bub,
html.kimi-wallpaper-on .agent-prompt-bubble,
html.kimi-wallpaper-on .composer-card {
  background: color-mix(in srgb, #ffffff 8%, var(--kw-card-surface, rgba(41, 41, 41, 0.46))) !important;
  border: 1px solid color-mix(in srgb, #ffffff 18%, transparent) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(18px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .newmsg-pill {
  background: color-mix(in srgb, #ffffff 8%, var(--kw-card-surface, rgba(41, 41, 41, 0.46))) !important;
  border: 1px solid color-mix(in srgb, #ffffff 18%, transparent) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(18px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .ntn-bubble {
  background: color-mix(in srgb, #ffffff 8%, var(--kw-card-surface, rgba(41, 41, 41, 0.46))) !important;
  border: 1px solid color-mix(in srgb, #ffffff 18%, transparent) !important;
  backdrop-filter: blur(18px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .ntn-out,
html.kimi-wallpaper-on .ntn-out-copy,
html.kimi-wallpaper-on .ntn-raw-pre {
  background: var(--kw-card-surface, rgba(41, 41, 41, 0.46)) !important;
  border: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  backdrop-filter: blur(14px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .open-in {
  background: var(--kw-card-surface, rgba(41, 41, 41, 0.46)) !important;
  border: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18) !important;
}
html.kimi-wallpaper-on .open-in-menu {
  background: var(--kw-surface, rgba(18, 18, 18, 0.55)) !important;
  backdrop-filter: blur(20px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .ch-toggles .ui-icon-button,
html.kimi-wallpaper-on .ch-toggles button,
html.kimi-wallpaper-on .ch-act-more,
html.kimi-wallpaper-on .ch-session-info {
  background: transparent !important;
}
html.kimi-wallpaper-on .ch-terminal.open,
html.kimi-wallpaper-on .ch-panel.is-pressed,
html.kimi-wallpaper-on .ch-act-more.open,
html.kimi-wallpaper-on .ch-session-info.open,
html.kimi-wallpaper-on .ui-icon-button.is-pressed {
  background: var(--kw-card-surface, rgba(41, 41, 41, 0.46)) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
}
html.kimi-wallpaper-on .user-menu-trigger {
  background: transparent !important;
}
html.kimi-wallpaper-on .user-menu-trigger:hover,
html.kimi-wallpaper-on .user-menu-trigger[aria-expanded='true'] {
  background: color-mix(in srgb, var(--color-text, #ffffff) 8%, transparent) !important;
}
html.kimi-wallpaper-on .user-menu-avatar {
  background: transparent !important;
}
html.kimi-wallpaper-on .user-menu-trigger .ui-badge--neutral {
  background: transparent !important;
  border: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
}
html.kimi-wallpaper-on .ws-home-action {
  background: var(--kw-card-surface, rgba(41, 41, 41, 0.46)) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18) !important;
}
html.kimi-wallpaper-on .ws-home-action.open {
  background: var(--kw-active-surface, rgba(41, 41, 41, 0.4)) !important;
}
html.kimi-wallpaper-on .bsrc-pill {
  background: var(--kw-card-surface, rgba(41, 41, 41, 0.46)) !important;
  border-color: var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
  backdrop-filter: blur(14px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.15) !important;
}
html.kimi-wallpaper-on .md[data-v-76d4f48a]:not(.markdown-renderer) {
  background: var(--kw-menu-surface, rgba(41, 41, 41, 0.82)) !important;
  backdrop-filter: blur(20px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.15) !important;
  border: 1px solid var(--kw-card-border, rgba(255, 255, 255, 0.18)) !important;
}
html.kimi-wallpaper-on.kw-tips-on .ui-tip__bubble,
html.kimi-wallpaper-on.kw-tips-on .mention-tip,
html.kimi-wallpaper-on.kw-tips-on .tooltip-element {
  background: var(--kw-tip-surface, rgba(41, 41, 41, 0.72)) !important;
  color: var(--color-text, #ffffff) !important;
  backdrop-filter: blur(20px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.15) !important;
}
html.kimi-wallpaper-on.kw-tips-on .ui-tip__bubble,
html.kimi-wallpaper-on.kw-tips-on .mention-tip {
  box-shadow: 0 0 0 1px var(--kw-card-border, rgba(255, 255, 255, 0.18)), 0 10px 28px rgba(0, 0, 0, 0.28) !important;
}
html.kimi-wallpaper-on.kw-tips-on .mention-tip-caret,
html.kimi-wallpaper-on.kw-tips-on .tooltip-arrow {
  background: var(--kw-tip-surface, rgba(41, 41, 41, 0.72)) !important;
}
html.kimi-wallpaper-on .chat-dock:before {
  display: none !important;
}
html.kimi-wallpaper-on .panes,
html.kimi-wallpaper-on .chat-scroll {
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - var(--kw-fade-start, 220px)), transparent calc(100% - var(--kw-fade-end, 120px)));
  mask-image: linear-gradient(to bottom, #000 calc(100% - var(--kw-fade-start, 220px)), transparent calc(100% - var(--kw-fade-end, 120px)));
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
/* A mask makes .chat-scroll the backdrop root for everything inside it, so a
   popover's backdrop-filter can no longer sample the wallpaper. The workspace
   panel only exists in the empty conversation, where there is no chat text for
   the composer fade to soften. The empty conversation also renders its own
   composer (.empty-composer) inside this scroll container rather than in
   .chat-dock, so the fade would clip the first-run input too. The mention and
   slash menus are anchored to the composer; they need the fade out of the way
   while open for the same reason. */
html.kimi-wallpaper-on .panes:has(.ws-panel),
html.kimi-wallpaper-on .chat-scroll:has(.ws-panel),
html.kimi-wallpaper-on .panes:has(.empty-composer),
html.kimi-wallpaper-on .chat-scroll:has(.empty-composer),
html.kimi-wallpaper-on .panes:has(.mention-menu:not(.is-sheet)),
html.kimi-wallpaper-on .chat-scroll:has(.mention-menu:not(.is-sheet)),
html.kimi-wallpaper-on .panes:has(.slash-menu:not(.is-sheet)),
html.kimi-wallpaper-on .chat-scroll:has(.slash-menu:not(.is-sheet)) {
  -webkit-mask-image: none !important;
  mask-image: none !important;
}

/* The mention and slash menus live inside the composer card. That card gets a
   glass blur of its own, and an element with backdrop-filter is a backdrop
   root for its descendants, so the menu's blur could only sample the card
   itself and the chat text behind the menu would stay sharp. The menu already
   draws its own glass surface, so the card's blur is redundant while open. */
html.kimi-wallpaper-on .composer-card:has(.mention-menu:not(.is-sheet)),
html.kimi-wallpaper-on .composer-card:has(.slash-menu:not(.is-sheet)) {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* The secondary-model picker on the providers page scrolls its model list
   without the edge fades Kimi Code gives its other scrolling menus. The
   script mirrors the app's slash/mention menus: fade only the edges that
   still have content beyond them. */
.sm-picker__models[data-kw-fade='top'] {
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 var(--menu-scroll-fade, 20px));
  mask-image: linear-gradient(to bottom, transparent, #000 var(--menu-scroll-fade, 20px));
}
.sm-picker__models[data-kw-fade='bottom'] {
  -webkit-mask-image: linear-gradient(to top, transparent, #000 var(--menu-scroll-fade, 20px));
  mask-image: linear-gradient(to top, transparent, #000 var(--menu-scroll-fade, 20px));
}
.sm-picker__models[data-kw-fade='both'] {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--menu-scroll-fade, 20px), #000 calc(100% - var(--menu-scroll-fade, 20px)), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 var(--menu-scroll-fade, 20px), #000 calc(100% - var(--menu-scroll-fade, 20px)), transparent 100%);
}
`;

  const SETTINGS_CSS = `
#kimi-wallpaper-tab {
  order: 90;
}
#kimi-wallpaper-settings {
  display: none;
}
#kimi-wallpaper-settings.kws-on {
  display: block !important;
}
.settings-region .body:has(> #kimi-wallpaper-settings.kws-on) > .panel:not(#kimi-wallpaper-settings),
.settings-region .body:has(> #kimi-wallpaper-settings.kws-on) > .settings-subpage,
.settings-dialog:has(#kimi-wallpaper-settings.kws-on) .settings-subpage {
  display: none !important;
}
#kimi-wallpaper-settings .kws-presets {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}
#kimi-wallpaper-settings .kws-preset {
  position: relative;
  height: 48px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--color-line, rgba(0, 0, 0, 0.12));
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface-sunken, #f2f2f2);
  background-position: center;
  background-size: cover;
  color: #fff;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
#kimi-wallpaper-settings .kws-preset > span {
  position: absolute;
  inset: auto 0 0 0;
  padding: 2px 7px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent 90%);
  text-align: left;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}
#kimi-wallpaper-settings .kws-preset.is-on {
  border-color: transparent;
  box-shadow: 0 0 0 2px var(--color-accent, #1783ff);
}
#kimi-wallpaper-settings .kws-preset:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-accent, #1783ff), 0 0 0 4px color-mix(in srgb, var(--color-accent, #1783ff) 28%, transparent);
}
#kimi-wallpaper-settings .kws-preset[data-preset='none'] {
  background: var(--color-surface-sunken, #f2f2f2);
  color: var(--color-text-muted, #888);
}
#kimi-wallpaper-settings .kws-preset[data-preset='none'] > span {
  background: transparent;
  text-shadow: none;
}
#kimi-wallpaper-settings .kws-block {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
#kimi-wallpaper-settings .kws-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
#kimi-wallpaper-settings .kws-status {
  min-height: 14px;
  color: var(--color-text-faint, #999);
  font-size: var(--text-xs, 12px);
}
#kimi-wallpaper-settings .kws-range {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
}
#kimi-wallpaper-settings .kws-range input[type='range'] {
  width: 240px;
  accent-color: var(--color-accent, #1783ff);
}
#kimi-wallpaper-settings .kws-val {
  width: 40px;
  color: var(--color-text-muted, #888);
  font-size: var(--text-xs, 12px);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
#kimi-wallpaper-debug {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 2147483000;
  max-width: min(760px, calc(100vw - 32px));
  max-height: min(70vh, 620px);
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  border: 1px solid var(--color-line, rgba(0, 0, 0, 0.2));
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-bg, #fff) 94%, transparent);
  color: var(--color-text, #222);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  font: 11px/1.55 ui-monospace, "Cascadia Mono", Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
#kimi-wallpaper-debug[hidden] {
  display: none;
}
`;

  let config = { ...DEFAULTS };
  let settings = {};
  let state = { ...DEFAULTS };
  let customUrl = null;
  let customName = '';
  let customAvailable = false;
  let layer = null;
  let photo = null;
  let media = null;
  let veil = null;
  let styleEl = null;
  let settingsStyleEl = null;
  let debugEl = null;
  let fileInput = null;
  let settingsDialog = null;
  let settingsList = null;
  let settingsBody = null;
  let settingsTab = null;
  let settingsPanel = null;
  let settingsControls = null;
  let settingsActive = false;
  let statusTimer = 0;
  let refreshTimer = 0;
  let settingsScheduled = false;
  let settingsPanelFrame = 0;
  let surfaceObserver = null;
  let settingsObserver = null;
  let settingsListObserver = null;
  let enforceTimer = 0;
  let listFadeFrame = 0;
  let destroyed = false;

  function scopeName(selector, fallback) {
    const node = document.querySelector(selector);
    if (node) {
      for (const attr of node.attributes) {
        if (attr.name.startsWith('data-v-')) return attr.name;
      }
    }
    return fallback;
  }

  function resolveScopes() {
    return {
      shell: scopeName('.settings-tab-list', SCOPE_FALLBACK.shell),
      row: scopeName('.settings-group', SCOPE_FALLBACK.row),
      seg: scopeName('.ui-seg', SCOPE_FALLBACK.seg),
      toggle: scopeName('.ui-switch', SCOPE_FALLBACK.toggle),
      button: scopeName('.ui-button', SCOPE_FALLBACK.button),
    };
  }

  function scopedEl(tag, className, scope) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (scope) node.setAttribute(scope, '');
    return node;
  }

  function wallpaperIcon() {
    const source = document.querySelector('.settings-tab-list .tab:not(#kimi-wallpaper-tab) svg');
    const svg = source
      ? source.cloneNode(false)
      : document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (!svg.getAttribute('width')) svg.setAttribute('width', '16');
    if (!svg.getAttribute('height')) svg.setAttribute('height', '16');
    svg.innerHTML =
      '<rect x="3" y="4" width="18" height="16" rx="2.5"></rect>' +
      '<circle cx="8.5" cy="9.5" r="1.5"></circle>' +
      '<path d="m21 15-5-5L5 21"></path>';
    return svg;
  }

  function buildSettingsTab() {
    const scope = resolveScopes().shell;
    const tab = scopedEl('button', 'tab', scope);
    tab.type = 'button';
    tab.id = SETTINGS_TAB_ID;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.appendChild(wallpaperIcon());
    const label = document.createElement('span');
    label.textContent = '壁纸';
    tab.appendChild(label);
    return tab;
  }

  function settingsRow(scopes, labelText, hintText) {
    const row = scopedEl('div', 'row', scopes.row);
    const label = scopedEl('span', 'rlabel', scopes.row);
    label.appendChild(document.createTextNode(labelText));
    if (hintText !== undefined) {
      const hint = scopedEl('span', 'hint', scopes.row);
      hint.textContent = hintText;
      label.appendChild(hint);
    }
    row.appendChild(label);
    return row;
  }

  function settingsSeg(scopes, options, onPick) {
    const seg = scopedEl('div', 'ui-seg ui-seg--md', scopes.seg);
    seg.setAttribute('role', 'tablist');
    const items = [];
    for (const option of options) {
      const item = scopedEl('button', 'ui-seg__item', scopes.seg);
      item.type = 'button';
      item.dataset.value = option.value;
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', 'false');
      item.textContent = option.label;
      item.addEventListener('click', () => onPick(option.value));
      seg.appendChild(item);
      items.push(item);
    }
    return { seg, items };
  }

  function settingsSwitch(scopes, onToggle) {
    const button = scopedEl('button', 'ui-switch', scopes.toggle);
    button.type = 'button';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', 'false');
    const thumb = scopedEl('span', 'ui-switch__thumb', scopes.toggle);
    thumb.setAttribute('aria-hidden', 'true');
    button.appendChild(thumb);
    button.addEventListener('click', onToggle);
    return button;
  }

  function settingsButton(scopes, labelText, onClick, variant = 'secondary') {
    const button = scopedEl('button', `ui-button ui-button--${variant} ui-button--sm`, scopes.button);
    button.type = 'button';
    const content = scopedEl('span', 'ui-button__content', scopes.button);
    content.textContent = labelText;
    button.appendChild(content);
    button.addEventListener('click', onClick);
    return button;
  }

  function settingsSlider(scopes, labelText, hintText, onInput) {
    const row = settingsRow(scopes, labelText, hintText);
    const wrap = document.createElement('div');
    wrap.className = 'kws-range';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.step = '1';
    input.setAttribute('aria-label', labelText);
    const value = document.createElement('span');
    value.className = 'kws-val';
    wrap.appendChild(input);
    wrap.appendChild(value);
    row.appendChild(wrap);
    input.addEventListener('input', () => onInput(Number(input.value)));
    return { row, input, value };
  }

  function buildPresets(scopes) {
    const row = settingsRow(scopes, '内置渐变', '点击缩略图立即切换');
    row.classList.add('kws-block');
    const grid = document.createElement('div');
    grid.className = 'kws-presets';
    const buttons = {};
    for (const [key, preset] of Object.entries(PRESETS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kws-preset';
      button.dataset.preset = key;
      button.setAttribute('aria-label', preset.label);
      if (preset.css !== 'none') button.style.backgroundImage = preset.css;
      const label = document.createElement('span');
      label.textContent = preset.label;
      button.appendChild(label);
      button.addEventListener('click', () => {
        state.source = 'preset';
        state.preset = key;
        state.enabled = key !== 'none';
        commit();
      });
      grid.appendChild(button);
      buttons[key] = button;
    }
    row.appendChild(grid);
    return { row, buttons };
  }

  function buildSettingsPanel() {
    const scopes = resolveScopes();
    const panel = scopedEl('section', 'panel', scopes.shell);
    panel.id = SETTINGS_PANEL_ID;
    panel.setAttribute('aria-label', '壁纸');

    const wallSec = scopedEl('section', 'sec', scopes.shell);
    const wallTitle = scopedEl('h3', 'sec-title', scopes.shell);
    wallTitle.textContent = '壁纸';
    wallSec.appendChild(wallTitle);
    const wallGroup = scopedEl('div', 'settings-group', scopes.row);
    wallSec.appendChild(wallGroup);

    const enableRow = settingsRow(scopes, '启用壁纸', '关闭后恢复 Kimi Code 原背景');
    const enableSwitch = settingsSwitch(scopes, () => {
      state.enabled = !state.enabled;
      if (state.enabled && resolveSource().type === 'none') state.preset = 'aurora';
      commit();
    });
    enableRow.appendChild(enableSwitch);
    wallGroup.appendChild(enableRow);

    const presets = buildPresets(scopes);
    wallGroup.appendChild(presets.row);

    const imageRow = settingsRow(scopes, '图片来源', '');
    imageRow.classList.add('kws-block');
    const imageHint = imageRow.querySelector('.hint');
    const actions = document.createElement('div');
    actions.className = 'kws-actions';
    const pickButton = settingsButton(
      scopes,
      '选择本地图片…',
      () => {
        if (fileInput) fileInput.click();
      },
      'primary'
    );
    const customButton = settingsButton(scopes, '本地图片', () => {
      state.source = 'custom';
      state.enabled = true;
      commit();
    });
    const pluginButton = settingsButton(scopes, '用插件图片', () => {
      state.source = 'auto';
      state.enabled = true;
      commit();
    });
    const status = document.createElement('span');
    status.className = 'kws-status';
    actions.append(pickButton, customButton, pluginButton);
    imageRow.append(actions, status);
    wallGroup.appendChild(imageRow);

    const fit = settingsSeg(
      scopes,
      [
        { value: 'cover', label: '铺满' },
        { value: 'contain', label: '完整' },
        { value: 'tile', label: '平铺' },
      ],
      (value) => {
        state.fit = value;
        commit();
      }
    );
    const fitRow = settingsRow(scopes, '铺放方式', '图片如何填满页面');
    fitRow.appendChild(fit.seg);
    wallGroup.appendChild(fitRow);

    const position = settingsSeg(
      scopes,
      [
        { value: 'center', label: '居中' },
        { value: 'left', label: '左' },
        { value: 'right', label: '右' },
        { value: 'top', label: '上' },
        { value: 'bottom', label: '下' },
      ],
      (value) => {
        state.position = value;
        commit();
      }
    );
    const positionRow = settingsRow(scopes, '对齐', '图片被裁切时调整主体位置');
    positionRow.appendChild(position.seg);
    wallGroup.appendChild(positionRow);

    const lookSec = scopedEl('section', 'sec', scopes.shell);
    const lookTitle = scopedEl('h3', 'sec-title', scopes.shell);
    lookTitle.textContent = '外观';
    lookSec.appendChild(lookTitle);
    const lookGroup = scopedEl('div', 'settings-group', scopes.row);
    lookSec.appendChild(lookGroup);

    const opacity = settingsSlider(scopes, '壁纸透明度', '整张壁纸的通透程度', (value) => {
      state.opacity = value / 100;
      commit();
    });
    const blur = settingsSlider(scopes, '模糊', '让背景更柔和，文字更清楚', (value) => {
      state.blur = value;
      commit();
    });
    const dim = settingsSlider(scopes, '主题遮罩', '遮罩越强，文字越清楚', (value) => {
      state.dim = value / 100;
      commit();
    });
    const glass = settingsSlider(scopes, '面板透明度', '侧栏、卡片和面板越透，壁纸越明显', (value) => {
      state.glass = value / 100;
      commit();
    });
    opacity.input.max = '100';
    blur.input.max = '32';
    dim.input.max = '90';
    glass.input.max = '95';
    lookGroup.append(opacity.row, blur.row, dim.row, glass.row);

    const tipsRow = settingsRow(scopes, '悬浮提示跟随主题', '鼠标悬停气泡改用和面板一致的半透明背景');
    const tipsSwitch = settingsSwitch(scopes, () => {
      state.tips = !state.tips;
      commit();
    });
    tipsRow.appendChild(tipsSwitch);
    lookGroup.appendChild(tipsRow);

    const resetSec = scopedEl('section', 'sec', scopes.shell);
    const resetTitle = scopedEl('h3', 'sec-title', scopes.shell);
    resetTitle.textContent = '其他';
    resetSec.appendChild(resetTitle);
    const resetGroup = scopedEl('div', 'settings-group', scopes.row);
    resetSec.appendChild(resetGroup);
    const resetRow = settingsRow(scopes, '恢复默认', '清除页内设置和本地图片，回到 CLI 配置');
    resetRow.appendChild(settingsButton(scopes, '恢复默认', resetAll));
    resetGroup.appendChild(resetRow);

    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (file) chooseFile(file);
    });

    panel.append(wallSec, lookSec, resetSec, fileInput);

    settingsControls = {
      enableSwitch,
      presets: presets.buttons,
      image: { hint: imageHint, status, customButton, pluginButton },
      fit,
      position,
      sliders: { opacity, blur, dim, glass },
      tipsSwitch,
    };
    return panel;
  }

  function setSlider(slider, value, text) {
    if (!slider) return;
    const next = String(value);
    if (slider.input.value !== next) slider.input.value = next;
    slider.value.textContent = text;
  }

  function updateSettingsUi() {
    const controls = settingsControls;
    if (!controls) return;
    controls.enableSwitch.classList.toggle('is-on', state.enabled);
    controls.enableSwitch.setAttribute('aria-checked', String(state.enabled));
    const presetActive =
      (state.source === 'preset' || (state.source === 'auto' && !state.file)) && state.preset;
    for (const [key, button] of Object.entries(controls.presets)) {
      const on = key === presetActive;
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
    }
    for (const item of controls.fit.items) {
      const on = item.dataset.value === state.fit;
      item.classList.toggle('is-on', on);
      item.setAttribute('aria-selected', String(on));
    }
    for (const item of controls.position.items) {
      const on = item.dataset.value === state.position;
      item.classList.toggle('is-on', on);
      item.setAttribute('aria-selected', String(on));
    }
    setSlider(controls.sliders.opacity, Math.round(state.opacity * 100), `${Math.round(state.opacity * 100)}%`);
    setSlider(controls.sliders.blur, Math.round(state.blur), `${Math.round(state.blur)}px`);
    setSlider(controls.sliders.dim, Math.round(state.dim * 100), `${Math.round(state.dim * 100)}%`);
    setSlider(controls.sliders.glass, Math.round(state.glass * 100), `${Math.round(state.glass * 100)}%`);
    controls.tipsSwitch.classList.toggle('is-on', state.tips);
    controls.tipsSwitch.setAttribute('aria-checked', String(state.tips));
    controls.image.hint.textContent = currentLabel();
    controls.image.customButton.style.display = customAvailable ? '' : 'none';
    controls.image.pluginButton.style.display = state.file ? '' : 'none';
  }

  function commit() {
    apply();
    saveSettings();
    updateSettingsUi();
  }

  function flash(message) {
    const status = settingsControls && settingsControls.image.status;
    if (!status) return;
    status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
    }, 2400);
  }

  function injectSettingsStyle() {
    if (document.getElementById(SETTINGS_STYLE_ID)) return;
    settingsStyleEl = document.createElement('style');
    settingsStyleEl.id = SETTINGS_STYLE_ID;
    settingsStyleEl.textContent = SETTINGS_CSS;
    (document.head || document.documentElement).appendChild(settingsStyleEl);
  }

  function onTabListClick(event) {
    const tab = event.target && event.target.closest ? event.target.closest('.tab') : null;
    if (!tab || !settingsDialog) return;
    const wasActive = settingsActive;
    if (tab.id === SETTINGS_TAB_ID) {
      event.preventDefault();
      event.stopPropagation();
      settingsActive = true;
      ensureSettingsPanel();
    } else {
      settingsActive = false;
      tab.classList.add('on');
      tab.setAttribute('aria-selected', 'true');
    }
    syncSettingsActive();
    if (settingsActive && !wasActive && settingsBody) settingsBody.scrollTop = 0;
  }

  function syncSettingsActive() {
    if (!settingsDialog || !settingsTab || !settingsPanel || !settingsBody) return;
    settingsTab.classList.toggle('on', settingsActive);
    settingsTab.setAttribute('aria-selected', String(settingsActive));
    settingsPanel.classList.toggle('kws-on', settingsActive);
    if (settingsActive) {
      for (const tab of settingsDialog.querySelectorAll('.settings-tab-list .tab')) {
        if (tab === settingsTab) continue;
        tab.classList.remove('on');
        tab.setAttribute('aria-selected', 'false');
      }
    }
  }

  function cancelSettingsPanel() {
    if (!settingsPanelFrame) return;
    if (typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(settingsPanelFrame);
    } else {
      clearTimeout(settingsPanelFrame);
    }
    settingsPanelFrame = 0;
  }

  function resetSettingsUi() {
    clearTimeout(statusTimer);
    statusTimer = 0;
    cancelSettingsPanel();
    if (settingsListObserver) settingsListObserver.disconnect();
    settingsListObserver = null;
    settingsDialog = null;
    settingsList = null;
    settingsBody = null;
    settingsTab = null;
    settingsPanel = null;
    settingsControls = null;
    settingsActive = false;
    fileInput = null;
  }

  function settingsNeedsService(dialog = document.querySelector('.settings-dialog')) {
    if (!dialog) return Boolean(settingsDialog);
    return (
      dialog !== settingsDialog ||
      !settingsList ||
      !settingsList.isConnected ||
      settingsList.querySelectorAll(`#${SETTINGS_TAB_ID}`).length !== 1 ||
      !settingsTab ||
      !settingsList.contains(settingsTab) ||
      !settingsBody ||
      !settingsBody.isConnected ||
      !settingsPanel ||
      !settingsBody.contains(settingsPanel)
    );
  }

  function touchesSettingsSurface(node) {
    if (!node || (node.nodeType !== 1 && node.nodeType !== 11)) return false;
    if (typeof node.matches === 'function' && node.matches(SETTINGS_SURFACE_SELECTOR)) return true;
    return typeof node.querySelector === 'function' && Boolean(node.querySelector(SETTINGS_SURFACE_SELECTOR));
  }

  function settingsRelevant(records) {
    const dialog = document.querySelector('.settings-dialog');
    if (dialog) return settingsNeedsService(dialog);
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (touchesSettingsSurface(node)) return true;
      }
      for (const node of record.removedNodes) {
        if (touchesSettingsSurface(node)) return true;
      }
    }
    return false;
  }

  function watchSettingsList(list) {
    if (settingsListObserver) settingsListObserver.disconnect();
    settingsListObserver = new MutationObserver(() => {
      if (destroyed || settingsList !== list || !list.isConnected) return;
      const tabs = list.querySelectorAll(`#${SETTINGS_TAB_ID}`);
      if (tabs.length === 1 && tabs[0] === settingsTab) return;
      scheduleSettings();
    });
    settingsListObserver.observe(list, { childList: true });
  }

  function ensureSettingsPanel() {
    cancelSettingsPanel();
    if (destroyed) return;
    const dialog = settingsDialog;
    const body = settingsBody;
    if (!dialog || !dialog.isConnected || !body || !body.isConnected) return;
    if (settingsPanel && body.contains(settingsPanel)) {
      syncSettingsActive();
      return;
    }
    if (settingsPanel && settingsPanel.isConnected) settingsPanel.remove();
    settingsPanel = null;
    settingsControls = null;
    body.querySelectorAll(`#${SETTINGS_PANEL_ID}`).forEach((node) => node.remove());
    settingsPanel = buildSettingsPanel();
    body.appendChild(settingsPanel);
    updateSettingsUi();
    if (settingsActive) body.scrollTop = 0;
    syncSettingsActive();
  }

  function scheduleSettingsPanel() {
    if (settingsPanelFrame) return;
    const run = () => {
      settingsPanelFrame = 0;
      ensureSettingsPanel();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      settingsPanelFrame = window.requestAnimationFrame(run);
    } else {
      settingsPanelFrame = window.setTimeout(run, 0);
    }
  }

  function serviceSettings() {
    if (destroyed) return;
    const dialog = document.querySelector('.settings-dialog');
    if (!dialog) {
      if (settingsDialog) resetSettingsUi();
      return;
    }
    const list = dialog.querySelector('.settings-tab-list');
    const body = dialog.querySelector('.settings-region .body');
    if (!list) return;
    if (dialog !== settingsDialog) {
      resetSettingsUi();
      dialog.querySelectorAll(`#${SETTINGS_TAB_ID}`).forEach((node) => node.remove());
      dialog.querySelectorAll(`#${SETTINGS_PANEL_ID}`).forEach((node) => node.remove());
      settingsDialog = dialog;
      injectSettingsStyle();
    }
    if (settingsList !== list) {
      if (settingsList) settingsList.removeEventListener('click', onTabListClick, true);
      settingsList = list;
      list.addEventListener('click', onTabListClick, true);
      watchSettingsList(list);
    }
    if (body && settingsBody !== body) {
      settingsBody = body;
      if (settingsPanel && !body.contains(settingsPanel)) {
        if (settingsPanel.isConnected) settingsPanel.remove();
        settingsPanel = null;
        settingsControls = null;
      }
    }
    if (!settingsTab || !list.contains(settingsTab)) {
      list.querySelectorAll(`#${SETTINGS_TAB_ID}`).forEach((node) => node.remove());
      if (settingsTab && settingsTab.isConnected) settingsTab.remove();
      settingsTab = buildSettingsTab();
      list.appendChild(settingsTab);
    } else {
      for (const node of list.querySelectorAll(`#${SETTINGS_TAB_ID}`)) {
        if (node !== settingsTab) node.remove();
      }
    }
    // The tab is already in the DOM; defer the heavier panel to the next frame
    // so mounting the tab stays on the fast path.
    if (settingsBody && settingsBody.isConnected && (!settingsPanel || !settingsBody.contains(settingsPanel))) {
      scheduleSettingsPanel();
    }
    syncSettingsActive();
  }

  function scheduleSettings() {
    if (destroyed || settingsScheduled) return;
    settingsScheduled = true;
    queueMicrotask(() => {
      settingsScheduled = false;
      if (destroyed) return;
      if (settingsNeedsService()) serviceSettings();
    });
  }

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

  function normalize(input) {
    const s = { ...DEFAULTS, ...(input && typeof input === 'object' ? input : {}) };
    return {
      enabled: s.enabled !== false,
      source: SOURCES.includes(s.source) ? s.source : 'auto',
      preset: Object.prototype.hasOwnProperty.call(PRESETS, s.preset) ? s.preset : 'aurora',
      file: typeof s.file === 'string' && s.file.trim() !== '' ? s.file.trim() : null,
      fit: FITS.includes(s.fit) ? s.fit : 'cover',
      position: POSITIONS.includes(s.position) ? s.position : 'center',
      opacity: round(clamp(num(s.opacity, DEFAULTS.opacity), 0, 1)),
      blur: round(clamp(num(s.blur, DEFAULTS.blur), 0, 32)),
      dim: round(clamp(num(s.dim, DEFAULTS.dim), 0, 0.9)),
      glass: round(clamp(num(s.glass, DEFAULTS.glass), 0, 0.95)),
      tips: s.tips !== false,
      customName: typeof s.customName === 'string' ? s.customName : '',
    };
  }

  async function loadConfig() {
    try {
      const response = await fetch(CONFIG_URL, { cache: 'no-store' });
      if (!response.ok) return {};
      return await response.json();
    } catch {
      return {};
    }
  }

  function readSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const out = {};
      for (const key of SETTING_KEYS) {
        if (Object.prototype.hasOwnProperty.call(raw, key)) out[key] = raw[key];
      }
      return out;
    } catch {
      return {};
    }
  }

  function saveSettings() {
    try {
      const out = {};
      for (const key of SETTING_KEYS) out[key] = state[key];
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(out));
      settings = out;
    } catch {
      // localStorage may be unavailable; the session still works.
    }
  }

  function resolveSource() {
    if (!state.enabled || state.source === 'none') return { type: 'none' };
    if (state.source === 'custom') {
      if (customUrl) return { type: 'image', url: customUrl };
      if (state.file) return { type: 'image', url: new URL(state.file, ASSET_BASE).href };
      if (state.preset !== 'none') return { type: 'preset', preset: state.preset };
      return { type: 'none' };
    }
    if (state.source === 'preset') {
      return state.preset === 'none' ? { type: 'none' } : { type: 'preset', preset: state.preset };
    }
    if (state.file) return { type: 'image', url: new URL(state.file, ASSET_BASE).href };
    if (state.preset === 'none') return { type: 'none' };
    return { type: 'preset', preset: state.preset };
  }

  function injectStyle() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = PAGE_CSS;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function createLayer() {
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();
    layer = document.createElement('div');
    layer.id = ROOT_ID;
    layer.setAttribute('aria-hidden', 'true');
    photo = document.createElement('div');
    photo.className = 'kw-photo';
    media = document.createElement('div');
    media.className = 'kw-media';
    veil = document.createElement('div');
    veil.className = 'kw-veil';
    layer.appendChild(photo);
    layer.appendChild(media);
    layer.appendChild(veil);
    document.body.insertBefore(layer, document.body.firstChild);
  }

  function createDebug() {
    const existing = document.getElementById(DEBUG_ID);
    if (existing) existing.remove();
    debugEl = document.createElement('pre');
    debugEl.id = DEBUG_ID;
    debugEl.hidden = true;
    document.body.appendChild(debugEl);
  }

  function bindShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && (event.key === 'W' || event.key === 'w')) {
        event.preventDefault();
        toggleDebug();
      }
    });
  }

  function describeElement(node) {
    if (!node) return 'null';
    const cls = typeof node.className === 'string' ? node.className.trim() : '';
    const id = node.id ? `#${node.id}` : '';
    const classes = cls ? `.${cls.split(/\s+/).join('.')}` : '';
    const cs = getComputedStyle(node);
    const bg = cs.backgroundColor;
    const img = cs.backgroundImage === 'none' ? 'none' : cs.backgroundImage.slice(0, 90);
    return `<${node.tagName.toLowerCase()}${id}${classes}> bg=${bg} img=${img} backdrop=${cs.backdropFilter} filter=${cs.filter} opacity=${cs.opacity} z=${cs.zIndex} pos=${cs.position}`;
  }

  function debugText() {
    const lines = [];
    lines.push(`Kimi Wallpaper debug (${WALLPAPER_BUILD}) · Ctrl+Shift+W 关闭`);
    lines.push(
      `state: source=${state.source} preset=${state.preset} file=${state.file || '-'} fit=${state.fit} position=${state.position} opacity=${state.opacity} blur=${state.blur} dim=${state.dim} glass=${state.glass} tips=${state.tips}`
    );
    const layer = document.getElementById(ROOT_ID);
    if (layer) {
      const photo = layer.querySelector('.kw-photo');
      const media = layer.querySelector('.kw-media');
      const veil = layer.querySelector('.kw-veil');
      const pc = photo ? getComputedStyle(photo) : null;
      const mc = media ? getComputedStyle(media) : null;
      const vc = veil ? getComputedStyle(veil) : null;
      lines.push(
        `layer: hidden=${layer.hidden} photo bg=${pc ? pc.backgroundImage.slice(0, 120) : '-'} size=${pc ? pc.backgroundSize : '-'} pos=${pc ? pc.backgroundPosition : '-'} opacity=${pc ? pc.opacity : '-'} backdrop=${mc ? mc.backdropFilter : '-'} veil=${vc ? `${vc.backgroundColor}/${vc.opacity}` : '-'}`
      );
    } else {
      lines.push('layer: missing');
    }
    const points = [
      ['center', innerWidth * 0.5, innerHeight * 0.5],
      ['main-left', innerWidth * 0.42, innerHeight * 0.5],
      ['main-right', innerWidth * 0.72, innerHeight * 0.5],
      ['topbar', innerWidth * 0.5, 20],
      ['sidebar-top', innerWidth * 0.1, 100],
      ['sidebar-tabs', innerWidth * 0.1, 170],
      ['sidebar-footer', innerWidth * 0.1, innerHeight - 40],
      ['panel-menu', innerWidth * 0.86, 170],
      ['bottom', innerWidth * 0.5, innerHeight - 90],
    ];
    for (const [name, x, y] of points) {
      lines.push(`--- ${name} (${Math.round(x)},${Math.round(y)})`);
      let node = document.elementFromPoint(x, y);
      for (let i = 0; node && i < 10; i += 1) {
        lines.push(`${i}: ${describeElement(node)}`);
        node = node.parentElement;
      }
    }
    return lines.join('\n');
  }

  function toggleDebug() {
    if (!debugEl) return;
    if (debugEl.hidden) {
      debugEl.textContent = debugText();
      debugEl.hidden = false;
    } else {
      debugEl.hidden = true;
    }
  }

  function enforceSurfaces() {
    // Safe mode: no inline overrides. The app keeps its own surfaces.
  }

  function updateFade() {
    const dock = document.querySelector('.chat-dock');
    const composer = document.querySelector('.composer-card');
    const panes = document.querySelector('.panes');
    const height = Math.max(
      dock ? dock.getBoundingClientRect().height : 0,
      composer ? composer.getBoundingClientRect().height : 0,
      96
    );
    const total = Math.max(1, panes ? panes.getBoundingClientRect().height : window.innerHeight);
    const fadeLength = Math.round(Math.max(80, Math.min(120, height * 0.8)));
    const maxEnd = Math.max(0, Math.round(total - 16));
    const end = Math.min(Math.round(height + 8), maxEnd);
    const start = Math.min(end + fadeLength, maxEnd);
    const root = document.documentElement.style;
    root.setProperty('--kw-fade-start', `${start}px`);
    root.setProperty('--kw-fade-end', `${end}px`);
  }

  function updateListFade(list) {
    const top = list.scrollTop > 0;
    const bottom = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
    const fade = top && bottom ? 'both' : top ? 'top' : bottom ? 'bottom' : '';
    if (fade) {
      if (list.dataset.kwFade !== fade) list.dataset.kwFade = fade;
    } else if (list.dataset.kwFade) {
      delete list.dataset.kwFade;
    }
  }

  function updateListFades() {
    for (const list of document.querySelectorAll(FADE_LIST_SELECTOR)) updateListFade(list);
  }

  function scheduleListFades() {
    if (listFadeFrame || destroyed) return;
    listFadeFrame = window.requestAnimationFrame(() => {
      listFadeFrame = 0;
      if (!destroyed) updateListFades();
    });
  }

  function onListScroll(event) {
    const target = event.target;
    if (target && typeof target.matches === 'function' && target.matches(FADE_LIST_SELECTOR)) {
      updateListFade(target);
    }
  }

  function scheduleEnforce() {
    if (enforceTimer) return;
    enforceTimer = setTimeout(() => {
      enforceTimer = 0;
      enforceSurfaces();
      updateFade();
    }, 300);
  }

  function apply() {
    if (!layer) return;
    const source = resolveSource();
    const on = state.enabled && source.type !== 'none';
    document.documentElement.classList.toggle('kimi-wallpaper-on', on);
    document.documentElement.classList.toggle('kw-tips-on', on && state.tips);
    layer.hidden = !on;
    updateSettingsUi();
    if (!on) return;

    const root = document.documentElement.style;
    root.setProperty('--kw-opacity', String(state.opacity));
    root.setProperty('--kw-blur', `${state.blur}px`);
    root.setProperty('--kw-dim', String(state.dim));
    const alpha = Math.round((1 - state.glass) * 100);
    root.setProperty(
      '--kw-surface',
      `color-mix(in srgb, var(--color-bg, #121212) ${alpha}%, transparent)`
    );
    root.setProperty(
      '--kw-sidebar-surface',
      `color-mix(in srgb, var(--color-sidebar-bg, var(--color-bg, #121212)) ${alpha}%, transparent)`
    );
    const cardAlpha = Math.max(12, Math.min(64, alpha - 18));
    const headerAlpha = Math.max(18, Math.min(72, alpha - 8));
    // Code blocks and file-change cards get one readable glass layer; code
    // block renderers stay transparent so the wallpaper shows through.
    const glassAlpha = Math.max(48, Math.min(84, cardAlpha + 26));
    const glassHeaderAlpha = Math.min(90, glassAlpha + 8);
    root.setProperty(
      '--kw-card-surface',
      `color-mix(in srgb, var(--color-surface-raised, #292929) ${cardAlpha}%, transparent)`
    );
    root.setProperty(
      '--kw-card-header',
      `color-mix(in srgb, var(--color-surface-raised, #292929) ${headerAlpha}%, transparent)`
    );
    root.setProperty(
      '--kw-glass-surface',
      `color-mix(in srgb, var(--color-surface-raised, #292929) ${glassAlpha}%, transparent)`
    );
    root.setProperty(
      '--kw-glass-header',
      `color-mix(in srgb, var(--color-surface-raised, #292929) ${glassHeaderAlpha}%, transparent)`
    );
    root.setProperty(
      '--kw-card-border',
      'color-mix(in srgb, var(--color-line, rgba(255, 255, 255, 0.18)) 90%, transparent)'
    );
    const dialogAlpha = Math.max(14, Math.min(70, alpha - 18));
    root.setProperty(
      '--kw-dialog-surface',
      `color-mix(in srgb, var(--color-surface-raised, #292929) ${dialogAlpha}%, transparent)`
    );
    // Menus float over arbitrary text and photos, so they keep a much higher
    // floor than the sidebar or cards. Too little surface turns white labels
    // into a grey blur over a bright wallpaper.
    const menuAlpha = Math.max(80, Math.min(95, alpha + 44));
    root.setProperty(
      '--kw-menu-surface',
      `color-mix(in srgb, var(--color-menu-bg, #1f1f1f) ${menuAlpha}%, transparent)`
    );
    const tipAlpha = Math.max(20, Math.min(92, alpha + 16));
    root.setProperty(
      '--kw-tip-surface',
      `color-mix(in srgb, var(--color-menu-bg, #1f1f1f) ${tipAlpha}%, transparent)`
    );
    const activeAlpha = Math.max(32, Math.min(88, alpha + 8));
    root.setProperty(
      '--kw-active-surface',
      `color-mix(in srgb, var(--color-surface-raised, #292929) ${activeAlpha}%, transparent)`
    );
    scheduleEnforce();
    media.classList.toggle('has-blur', state.blur > 0);

    if (source.type === 'image') {
      layer.style.background = 'var(--color-bg, #121212)';
      photo.style.backgroundImage = `url("${source.url}")`;
      photo.style.backgroundSize =
        state.fit === 'cover' ? 'cover' : state.fit === 'contain' ? 'contain' : 'auto';
      photo.style.backgroundRepeat = state.fit === 'tile' ? 'repeat' : 'no-repeat';
      const positions = {
        center: 'center center',
        top: 'center top',
        bottom: 'center bottom',
        left: 'left center',
        right: 'right center',
      };
      photo.style.backgroundPosition = positions[state.position] || 'center center';
    } else {
      layer.style.background = 'var(--color-bg, #121212)';
      photo.style.backgroundImage = PRESETS[source.preset].css;
      photo.style.backgroundSize = 'cover';
      photo.style.backgroundRepeat = 'no-repeat';
      photo.style.backgroundPosition = 'center center';
    }
    try {
      updateFade();
    } catch {
      // The wallpaper must stay visible even if fade measurement fails.
    }
  }

  function currentLabel() {
    if (!state.enabled) return '壁纸已关闭';
    if (state.source === 'custom' && customUrl) {
      return customName ? `本地图片：${customName}` : '本地图片';
    }
    if (state.source === 'preset') {
      return state.preset === 'none' ? '未使用壁纸' : `内置渐变：${PRESETS[state.preset].label}`;
    }
    if (state.file) return `插件图片：${state.file}`;
    if (state.preset === 'none') return '未使用壁纸';
    return `内置渐变：${PRESETS[state.preset].label}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB 不可用'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败'));
    });
  }

  async function idbPut(blob) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(blob, 'custom');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('保存失败'));
    });
    db.close();
  }

  async function idbGet() {
    const db = await openDb();
    const blob = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const request = tx.objectStore(DB_STORE).get('custom');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('读取失败'));
    });
    db.close();
    return blob;
  }

  async function idbDelete() {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete('custom');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('删除失败'));
    });
    db.close();
  }

  async function chooseFile(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      flash('请选择图片文件');
      return;
    }
    try {
      await idbPut(file);
      if (customUrl) URL.revokeObjectURL(customUrl);
      customUrl = URL.createObjectURL(file);
      customName = file.name || '本地图片';
      customAvailable = true;
      state.source = 'custom';
      state.enabled = true;
      state.customName = customName;
      commit();
      flash('壁纸已更新');
    } catch (err) {
      flash(`保存失败：${err && err.message ? err.message : err}`);
    }
  }

  async function resetAll() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch {
      // ignore
    }
    settings = {};
    try {
      await idbDelete();
    } catch {
      // ignore
    }
    if (customUrl) {
      URL.revokeObjectURL(customUrl);
      customUrl = null;
    }
    customName = '';
    customAvailable = false;
    config = normalize(await loadConfig());
    state = normalize(config);
    commit();
    flash('已恢复默认');
  }

  async function refreshConfig() {
    const next = normalize(await loadConfig());
    config = next;
    settings = readSettings();
    state = normalize({ ...config, ...settings });
    if (!customUrl && state.customName) customName = state.customName;
    apply();
    updateSettingsUi();
  }

  async function init() {
    config = normalize(await loadConfig());
    settings = readSettings();
    state = normalize({ ...config, ...settings });
    customName = state.customName || '';
    injectStyle();
    createLayer();
    createDebug();
    bindShortcuts();
    if (state.source === 'custom') {
      try {
        const blob = await idbGet();
        if (blob) {
          customUrl = URL.createObjectURL(blob);
          customAvailable = true;
          if (!customName) customName = '本地图片';
        }
      } catch {
        // No custom image: fall back to the configured file or preset.
      }
    }
    apply();
    updateSettingsUi();
    surfaceObserver = new MutationObserver(() => {
      scheduleEnforce();
      scheduleListFades();
    });
    surfaceObserver.observe(document.body, { childList: true, subtree: true });
    settingsObserver = new MutationObserver((records) => {
      if (settingsRelevant(records)) scheduleSettings();
    });
    settingsObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleEnforce);
    window.addEventListener('resize', scheduleListFades);
    document.addEventListener('scroll', onListScroll, true);
    scheduleEnforce();
    serviceSettings();
    refreshTimer = window.setInterval(() => {
      if (!document.hidden) {
        refreshConfig();
        serviceSettings();
      }
    }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        refreshConfig();
        serviceSettings();
      }
    });
    window.__kimiWallpaper = {
      apply,
      refresh: refreshConfig,
      destroy,
      get state() {
        return state;
      },
      get config() {
        return config;
      },
    };
  }

  function destroy() {
    destroyed = true;
    clearInterval(refreshTimer);
    cancelSettingsPanel();
    window.removeEventListener('resize', scheduleEnforce);
    window.removeEventListener('resize', scheduleListFades);
    document.removeEventListener('scroll', onListScroll, true);
    clearTimeout(enforceTimer);
    enforceTimer = 0;
    if (listFadeFrame) window.cancelAnimationFrame(listFadeFrame);
    listFadeFrame = 0;
    for (const list of document.querySelectorAll(FADE_LIST_SELECTOR)) delete list.dataset.kwFade;
    if (surfaceObserver) surfaceObserver.disconnect();
    surfaceObserver = null;
    if (settingsObserver) settingsObserver.disconnect();
    settingsObserver = null;
    if (customUrl) URL.revokeObjectURL(customUrl);
    customUrl = null;
    document.documentElement.classList.remove('kimi-wallpaper-on');
    document.documentElement.classList.remove('kw-tips-on');
    if (settingsTab) settingsTab.remove();
    if (settingsPanel) settingsPanel.remove();
    resetSettingsUi();
    if (layer) layer.remove();
    if (debugEl) debugEl.remove();
    if (styleEl) styleEl.remove();
    if (settingsStyleEl) settingsStyleEl.remove();
    layer = null;
    photo = null;
    media = null;
    veil = null;
    debugEl = null;
    styleEl = null;
    settingsStyleEl = null;
    if (window.__kimiWallpaper) window.__kimiWallpaper = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
