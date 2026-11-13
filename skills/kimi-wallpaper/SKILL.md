---
name: kimi-wallpaper
description: 给 Kimi Code 换背景图：设置本地图片或内置渐变，调整透明度/模糊/遮罩/面板透明度，排查壁纸不显示或客户端更新后丢失的问题。
---

# Kimi 壁纸

这个插件把壁纸铺在 **Kimi Code 页面本身**的最底层，不是独立窗口。主聊天区保持透明，侧栏、聊天头部和右侧面板改成半透明，所以壁纸能透出来，文字仍然可读。插件提供 skill / command / hook；页内脚本由 `install` 命令写入 Kimi Code 的 `resources/desktop-dist`。

## 快速命令

插件根目录：`$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper`（Windows 上通常是 `C:\Users\<你>\.kimi-code\plugins\managed\kimi-wallpaper`）。

```bash
node "$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/lib/cli.mjs" install   # 安装/更新页内壁纸，并启动自动修复
node "$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/lib/cli.mjs" remove    # 移除注入，并关闭自动修复
node "$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/lib/cli.mjs" status    # 注入、当前壁纸、自动修复
node "$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/lib/cli.mjs" set "D:\Pictures\wall.jpg" --dim 0.45
node "$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/lib/cli.mjs" preset midnight
node "$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/lib/cli.mjs" config --glass 0.7 --blur 6
node "$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/lib/cli.mjs" reset     # 恢复默认极光渐变
node "$KIMI_CODE_HOME/plugins/managed/kimi-wallpaper/lib/cli.mjs" doctor    # 逐项自检
```

安装或更新页内脚本后必须**重启 Kimi Code**（完整退出再打开），或在窗口里按 **Ctrl+R** 刷新；页面 HTML 只在窗口创建/刷新时读取。SessionStart hook 会静默确保注入存在，但同样要下次启动才生效。

## 三种换图方式

1. **CLI 设置本地图片**：`set <图片路径>`。图片会复制到 `$KIMI_CODE_HOME/wallpaper/wallpaper.<ext>`，再同步到页面的 `assets/kimi-wallpaper/`。支持 png / jpg / jpeg / webp / gif / avif / bmp。
2. **设置 › 壁纸**：打开 Kimi Code 设置，左侧导航底部（“已归档的会话”下面）有“壁纸”页签。可以选本地图片、切换内置渐变、调整铺放方式/对齐、调透明度/模糊/遮罩/面板透明度。页内选的图片存在浏览器 IndexedDB 里，不上传、不写磁盘；切换过渐变后点“本地图片”可以切回。代码块、文件变更卡、进度卡、输入框和用户气泡会显示为半透明卡片，带边框和轻阴影；输入框上方使用 CSS 渐变遮罩，聊天文字会在输入框上方淡出。
3. **内置渐变**：`preset aurora|sunset|midnight|forest|paper|none`。`none` 会关闭壁纸层，恢复 Kimi Code 原背景。

壁纸页的改动保存在 `localStorage['kimi-wallpaper.settings.v1']`，优先级高于 CLI 写的 `config.json`。如果选过“本地图片”，CLI 的 `set` 不会自动覆盖它；在壁纸页点“用插件图片”即可切回 CLI 配置。

## 参数

`set` 和 `config` 支持：

| 参数 | 范围 | 说明 |
| --- | --- | --- |
| `--fit` | `cover` / `contain` / `tile` | 铺满 / 完整显示 / 平铺 |
| `--position` | `center` / `top` / `bottom` / `left` / `right` | 图片对齐位置；图片被裁切时可把主体移到主区 |
| `--opacity` | 0–1 | 壁纸本身透明度 |
| `--blur` | 0–32 | 壁纸模糊像素 |
| `--dim` | 0–0.9 | 主题色遮罩强度，越大文字越清楚 |
| `--glass` | 0–0.95 | 侧栏/面板的透明度，越大面板越透明 |

默认值：`cover`、`center`、`1`、`0`、`0.35`、`0.6`。

## 自动修复（Kimi Code 更新）

`install` 会拉起一个常驻的 Node 看门狗（`lib/watch.mjs`），默认每 **20 秒**检查一次：

- `desktop-dist/index.html` 里的注入标记是否还在；
- `assets/kimi-wallpaper/kimi-wallpaper.js` 是否与当前插件源码一致；
- `assets/kimi-wallpaper/config.json` 是否与数据目录一致；
- 配置里的图片是否还在。

Kimi Code 更新会替换 `desktop-dist`。看门狗发现标记/文件丢失后会自动重新写入，通常在下一次启动前完成。插件升级、脚本过期、文件误删也会自动修。检测到 `KimiCode-<版本>-win-x64.exe` 更新安装器正在运行时，看门狗会暂停写入，等安装器退出后再恢复。

状态和日志：

- `$KIMI_CODE_HOME/wallpaper/watch.json`：`pid`、`lastCheckAt`、`lastAction`、`lastError`。
- `$KIMI_CODE_HOME/wallpaper/watch.log`：每次修复/错误的记录。
- `$KIMI_CODE_HOME/wallpaper/inpage-disabled.json`：`remove` 写入的关闭标记；`install` 删除它。

`remove` 会先关闭自动修复再删注入，避免“刚删掉又被装回来”；`install` 重新开启。

**限制**：自动修复以当前用户权限运行，不能自行提权。如果 Kimi Code 装在只读/需要管理员权限的目录，更新后需要用管理员身份运行一次 `install`。

## 排查

- **设置里没有“壁纸”页签/壁纸没变化**：先 `status`。`installed=false` 就 `install`，然后重启 Kimi Code 或按 Ctrl+R。确认 Kimi Code 安装目录可写；如果提示没有权限，用管理员身份运行一次 `install`。
- **Kimi Code 更新后消失**：先看 `status` 的“自动修复”和“最近检查”。如果看门狗没运行，`install` 会重启它；如果目录需要管理员权限，用管理员身份执行。
- **壁纸太花、文字看不清**：在面板里调高“主题遮罩”或“面板透明度”，也可以 `config --dim 0.5 --glass 0.75`。
- **图片没显示**：确认 `set` 的路径存在且是支持的格式；`doctor` 会检查配置里的图片是否还在。页内选的图片如果被浏览器清掉 IndexedDB，会回退到插件图片或渐变。如果只有某一块区域没透出壁纸，在页面里按 `Ctrl+Shift+W` 打开诊断面板，它会列出该区域中心元素的逐级背景/滤镜/层级；把结果或截图发给助手即可定位选择器。
- **想恢复原背景**：`preset none`；想彻底移除注入用 `remove`，再重启 Kimi Code。
- **想彻底卸载插件**：先 `remove`，重启 Kimi Code，再用 `/plugins remove kimi-wallpaper`。

## 边界

- 只修改 `resources/desktop-dist/index.html` 里一段带标记的 `<script>`，并把素材放到 `resources/desktop-dist/assets/kimi-wallpaper/`；不改 `app.asar`，不改可执行文件。
- 自动修复只在本机运行，只读写 Kimi Code 安装目录和 `$KIMI_CODE_HOME/wallpaper/`，不联网。
- 页内脚本只请求同源的 `/assets/kimi-wallpaper/config.json` 和配置里的图片；不向第三方发送数据，不读取任何 token。
- 壁纸页通过给设置弹窗追加一个“壁纸”页签工作，复用 Kimi Code 自己的分组卡片、开关、分段控件和按钮；关闭设置后自动清理，不影响页面其他区域。
