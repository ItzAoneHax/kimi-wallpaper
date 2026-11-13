# Kimi 壁纸

给 Kimi Code 换背景图。壁纸铺在 **页面本身** 的最底层，不是独立窗口：主聊天区透明，侧栏、聊天头部和右侧面板变成半透明，文字仍然可读。支持本地图片、五种内置渐变，以及透明度 / 模糊 / 遮罩 / 面板透明度调节。

## 特性

- **本地图片**：png / jpg / jpeg / webp / gif / avif / bmp。
- **内置渐变**：极光、日落、午夜、森林、纸张；`none` 恢复原背景。
- **页内设置**：设置 → 壁纸，换图、调参即时生效，设置保存在本机页面。
- **悬浮提示跟随主题**：鼠标悬停气泡改成和面板一致的半透明毛玻璃，可在设置里单独开关；关闭后保留 Kimi 原生反色气泡。
- **主题适配**：浅色 / 深色主题自动匹配遮罩和面板颜色。
- **自动修复**：常驻看门狗每 20 秒检查一次，Kimi Code 更新替换 `desktop-dist` 后自动补回注入。
- **零运行时依赖**：只用 Node.js 内置模块；页内脚本是单文件原生 JS，不需要打包器。

## 安装

在 Kimi Code 里执行（把路径换成实际克隆位置）：

```text
/plugins install D:\Repositories\kimi-code-plugins\kimi-wallpaper
```

然后 `/reload` 或开一个新会话。插件 id 是 `kimi-wallpaper`，命令是 `/kimi-wallpaper:wallpaper`。

安装插件后，把页内脚本装进客户端：

```powershell
$wp = "$env:KIMI_CODE_HOME\plugins\managed\kimi-wallpaper\lib\cli.mjs"
node $wp install
```

**完整退出并重新打开 Kimi Code**（或在窗口里按 Ctrl+R）。默认会使用极光渐变；打开 **设置 → 壁纸** 即可换图和调参。

> 插件安装后会被复制到 `$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/`；之后修改源码需要重新安装或让插件管理器更新。

## 使用

### 设置 › 壁纸

打开 Kimi Code 的 **设置**，左侧导航底部（“已归档的会话”下面）会多出一个 **壁纸** 页签：

- 六个渐变按钮：极光 / 日落 / 午夜 / 森林 / 纸张 / 无。
- “选择本地图片…”：从本机选图，立即生效；图片存在浏览器 IndexedDB，不上传。
- “用插件图片”：切回 CLI 设置的图片（如果有）。
- 铺放方式：铺满 / 完整 / 平铺；对齐：居中 / 左 / 右 / 上 / 下。
- “本地图片”：切回之前选过的本地图片；选过渐变后也能一键切回。
- 壁纸透明度、模糊、主题遮罩、面板透明度四个滑杆。
- “悬浮提示跟随主题”：鼠标悬停气泡（token 用量、模型、按钮提示等）改用半透明毛玻璃背景，并跟随“面板透明度”；关闭后恢复 Kimi 原生的反色实心气泡。
- 代码块、文件变更卡、进度卡、输入框和用户气泡也会变成半透明卡片，带边框和轻阴影，和壁纸保持区分度。
- 输入框上方改用 CSS 渐变遮罩，聊天文字会在输入框上方淡出，不再依赖 Kimi Code 自带的阴影。
- “恢复默认”：清掉页内设置和本地图片，回到 `config.json` 的默认值。

壁纸页设置优先级高于 CLI 的 `config.json`。在壁纸页里选过本地图片后，CLI 的 `set` 不会自动覆盖它；点“用插件图片”即可切回。

壁纸页完全复用 Kimi Code 设置弹窗自己的 tab、分组卡片、开关、分段控件和按钮样式；打开设置时自动注入，关闭后自动清理。

### CLI

```powershell
$wp = "$env:KIMI_CODE_HOME\plugins\managed\kimi-wallpaper\lib\cli.mjs"

node $wp install                          # 安装/更新页内壁纸，并启动自动修复
node $wp remove                           # 移除注入，并关闭自动修复
node $wp status                           # 注入、当前壁纸、自动修复
node $wp status --json                    # 给程序读
node $wp set "D:\Pictures\wall.jpg"       # 用本地图片
node $wp set "D:\Pictures\wall.jpg" --dim 0.45 --blur 4 --glass 0.7
node $wp preset midnight                  # 内置渐变
node $wp preset none                      # 关闭壁纸，恢复原背景
node $wp config --opacity 0.8 --dim 0.4   # 只调外观
node $wp reset                            # 恢复默认极光渐变
node $wp doctor                           # 逐项自检
```

`set` / `config` 参数：

| 参数 | 范围 | 默认 | 说明 |
| --- | --- | --- | --- |
| `--fit` | `cover` / `contain` / `tile` | `cover` | 铺满 / 完整 / 平铺 |
| `--position` | `center` / `top` / `bottom` / `left` / `right` | `center` | 图片对齐位置；图片被裁切时可把主体移到主区 |
| `--opacity` | 0–1 | `1` | 壁纸本身透明度 |
| `--blur` | 0–32 | `0` | 壁纸模糊像素 |
| `--dim` | 0–0.9 | `0.35` | 主题色遮罩强度，越大文字越清楚 |
| `--glass` | 0–0.95 | `0.6` | 侧栏/面板透明度，越大面板越透明 |
| `--tips` | `on` / `off` | `on` | 鼠标悬停提示气泡是否跟随主题改成半透明毛玻璃 |

也可以在对话里直接用：

```text
/kimi-wallpaper:wallpaper 把背景换成 D:\Pictures\wall.jpg
/kimi-wallpaper:wallpaper 换成午夜渐变
/kimi-wallpaper:wallpaper 壁纸太花了，遮罩调高一点
```

## 为什么需要注入

Kimi Code 的插件系统目前只提供 skills、commands、hooks 和 interface 元数据，没有往主界面插 DOM 的官方字段；主界面响应头还带有严格 CSP（`script-src 'self'`）。因此这个插件采用最小化的页面注入：

- 在 `resources/desktop-dist/index.html` 的主模块前插入一段带标记的 `<script src="/assets/kimi-wallpaper/kimi-wallpaper.js">`。
- 把页内脚本、配置和图片放到 `resources/desktop-dist/assets/kimi-wallpaper/`。
- 不改 `app.asar`，不改可执行文件，不申请管理员权限（安装目录本身可写即可）。
- `remove` 会删掉标记和素材，并关闭自动修复；页面恢复原样。
- 注入思路参考同仓库的 `kimi-pet`（MIT）。

页内脚本只做三件事：

1. 在 `body` 里放一个固定全屏壁纸层（`z-index: 0`），把 `#app` 提到 `z-index: 1` 并透明化。
2. 用 CSS 变量把 `.app`、`.side`、`.chat-header`、`.ptt` 等主要表面改成半透明。
3. 在设置弹窗里追加“壁纸”页签，并用 Kimi Code 原生的分组卡片、开关、分段控件和按钮渲染设置页。

## 数据目录

`~/.kimi-code/wallpaper/`（可用 `KIMI_WALLPAPER_HOME` 改）：

| 文件 | 内容 |
| --- | --- |
| `config.json` | CLI 的壁纸配置（渐变、图片、外观参数） |
| `wallpaper.<ext>` | `set` 复制进来的图片 |
| `watch.json` | 自动修复进程状态、最近检查/动作 |
| `watch.log` | 自动修复日志 |
| `inpage-disabled.json` | `remove` 写入的关闭标记；`install` 删除 |
| `wallpaper.log` | CLI 安装/移除日志 |

壁纸页自己的设置和本地图片在浏览器里：`localStorage['kimi-wallpaper.settings.v1']` 和 IndexedDB 的 `kimi-wallpaper/images`。不会写到磁盘文件，也不会上传。

## 自动修复

`install` 会拉起一个常驻的 Node 看门狗（`lib/watch.mjs`），默认每 **20 秒**检查一次：

- 注入标记是否还在；
- 页内脚本是否与插件源码一致；
- `config.json` 是否与数据目录一致；
- 配置里的图片是否还在。

Kimi Code 更新会替换 `desktop-dist`；看门狗发现丢失后会自动重新写入，通常在下一次启动前完成。插件升级、脚本过期、文件误删也会自动修。检测到 `KimiCode-<版本>-win-x64.exe` 更新安装器正在运行时，看门狗会暂停写入，等安装器退出后再恢复。

`remove` 会先关闭自动修复再删注入；`install` 重新开启。`stop` 不存在：想停自动修复就 `remove`（会同时移除壁纸），或者直接杀掉 `watch.json` 里的 pid。

## 排障

| 现象 | 处理 |
| --- | --- |
| 设置里没有“壁纸”页签 | `node $wp status`；未安装就 `install`，然后重启 Kimi Code 或按 Ctrl+R |
| 壁纸没变化 | 面板里可能选过“本地图片”；点“用插件图片”或“恢复默认”。CLI 改动最多 30 秒自动读取 |
| 文字看不清 | 调高“主题遮罩”或“面板透明度”；`config --dim 0.5 --glass 0.75` |
| 图片没显示 | 确认路径存在且格式受支持；`doctor` 检查配置里的图片 |
| Kimi Code 更新后消失 | 看 `status` 的自动修复；未运行就 `install`。目录需要管理员权限时用管理员身份运行 |
| 提示没有写入权限 | 用管理员身份运行一次 `install` |
| 想恢复原背景 | `preset none`；彻底移除用 `remove`，重启后再 `/plugins remove kimi-wallpaper` |

调试页内脚本：在 Kimi Code 里按 **Ctrl+Shift+W** 会打开诊断面板，列出主区、侧栏头/标签/底部、顶部标题栏和右侧菜单中心元素的逐级背景色、背景图、滤镜与层级；再按一次关闭。也可以执行 `window.__kimiWallpaper.state` 看当前状态。

## 开发

```powershell
node lib/cli.mjs install          # 把当前源码写入本机 Kimi Code
node lib/cli.mjs status           # 检查注入是否与源码一致
node lib/cli.mjs doctor           # 逐项自检
```

文件分工：

- `web/inpage/wallpaper.js`：页内壁纸层、渐变、设置面板、IndexedDB 本地图片。
- `lib/inpage.mjs`：同步素材、注入/还原 `desktop-dist/index.html`。
- `lib/config.mjs`：配置规范化与读写。
- `lib/watch.mjs` / `lib/watchdog.mjs`：自动修复。
- `lib/cli.mjs`：命令行入口。
- `hooks/session-start.mjs`：SessionStart 时静默确保注入和看门狗。

## 已知限制

- 需要 Kimi Code 桌面端；纯 CLI 没有页面可注入。
- 注入的是 Kimi Code 安装目录；客户端更新会覆盖，正常情况下看门狗会自动补回。
- 自动修复是用户态进程，不能自行提权；安装目录只读时需要管理员执行一次 `install`。
- 壁纸页的“选择本地图片”依赖浏览器 IndexedDB；清理浏览器数据后会回退到插件图片或渐变。
- 不同 Kimi Code 版本的类名可能变化；主要依赖 `.app`、`.side`、`.chat-header`、`.ptt` 这些稳定类名。如果新版本改了大面积背景，用 `config --glass` 先缓解，再更新选择器。

## 许可

MIT，见 [LICENSE](LICENSE)。注入与自动修复思路参考同仓库的 `kimi-pet`（MIT）。
