# LibertyJS 1.0 — 让网页重新属于你

> 一个用户脚本（Tampermonkey）就能夺回对网页的控制权：绕过反调试、反复制、反水印、全屏检测、无痕模式检测等 20 类限制。

**开源地址**：[开源地址](https://github.com/XiaoTian38438/LibertyJS)
**直接下载**：[网盘地址](https://wwbmi.lanzoub.com/iarT346v714j)

---

## 背景

互联网本应是开放的，但越来越多的网站开始给我们设限：

- 想复制一段文字？**「该内容禁止复制」**
- 想按 F12 看看请求？**页面陷入 `debugger` 死循环**
- 切到别的标签页看会儿资料？**「检测到你离开页面，已暂停播放」**
- 用无痕模式打开？**「请在正常模式下访问」**
- 想截图保存？**整页都是隐形水印，工号、姓名到处都是**

LibertyJS 就是为这些场景而生的。它是一个用户脚本，安装到篡改猴（Tampermonkey）后即可在任何网站生效，提供 20 个可独立开关的"反限制"模块，并附带一个可视化配置面板。

## 它能做什么

LibertyJS 把"反限制"分成了 20 个细粒度模块，每个模块独立可控，你可以按需启用：

### 反反调试（Anti-Anti-Debug）
| 模块 | 功能 |
|---|---|
| 1. 页面可见性伪装 | `document.hidden` 恒为 `false`，切屏不被检测 |
| 2. 屏蔽 blur/focus/visibilitychange | 拦截这类监听器注册 |
| 3. 窗口尺寸检测绕过 | `outerWidth === innerWidth`，隐藏 DevTools 检测 |
| 4. 全屏检测绕过（伪装为全屏） | 让网站认为你始终在全屏 |
| 9. eval/Function 中 debugger 清除 | 自动剔除动态执行的 debugger 语句 |
| 10. console 全面伪装 | 拦截 `%c` + RegExp 调试陷阱，禁止 `console.clear` |
| 11. 时序检测绕过 | 累积漂移抵消 debugger 暂停造成的时间差 |
| 16. 短间隔 timer + debugger 防护 | `setInterval(() => debugger, 50)` 直接拦截 |
| 14. Error.stack 调用源过滤 | 移除含 `tampermonkey`/`userscript` 的堆栈行 |
| 19. Object.defineProperty 锁检测绕过 | 防止"重定义属性失败"暴露 hook 痕迹 |

### 反反复制（Anti-Anti-Copy）
| 模块 | 功能 |
|---|---|
| 6. 复制/粘贴/右键/选择 | 强制开启 `user-select`，放行所有剪贴板操作 |
| 7. 键盘快捷键放行 | F12 / Ctrl+C/V/X/U/S / Ctrl+Shift+I/J/C 全部放行 |
| 8. 内联事件处理器清理 | 移除 `oncontextmenu`、`oncopy` 等内联属性，含动态新增元素 |

### 反水印（Anti-Watermark）
| 模块 | 功能 |
|---|---|
| 20. 水印去除（5 层防御） | CSS 隐藏 + DOM 移除 + MutationObserver 实时拦截 + body 背景图清除 + Canvas fillText 钩子 |

### 反其他限制
| 模块 | 功能 |
|---|---|
| 5. iframe 嵌入检测绕过 | 默认关闭，需要时手动开启 |
| 12. navigator.webdriver 清理 | `webdriver=false` + 补全 plugins/languages |
| 13. 无痕模式检测绕过 | storage quota 强制 ≥28GB + FileSystem 假成功 |
| 15. localStorage 标记检测绕过 | 拦截特定 key 的读写，防止触发式检测 |
| 17. alert/prompt/confirm 限流 | 1 秒内最多 1 次，防止死循环弹窗 |
| 18. window.onerror 恢复 | 让你能看到真实 JS 报错 |

### 核心基础
| 模块 | 功能 |
|---|---|
| 0. 原生函数伪装层 | 所有被 hook 的函数 `toString()` 统一返回 `[native code]`，这是反检测的命脉 |

## 设计亮点

### 1. 细粒度开关 + 可视化面板
点击篡改猴图标 → **「⚡ 打开配置面板」**，弹出 VSCode 风格的暗色面板，21 个 Toggle 开关一目了然，保存后自动刷新生效。也可以在下拉菜单里直接对单个模块快速切换。

### 2. 原生函数统一伪装层
所有被 hook 过的函数（`eval`、`Function`、`addEventListener`、`console.log`、`document.hasFocus` 等）都注册到一张表里，调用 `Function.prototype.toString` 时统一返回 `[native code]`。这一步如果不做，其他所有 hook 都会被一行 `eval.toString()` 检测识破。

### 3. localStorage 配置持久化
你的配置保存在 `__libertyjs_config__` 这个 localStorage key 里，刷新页面、重启浏览器都不会丢。换电脑时复制这一个值即可同步配置。

### 4. 控制台 API
安装后，`LibertyJS`（或简写 `LJ`）这个全局对象会在任何网页的控制台可用：

```js
LibertyJS                       // 查看完整对象
LibertyJS.listModules()         // 列出所有模块状态
LibertyJS.toggleDebug()          // 开启调试日志（看脚本拦截了什么）
LibertyJS.set('bypassIframe', true)  // 临时启用某模块
LibertyJS.openPanel()           // 直接打开配置面板
LibertyJS.reset()               // 恢复默认配置
```

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展
2. 从开源地址下载 `libertyjs-1.0.user.js` 文件
3. 双击文件，篡改猴会自动识别并提示安装
4. 安装后访问任意网页，点击篡改猴图标即可看到菜单

## 适配范围

实测/理论兼容的场景：

- 在线教育/网课平台（"退出全屏即视为离开"判定）
- 文档站/小说站/资料站（禁止复制、右键）
- 视频网站（debugger 反调试、水印）
- 付费内容预览站（限制查看时长、F12 检测）
- 内部 OA / 企业系统（工号水印、内联事件锁）
- 反爬虫检测严格的资讯站（webdriver 检测）

## 设计哲学

LibertyJS 不是"破解工具"，而是**「让用户重新获得对自己浏览器里发生事情的控制权」**。它不会帮你绕过付费墙、不会破解任何 DRM、不会盗取任何内容——它只是让网页不再偷偷监听你的行为，让你能正常使用浏览器原生的复制、粘贴、F12、F11 等基础能力。

## 接下来

- 试试在某个让你头疼的网站启用所有默认模块，看看效果
- 遇到误伤时打开调试日志（`LibertyJS.toggleDebug()`），看具体是哪个模块导致，关掉对应开关即可
- 欢迎在开源仓库提 issue 反馈兼容性问题或建议新的绕过模块

---

**开源地址**：[开源地址](https://github.com/XiaoTian38438/LibertyJS)

**协议**：MIT

**版本**：1.0 · 2025

*LibertyJS — 让网页重新属于你。*
