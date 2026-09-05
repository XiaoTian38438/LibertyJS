// ==UserScript==
// @name          LibertyJS - Web 限制绕过套件
// @namespace     https://github.com/your-username/libertyjs
// @version      1.0
// @description  LibertyJS — 让网页重新属于你。绕过反调试/反复制/水印/全屏/iframe/webdriver/无痕模式等限制，带篡改猴可视化配置面板
// @author       XiaoTian38438
// @match        *://*/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    // 兼容 Tampermonkey sandbox 与普通页面上下文
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const doc = win.document;

    // ============== 配置中心 ==============
    const DEFAULT_CONFIG = {
        enabled: true,
        debug: false,

        // 各模块开关（true=启用该绕过机制）
        bypassVisibility: true,         // 1. 页面可见性
        bypassBlurFocus: true,          // 2. blur/focus/visibilitychange 监听
        bypassWindowSize: true,         // 3. 窗口尺寸检测
        bypassFullscreen: true,         // 4. 全屏检测（新增）
        bypassIframe: false,            // 5. iframe 嵌入检测（默认关闭，可能影响登录跳转）
        bypassCopyPaste: true,          // 6. 复制/粘贴/右键/选择
        bypassKeyboard: true,           // 7. 键盘快捷键
        bypassInlineHandlers: true,     // 8. 内联事件处理器
        bypassDebugger: true,           // 9. eval/Function 中 debugger 语句
        bypassConsole: true,            // 10. console 全面伪装
        bypassTimeCheck: true,          // 11. 时序检测（新增）
        bypassWebdriver: true,          // 12. navigator.webdriver 痕迹（新增）
        bypassIncognito: true,          // 13. 无痕模式检测（新增）
        bypassErrorStack: true,         // 14. Error.stack 调用源检测（新增）
        bypassStorageMarker: true,      // 15. localStorage 标记检测（新增）
        bypassTimerDebugger: true,      // 16. 短间隔 timer + debugger 攻击（新增）
        bypassAlertSpam: true,          // 17. alert/prompt/confirm 弹窗限流（新增）
        restoreOnError: true,           // 18. window.onerror 恢复（新增）
        bypassDefinePropertyLock: true,  // 19. Object.defineProperty 锁检测（新增）
        bypassWatermark: true           // 20. 水印去除（新增）
    };

    // 从 localStorage 读取覆盖配置
    let CONFIG;
    try {
        const saved = localStorage.getItem('__libertyjs_config__');
        CONFIG = saved ? Object.assign({}, DEFAULT_CONFIG, JSON.parse(saved)) : Object.assign({}, DEFAULT_CONFIG);
    } catch (e) {
        CONFIG = Object.assign({}, DEFAULT_CONFIG);
    }

    if (!CONFIG.enabled) return;

    // ============== 0. 原生函数伪装层（核心基础）==============
    // 所有被 hook 的函数注册到这里，调用 toString 时统一返回 [native code]
    const nativeSignatures = new WeakMap();
    const origToString = Function.prototype.toString;
    const origConsoleLog = console.log;

    function markNative(fn, name) {
        if (typeof fn === 'function') {
            nativeSignatures.set(fn, `function ${name}() { [native code] }`);
        }
        return fn;
    }

    const hookedToString = new Proxy(origToString, {
        apply(target, thisArg, args) {
            if (thisArg && nativeSignatures.has(thisArg)) {
                return nativeSignatures.get(thisArg);
            }
            try {
                return Reflect.apply(target, thisArg, args);
            } catch (e) {
                return `function () { [native code] }`;
            }
        }
    });
    Function.prototype.toString = hookedToString;
    nativeSignatures.set(hookedToString, 'function toString() { [native code] }');

    // ============== 日志 ==============
    const _log = function () {
        if (CONFIG.debug) {
            try { origConsoleLog.call(console, '[LibertyJS]', ...arguments); }
            catch (e) { try { console.log('[LibertyJS]', ...arguments); } catch (_) {} }
        }
    };

    _log('LibertyJS 初始化开始');

    // ============== 1. 伪装页面始终可见 ==============
    if (CONFIG.bypassVisibility) {
        try {
            Object.defineProperty(doc, 'hidden', { get: markNative(() => false, 'get hidden'), configurable: true });
            Object.defineProperty(doc, 'visibilityState', { get: markNative(() => 'visible', 'get visibilityState'), configurable: true });
            Object.defineProperty(doc, 'webkitHidden', { get: markNative(() => false, 'get webkitHidden'), configurable: true });
            Object.defineProperty(doc, 'webkitVisibilityState', { get: markNative(() => 'visible', 'get webkitVisibilityState'), configurable: true });
            doc.hasFocus = markNative(() => true, 'hasFocus');
        } catch (e) { _log('Visibility bypass 失败:', e.message); }
        _log('Visibility bypass 已启用');
    }

    // ============== 2. 屏蔽 blur/focus/visibilitychange 监听 ==============
    if (CONFIG.bypassBlurFocus) {
        const origAddEventListener = EventTarget.prototype.addEventListener;
        const origRemoveEventListener = EventTarget.prototype.removeEventListener;
        const blockedEventTypes = new Set([
            'blur', 'focus', 'visibilitychange',
            'mozvisibilitychange', 'msvisibilitychange', 'webkitvisibilitychange'
        ]);

        EventTarget.prototype.addEventListener = markNative(function (type, listener, options) {
            if ((this === win || this === doc) && blockedEventTypes.has((type || '').toLowerCase())) {
                _log('拦截 addEventListener:', type);
                return;
            }
            return origAddEventListener.call(this, type, listener, options);
        }, 'addEventListener');

        EventTarget.prototype.removeEventListener = markNative(function (type, listener, options) {
            if ((this === win || this === doc) && blockedEventTypes.has((type || '').toLowerCase())) {
                return;
            }
            return origRemoveEventListener.call(this, type, listener, options);
        }, 'removeEventListener');

        try {
            Object.defineProperty(win, 'onblur', { set: () => {}, configurable: true });
            Object.defineProperty(win, 'onfocus', { set: () => {}, configurable: true });
            Object.defineProperty(doc, 'onvisibilitychange', { set: () => {}, configurable: true });
        } catch (e) {}
        _log('Blur/focus bypass 已启用');
    }

    // ============== 3. 伪装窗口尺寸（隐藏 DevTools 检测）==============
    if (CONFIG.bypassWindowSize) {
        try {
            Object.defineProperty(win, 'outerWidth', { get: markNative(() => win.innerWidth, 'get outerWidth'), configurable: true });
            Object.defineProperty(win, 'outerHeight', { get: markNative(() => win.innerHeight, 'get outerHeight'), configurable: true });
            Object.defineProperty(win, 'screenX', { get: markNative(() => 0, 'get screenX'), configurable: true });
            Object.defineProperty(win, 'screenY', { get: markNative(() => 0, 'get screenY'), configurable: true });
        } catch (e) {}
        _log('Window size bypass 已启用');
    }

    // ============== 4. 全屏检测绕过（伪装为已进入全屏）==============
    // 让网站始终认为用户处于全屏状态，绕过"退出全屏即视为离开屏幕"的检测
    if (CONFIG.bypassFullscreen) {
        // fullscreenElement 应返回当前全屏的元素（一般是 document.documentElement）
        const getFsElement = () => doc.documentElement || doc.body || null;
        try {
            Object.defineProperty(doc, 'fullscreenElement', { get: markNative(getFsElement, 'get fullscreenElement'), configurable: true });
            Object.defineProperty(doc, 'webkitFullscreenElement', { get: markNative(getFsElement, 'get webkitFullscreenElement'), configurable: true });
            Object.defineProperty(doc, 'mozFullScreenElement', { get: markNative(getFsElement, 'get mozFullScreenElement'), configurable: true });
            Object.defineProperty(doc, 'msFullscreenElement', { get: markNative(getFsElement, 'get msFullscreenElement'), configurable: true });
            Object.defineProperty(doc, 'fullscreen', { get: markNative(() => true, 'get fullscreen'), configurable: true });
            Object.defineProperty(doc, 'webkitIsFullScreen', { get: markNative(() => true, 'get webkitIsFullScreen'), configurable: true });
            Object.defineProperty(doc, 'mozFullScreen', { get: markNative(() => true, 'get mozFullScreen'), configurable: true });
            Object.defineProperty(doc, 'webkitFullScreen', { get: markNative(() => true, 'get webkitFullScreen'), configurable: true });
            Object.defineProperty(doc, 'msFullscreenEnabled', { get: markNative(() => true, 'get msFullscreenEnabled'), configurable: true });
            Object.defineProperty(doc, 'fullscreenEnabled', { get: markNative(() => true, 'get fullscreenEnabled'), configurable: true });
            try { Object.defineProperty(win, 'fullScreen', { get: markNative(() => true, 'get fullScreen'), configurable: true }); } catch (e) {}
        } catch (e) {}

        // 叠加拦截 fullscreen 相关事件监听
        const fsEvents = new Set([
            'fullscreenchange', 'webkitfullscreenchange',
            'mozfullscreenchange', 'msfullscreenchange',
            'fullscreenerror', 'webkitfullscreenerror'
        ]);
        const currentAdd = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = markNative(function (type, listener, options) {
            if (fsEvents.has((type || '').toLowerCase())) {
                _log('拦截 fullscreen 事件:', type);
                return;
            }
            return currentAdd.call(this, type, listener, options);
        }, 'addEventListener');
        _log('Fullscreen bypass 已启用（伪装为全屏中）');
    }

    // ============== 5. iframe / 嵌入检测绕过（新增，默认关闭）==============
    if (CONFIG.bypassIframe) {
        try {
            Object.defineProperty(win, 'top', { get: markNative(() => win, 'get top'), configurable: true });
            Object.defineProperty(win, 'parent', { get: markNative(() => win, 'get parent'), configurable: true });
            Object.defineProperty(win, 'self', { get: markNative(() => win, 'get self'), configurable: true });
            Object.defineProperty(win, 'frameElement', { get: markNative(() => null, 'get frameElement'), configurable: true });
        } catch (e) { _log('iframe bypass 失败:', e.message); }
        _log('iframe bypass 已启用');
    }

    // ============== 6. 强制允许文字选择与右键 ==============
    if (CONFIG.bypassCopyPaste) {
        const injectStyle = function () {
            const style = doc.createElement('style');
            style.textContent = `* {
                user-select: auto !important;
                -webkit-user-select: auto !important;
                -moz-user-select: auto !important;
                -ms-user-select: auto !important;
                -webkit-touch-callout: default !important;
            }`;
            (doc.head || doc.documentElement).appendChild(style);
        };
        if (doc.head) injectStyle();
        else doc.addEventListener('DOMContentLoaded', injectStyle);

        const blockHandler = function (e) { e.stopImmediatePropagation(); };
        const blockEvents = ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart', 'visibilitychange'];
        blockEvents.forEach(ev => {
            doc.addEventListener(ev, blockHandler, true);
            win.addEventListener(ev, blockHandler, true);
        });
        _log('Copy/paste bypass 已启用');
    }

    // ============== 7. 放行所有快捷键 ==============
    if (CONFIG.bypassKeyboard) {
        const keydownHandler = function (e) {
            if ((e.ctrlKey || e.metaKey) && e.code) {
                const code = e.code;
                // 允许复制/粘贴/剪切/全选/打印/查看源码/保存
                if (['KeyC', 'KeyV', 'KeyX', 'KeyA', 'KeyP', 'KeyU', 'KeyS'].includes(code)) {
                    e.stopImmediatePropagation();
                    return;
                }
                // 允许 Ctrl+Shift+I/J/C 打开 DevTools
                if (e.shiftKey && ['KeyI', 'KeyJ', 'KeyC'].includes(code)) {
                    e.stopImmediatePropagation();
                    return;
                }
            }
            // 允许 F1-F12
            if (e.code && /^F\d{1,2}$/.test(e.code)) {
                e.stopImmediatePropagation();
                return;
            }
        };
        ['keydown', 'keyup', 'keypress'].forEach(ev => {
            doc.addEventListener(ev, keydownHandler, true);
            win.addEventListener(ev, keydownHandler, true);
        });
        _log('Keyboard bypass 已启用');
    }

    // ============== 8. 移除内联事件处理器 + 动态监控 ==============
    if (CONFIG.bypassInlineHandlers) {
        const inlineAttrs = [
            'oncopy', 'oncut', 'onpaste', 'oncontextmenu', 'onselectstart',
            'onkeydown', 'onkeyup', 'onkeypress', 'ondragstart',
            'onmousedown', 'onmouseup', 'oncontextmenu'
        ];
        const removeInlineHandlers = function () {
            try {
                inlineAttrs.forEach(attr => {
                    doc.querySelectorAll('[' + attr + ']').forEach(el => el.removeAttribute(attr));
                });
            } catch (e) {}
        };
        if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', removeInlineHandlers);
        } else {
            removeInlineHandlers();
        }

        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            inlineAttrs.forEach(attr => {
                                if (node.hasAttribute && node.hasAttribute(attr)) {
                                    node.removeAttribute(attr);
                                }
                            });
                            if (node.querySelectorAll) {
                                try {
                                    node.querySelectorAll('[' + inlineAttrs.join('],[') + ']').forEach(el => {
                                        inlineAttrs.forEach(attr => el.removeAttribute(attr));
                                    });
                                } catch (e) {}
                            }
                        }
                    });
                }
            }
        });
        if (doc.documentElement) {
            observer.observe(doc.documentElement, { childList: true, subtree: true });
        } else {
            doc.addEventListener('DOMContentLoaded', () => {
                observer.observe(doc.documentElement, { childList: true, subtree: true });
            });
        }
        _log('Inline handler 清理已启用');
    }

    // ============== 9. 移除 eval/Function 中的 debugger 语句 ==============
    if (CONFIG.bypassDebugger) {
        const origEval = win.eval;
        win.eval = markNative(function (code) {
            if (typeof code === 'string' && /\bdebugger\b/.test(code)) {
                code = code.replace(/\bdebugger\b\s*;?/g, '');
                _log('eval 中移除 debugger');
            }
            return origEval.call(this, code);
        }, 'eval');

        const origFunction = win.Function;
        function FunctionWrapper(...args) {
            if (args.length > 0) {
                let body = args[args.length - 1];
                if (typeof body === 'string' && /\bdebugger\b/.test(body)) {
                    body = body.replace(/\bdebugger\b\s*;?/g, '');
                    args[args.length - 1] = body;
                    _log('Function 中移除 debugger');
                }
            }
            return origFunction.apply(this, args);
        }
        FunctionWrapper.prototype = origFunction.prototype;
        win.Function = markNative(FunctionWrapper, 'Function');
        _log('Debugger bypass 已启用');
    }

    // ============== 10. console 全面伪装（增强版）==============
    if (CONFIG.bypassConsole) {
        // 拦截 clear 防止刷屏
        console.clear = markNative(function () { _log('console.clear 已拦截'); }, 'clear');

        // 检测 %c + RegExp 调试陷阱
        const isDebugTrap = function (args) {
            if (!args || args.length < 2) return false;
            if (args[0] === '%c' && (args[1] instanceof RegExp)) return true;
            if (typeof args[0] === 'string' && args[0].includes('%c') &&
                typeof args[1] === 'string' && (args[1].includes('color:') || args[1].includes('font-size'))) {
                return true;
            }
            return false;
        };

        const consoleMethods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'dir', 'trace'];
        consoleMethods.forEach(method => {
            const orig = console[method];
            if (typeof orig !== 'function') return;
            console[method] = function (...args) {
                if (isDebugTrap(args)) {
                    _log('拦截 console.' + method + ' 调试陷阱');
                    return;
                }
                return orig.apply(this, args);
            };
            markNative(console[method], method);
        });
        _log('Console bypass 已启用');
    }

    // ============== 11. 时序检测绕过（新增）==============
    // 通过累积漂移抵消 debugger 暂停造成的时间差
    if (CONFIG.bypassTimeCheck) {
        try {
            const origPerfNow = performance.now.bind(performance);
            let lastNow = origPerfNow();
            let drift = 0;
            const MAX_DELTA = 100;       // 超过 100ms 认为是被 debugger 暂停
            const ALLOWED_DELTA = 0.05;  // 容差 50μs

            performance.now = markNative(function () {
                const realNow = origPerfNow();
                const delta = realNow - lastNow;
                if (delta > MAX_DELTA) {
                    drift += delta - ALLOWED_DELTA;
                    _log('检测到时序异常，已修正 drift:', delta);
                }
                lastNow = realNow;
                return realNow - drift;
            }, 'now');

            const origDateNow = Date.now;
            Date.now = markNative(function () {
                return origDateNow() - Math.floor(drift);
            }, 'now');

            _log('Time check bypass 已启用');
        } catch (e) { _log('Time check bypass 失败:', e.message); }
    }

    // ============== 12. navigator.webdriver 及自动化痕迹清理（新增）==============
    if (CONFIG.bypassWebdriver) {
        try {
            Object.defineProperty(navigator, 'webdriver', { get: markNative(() => false, 'get webdriver'), configurable: true });
        } catch (e) {}

        try {
            if (!navigator.plugins || navigator.plugins.length === 0) {
                Object.defineProperty(navigator, 'plugins', {
                    get: markNative(() => {
                        const arr = [
                            { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                            { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                            { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                            { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                            { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
                        ];
                        arr.refresh = () => {};
                        arr.item = (i) => arr[i] || null;
                        arr.namedItem = (n) => arr.find(p => p.name === n) || null;
                        return arr;
                    }, 'get plugins'),
                    configurable: true
                });
            }
        } catch (e) {}

        try {
            if (!navigator.languages || navigator.languages.length === 0) {
                Object.defineProperty(navigator, 'languages', {
                    get: markNative(() => ['zh-CN', 'zh', 'en-US', 'en'], 'get languages'),
                    configurable: true
                });
            }
        } catch (e) {}

        // 清理常见自动化检测的全局函数
        try {
            const autoKeys = ['__webdriver_script_fn', '__webdriver_script_func', '__webdriver_evaluate', '__selenium_evaluate', '__fxdriver_evaluate', '__driver_unwrapped', '__webdriver_unwrapped', '__driver_evaluate', '__webdriver_evaluate'];
            autoKeys.forEach(k => { try { delete win[k]; } catch (e) {} });
        } catch (e) {}

        _log('Webdriver 清理已启用');
    }

    // ============== 13. 无痕模式检测绕过（新增）==============
    if (CONFIG.bypassIncognito) {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const origEstimate = navigator.storage.estimate.bind(navigator.storage);
                navigator.storage.estimate = markNative(async function () {
                    const result = await origEstimate();
                    return {
                        usage: result.usage || 0,
                        quota: Math.max(result.quota || 0, 29863461376) // 强制 >= 28GB
                    };
                }, 'estimate');
            }
        } catch (e) {}

        // 修复 webkitRequestFileSystem（无痕模式调用失败会被检测）
        try {
            if (win.webkitRequestFileSystem) {
                win.webkitRequestFileSystem = markNative(function (type, size, success, error) {
                    if (typeof success === 'function') success({ name: 'fake-fs' });
                }, 'webkitRequestFileSystem');
            }
        } catch (e) {}
        _log('Incognito bypass 已启用');
    }

    // ============== 14. Error.stack 调用源检测绕过（新增）==============
    if (CONFIG.bypassErrorStack) {
        const stackKeywords = [
            'userscript', 'user.js', 'tampermonkey', 'greasemonkey', 'violentmonkey',
            'AAD', 'Anti-Bypass', 'anti-anti-debug'
        ];

        const filterStack = function (stack) {
            if (typeof stack !== 'string') return stack;
            return stack.split('\n').filter(line => {
                const lower = line.toLowerCase();
                return !stackKeywords.some(kw => lower.includes(kw.toLowerCase()));
            }).join('\n');
        };

        try {
            const origStackDesc = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
            if (origStackDesc) {
                Object.defineProperty(Error.prototype, 'stack', {
                    get: function () {
                        let stack = origStackDesc.get ? origStackDesc.get.call(this) : this._origStack;
                        return filterStack(stack);
                    },
                    set: function (v) { this._origStack = v; },
                    configurable: true
                });
            } else {
                // 兜底：包装 Error 构造函数
                const OrigError = win.Error;
                function ErrorWrapper(...args) {
                    const err = new OrigError(...args);
                    const origStack = err.stack;
                    Object.defineProperty(err, 'stack', {
                        get: () => filterStack(origStack),
                        set: (v) => { /* ignore */ },
                        configurable: true
                    });
                    return err;
                }
                ErrorWrapper.prototype = OrigError.prototype;
                win.Error = markNative(ErrorWrapper, 'Error');
            }
        } catch (e) { _log('Error.stack hook 失败:', e.message); }
        _log('Error.stack 过滤已启用');
    }

    // ============== 15. localStorage 标记检测绕过（新增）==============
    if (CONFIG.bypassStorageMarker) {
        const storageMarkerKeys = new Set([
            '__devtools_open', 'devtools', 'is_debug', 'debug_mode',
            '__webdriver_script_fn', '__webdriver_script_func',
            'devtools-open', 'devtoolsisOpen'
        ]);

        const wrapStorage = function (storage, name) {
            if (!storage) return;
            try {
                const origGetItem = storage.getItem.bind(storage);
                const origSetItem = storage.setItem.bind(storage);
                const origRemoveItem = storage.removeItem.bind(storage);

                storage.getItem = markNative(function (key) {
                    if (storageMarkerKeys.has(key)) {
                        _log('拦截 ' + name + '.getItem:', key);
                        return null;
                    }
                    return origGetItem(key);
                }, 'getItem');

                storage.setItem = markNative(function (key, value) {
                    if (storageMarkerKeys.has(key)) {
                        _log('拦截 ' + name + '.setItem:', key);
                        return;
                    }
                    return origSetItem(key, value);
                }, 'setItem');

                storage.removeItem = markNative(function (key) {
                    if (storageMarkerKeys.has(key)) {
                        _log('拦截 ' + name + '.removeItem:', key);
                        return;
                    }
                    return origRemoveItem(key);
                }, 'removeItem');
            } catch (e) {}
        };

        try { wrapStorage(win.localStorage, 'localStorage'); } catch (e) {}
        try { wrapStorage(win.sessionStorage, 'sessionStorage'); } catch (e) {}
        _log('Storage marker bypass 已启用');
    }

    // ============== 16. 短间隔 timer + debugger 防护（新增）==============
    if (CONFIG.bypassTimerDebugger) {
        const origSetInterval = win.setInterval;
        const origSetTimeout = win.setTimeout;

        const checkCallback = function (fn, name) {
            if (typeof fn === 'function') {
                try {
                    const fnStr = fn.toString();
                    if (/\bdebugger\b/.test(fnStr)) {
                        _log(`拦截 ${name} 含 debugger`);
                        return null;
                    }
                } catch (e) {} // toString 可能被 hook 拒绝
            } else if (typeof fn === 'string' && /\bdebugger\b/.test(fn)) {
                _log(`拦截 ${name} 含 debugger (string)`);
                return null;
            }
            return fn;
        };

        win.setInterval = markNative(function (fn, delay, ...args) {
            const checked = checkCallback(fn, 'setInterval');
            if (checked === null) return 0;
            return origSetInterval.call(this, checked, delay, ...args);
        }, 'setInterval');

        win.setTimeout = markNative(function (fn, delay, ...args) {
            const checked = checkCallback(fn, 'setTimeout');
            if (checked === null) return 0;
            return origSetTimeout.call(this, checked, delay, ...args);
        }, 'setTimeout');
        _log('Timer debugger guard 已启用');
    }

    // ============== 17. alert/prompt/confirm 弹窗限流（新增）==============
    if (CONFIG.bypassAlertSpam) {
        const origAlert = win.alert;
        const origPrompt = win.prompt;
        const origConfirm = win.confirm;

        let lastAlertTime = 0;
        const MIN_INTERVAL = 1000;

        const shouldThrottle = function () {
            const now = Date.now();
            if (now - lastAlertTime < MIN_INTERVAL) {
                _log('拦截 alert 类弹窗（限流）');
                return true;
            }
            lastAlertTime = now;
            return false;
        };

        win.alert = markNative(function (msg) {
            if (shouldThrottle()) return;
            return origAlert.call(this, msg);
        }, 'alert');

        win.prompt = markNative(function (msg, def) {
            if (shouldThrottle()) return null;
            return origPrompt.call(this, msg, def);
        }, 'prompt');

        win.confirm = markNative(function (msg) {
            if (shouldThrottle()) return true;
            return origConfirm.call(this, msg);
        }, 'confirm');
        _log('Alert spam guard 已启用');
    }

    // ============== 18. 恢复 window.onerror（新增）==============
    if (CONFIG.restoreOnError) {
        try {
            win.onerror = null;
            win.onunhandledrejection = null;
            // 防止后续被覆盖
            try {
                Object.defineProperty(win, 'onerror', { set: () => {}, get: () => null, configurable: true });
            } catch (e) {}
        } catch (e) {}
        _log('onerror 恢复已启用');
    }

    // ============== 19. Object.defineProperty 锁检测绕过（新增）==============
    if (CONFIG.bypassDefinePropertyLock) {
        const origDefineProperty = Object.defineProperty;
        Object.defineProperty = markNative(function (obj, prop, descriptor) {
            try {
                const existingDesc = origDefineProperty.call ? Object.getOwnPropertyDescriptor(obj, prop) : null;
                if (existingDesc && existingDesc.get && nativeSignatures.has(existingDesc.get)) {
                    _log('拦截 defineProperty 锁定尝试:', String(prop));
                    return obj;  // 假装成功
                }
            } catch (e) {}
            return origDefineProperty.call(this, obj, prop, descriptor);
        }, 'defineProperty');
        _log('defineProperty 锁检测绕过已启用');
    }

    // ============== 20. 水印去除（新增）==============
    // 多层防御：CSS 隐藏 + DOM 移除 + 背景图清除 + Canvas 文字过滤
    if (CONFIG.bypassWatermark) {
        // 20.1 注入 CSS：隐藏已知水印选择器
        const injectWatermarkStyle = function () {
            const css = `
                /* 常见 class/id 包含 watermark 的元素 */
                [class*="watermark" i],
                [class*="water-mark" i],
                [class*="waterMark" i],
                [id*="watermark" i],
                [id*="water-mark" i],
                [id*="waterMark" i],
                /* 常见水印容器类名 */
                .wm-container, .wm-layer, .wm-wrapper,
                .mask-layer, .mask-watermark,
                .canvas-watermark, .printed-watermark,
                .qrcode-mask, .print-mask,
                .page-watermark, .doc-watermark,
                .footer-watermark, .header-watermark,
                /* 专门用于水印的 svg/div */
                svg.watermark, div.watermark,
                /* 部分站点的特定水印类名 */
                .x-watermark, .y-watermark,
                [class*="qrcode" i][class*="overlay" i],
                [class*="print" i][class*="mask" i] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    background: transparent !important;
                    background-image: none !important;
                }
                /* 移除常见水印背景图（通过通配选择器 + 重复定义） */
                [class*="watermark" i]::before,
                [class*="watermark" i]::after {
                    content: none !important;
                    display: none !important;
                }
                /* 全局禁用选区透明文字（部分水印用 ::selection 实现） */
                ::selection { background: highlight !important; color: highlighttext !important; }
            `;
            const style = doc.createElement('style');
            style.setAttribute('data-aad-watermark', 'true');
            style.textContent = css;
            (doc.head || doc.documentElement).appendChild(style);
        };
        if (doc.head) injectWatermarkStyle();
        else doc.addEventListener('DOMContentLoaded', injectWatermarkStyle);

        // 20.2 主动移除 DOM 中的水印元素
        const WATERMARK_SELECTOR = [
            '[class*="watermark" i]', '[class*="water-mark" i]', '[class*="waterMark" i]',
            '[id*="watermark" i]', '[id*="water-mark" i]', '[id*="waterMark" i]',
            '.wm-container', '.wm-layer', '.mask-watermark',
            '.canvas-watermark', '.printed-watermark', '.qrcode-mask'
        ].join(',');

        const removeWatermarkElements = function () {
            try {
                doc.querySelectorAll(WATERMARK_SELECTOR).forEach(el => {
                    // 避免误伤内容容器，仅移除看起来确实是水印的元素
                    const text = (el.textContent || '').trim();
                    if (text.length < 200 || el.tagName === 'SVG' || el.tagName === 'CANVAS') {
                        el.remove();
                        _log('移除水印元素:', el.tagName, el.className);
                    }
                });
            } catch (e) {}
        };
        if (doc.readyState !== 'loading') removeWatermarkElements();
        doc.addEventListener('DOMContentLoaded', removeWatermarkElements);

        // 20.3 监听 DOM 动态添加的水印
        const wmObserver = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;
                        try {
                            // 检查节点本身
                            if (node.matches && node.matches(WATERMARK_SELECTOR)) {
                                node.remove();
                                _log('移除动态水印:', node.tagName);
                                return;
                            }
                            // 检查子节点
                            const found = node.querySelectorAll ? node.querySelectorAll(WATERMARK_SELECTOR) : [];
                            found.forEach(el => el.remove());
                        } catch (e) {}
                    });
                } else if (m.type === 'attributes' && m.target && m.target.matches && m.target.matches(WATERMARK_SELECTOR)) {
                    // 防止水印通过 style 改变重新显示
                    m.target.remove();
                }
            }
        });
        const startWMObserver = function () {
            if (doc.documentElement) {
                wmObserver.observe(doc.documentElement, {
                    childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
                });
            }
        };
        if (doc.documentElement) startWMObserver();
        else doc.addEventListener('DOMContentLoaded', startWMObserver);

        // 20.4 清除 body 背景图（部分水印通过 body 背景图实现）
        const clearBodyWatermark = function () {
            try {
                const bg = win.getComputedStyle(doc.body).backgroundImage;
                if (bg && bg !== 'none' && /watermark|water-mark|logo/i.test(bg)) {
                    doc.body.style.setProperty('background-image', 'none', 'important');
                    _log('清除 body 背景水印');
                }
            } catch (e) {}
        };
        doc.addEventListener('DOMContentLoaded', clearBodyWatermark);

        // 20.5 拦截 Canvas 水印绘制（可选：默认保守模式）
        // 部分网站通过 Canvas 绘制透明水印叠加到内容上，这里通过 fillText 钩子过滤
        try {
            const origFillText = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
                // 仅拦截明显是水印的文字（重复多次、透明度低、大尺寸）
                if (typeof text === 'string' && text.length > 0) {
                    const alpha = this.globalAlpha;
                    const font = this.font || '';
                    // 透明度 < 0.3 或 字体大小 > 30px 且含中文姓名/工号关键字
                    if (alpha < 0.3 || (/\d{6,}|工号|姓名|user|uid/i.test(text) && /\d{2,}/.test(text))) {
                        _log('拦截 Canvas 水印:', text);
                        return;
                    }
                }
                return origFillText.call(this, text, x, y, maxWidth);
            };
            markNative(CanvasRenderingContext2D.prototype.fillText, 'fillText');
        } catch (e) { _log('Canvas fillText hook 失败:', e.message); }

        _log('Watermark bypass 已启用');
    }

    // ============== 公共 API ==============
    // 在控制台输入 LibertyJS 可以查看和修改配置
    win.LibertyJS = win.LJ = {
        version: '1.0',
        name: 'LibertyJS',
        config: CONFIG,
        set(key, value) {
            CONFIG[key] = value;
            try { localStorage.setItem('__libertyjs_config__', JSON.stringify(CONFIG)); } catch (e) {}
            return `[LibertyJS] 已设置 ${key} = ${value}（部分选项需刷新页面生效）`;
        },
        save() {
            try {
                localStorage.setItem('__libertyjs_config__', JSON.stringify(CONFIG));
                return '[LibertyJS] 配置已保存';
            } catch (e) { return '保存失败: ' + e.message; }
        },
        reset() {
            try {
                localStorage.setItem('__libertyjs_config__', JSON.stringify(DEFAULT_CONFIG));
                return '[LibertyJS] 配置已重置，请刷新页面';
            } catch (e) { return '重置失败: ' + e.message; }
        },
        toggleDebug() {
            CONFIG.debug = !CONFIG.debug;
            try { localStorage.setItem('__libertyjs_config__', JSON.stringify(CONFIG)); } catch (e) {}
            return '[LibertyJS] debug 模式: ' + (CONFIG.debug ? 'ON' : 'OFF');
        },
        listModules() {
            return Object.keys(CONFIG)
                .filter(k => k.startsWith('bypass') || k === 'restoreOnError')
                .map(k => `${k}: ${CONFIG[k] ? '✓' : '✗'}`)
                .join('\n');
        }
    };

    // ============== 篡改猴菜单注册 + 可视化配置面板 ==============
    // 模块中文映射表
    const MODULE_LABELS = {
        bypassVisibility: '1. 页面可见性伪装',
        bypassBlurFocus: '2. 屏蔽 blur/focus/visibilitychange',
        bypassWindowSize: '3. 窗口尺寸检测绕过',
        bypassFullscreen: '4. 全屏检测绕过（伪装为全屏）',
        bypassIframe: '5. iframe 嵌入检测绕过（默认关）',
        bypassCopyPaste: '6. 复制/粘贴/右键/选择',
        bypassKeyboard: '7. 键盘快捷键放行',
        bypassInlineHandlers: '8. 内联事件处理器清理',
        bypassDebugger: '9. eval/Function 中 debugger 清除',
        bypassConsole: '10. console 全面伪装',
        bypassTimeCheck: '11. 时序检测绕过',
        bypassWebdriver: '12. navigator.webdriver 清理',
        bypassIncognito: '13. 无痕模式检测绕过',
        bypassErrorStack: '14. Error.stack 调用源过滤',
        bypassStorageMarker: '15. localStorage 标记检测绕过',
        bypassTimerDebugger: '16. 短间隔 timer + debugger 防护',
        bypassAlertSpam: '17. alert/prompt/confirm 限流',
        restoreOnError: '18. window.onerror 恢复',
        bypassDefinePropertyLock: '19. Object.defineProperty 锁检测绕过',
        bypassWatermark: '20. 水印去除',
        debug: '调试日志输出'
    };

    // 注入配置面板 UI
    const injectConfigPanel = function () {
        if (doc.getElementById('aad-config-panel')) return;

        const panel = doc.createElement('div');
        panel.id = 'aad-config-panel';
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 460px; max-height: 80vh; overflow-y: auto;
            background: #1e1e1e; color: #e0e0e0;
            border: 1px solid #444; border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            z-index: 2147483647; font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
            font-size: 13px; line-height: 1.5; display: none;
        `;

        const style = doc.createElement('style');
        style.textContent = `
            #aad-config-panel .aad-header {
                padding: 12px 16px; background: #252526; border-bottom: 1px solid #3e3e42;
                border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;
            }
            #aad-config-panel .aad-title { font-weight: 600; color: #4ec9b0; font-size: 14px; }
            #aad-config-panel .aad-close {
                cursor: pointer; color: #999; font-size: 18px; line-height: 1; padding: 0 4px;
            }
            #aad-config-panel .aad-close:hover { color: #f14c4c; }
            #aad-config-panel .aad-body { padding: 8px 0; }
            #aad-config-panel .aad-row {
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px 16px; border-bottom: 1px solid #2d2d2d;
            }
            #aad-config-panel .aad-row:hover { background: #2a2a2a; }
            #aad-config-panel .aad-label { flex: 1; padding-right: 12px; }
            #aad-config-panel .aad-switch {
                position: relative; width: 36px; height: 20px; flex-shrink: 0;
            }
            #aad-config-panel .aad-switch input { opacity: 0; width: 0; height: 0; }
            #aad-config-panel .aad-slider {
                position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                background-color: #555; transition: .3s; border-radius: 10px;
            }
            #aad-config-panel .aad-slider:before {
                position: absolute; content: ""; height: 16px; width: 16px;
                left: 2px; top: 2px; background-color: white; transition: .3s; border-radius: 50%;
            }
            #aad-config-panel .aad-switch input:checked + .aad-slider { background-color: #0e639c; }
            #aad-config-panel .aad-switch input:checked + .aad-slider:before { transform: translateX(16px); }
            #aad-config-panel .aad-footer {
                padding: 12px 16px; background: #252526; border-top: 1px solid #3e3e42;
                border-radius: 0 0 8px 8px; display: flex; gap: 8px; justify-content: flex-end;
            }
            #aad-config-panel .aad-btn {
                padding: 6px 14px; border: 1px solid #555; background: #3a3d41;
                color: #e0e0e0; border-radius: 4px; cursor: pointer; font-size: 12px;
            }
            #aad-config-panel .aad-btn:hover { background: #4a4d51; }
            #aad-config-panel .aad-btn-primary { background: #0e639c; border-color: #0e639c; color: white; }
            #aad-config-panel .aad-btn-primary:hover { background: #1177bb; }
            #aad-config-panel .aad-btn-danger { background: #5a1d1d; border-color: #5a1d1d; color: #ffb4b4; }
            #aad-config-panel .aad-mask {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.4); z-index: 2147483646; display: none;
            }
        `;
        doc.head.appendChild(style);

        const mask = doc.createElement('div');
        mask.id = 'aad-config-mask';
        mask.className = 'aad-mask';
        mask.onclick = () => { panel.style.display = 'none'; mask.style.display = 'none'; };
        doc.body.appendChild(mask);

        // 构建开关行
        const rows = [];
        Object.keys(MODULE_LABELS).forEach(key => {
            const label = MODULE_LABELS[key];
            const checked = CONFIG[key] ? 'checked' : '';
            rows.push(`
                <div class="aad-row">
                    <div class="aad-label">${label}</div>
                    <label class="aad-switch">
                        <input type="checkbox" data-key="${key}" ${checked}>
                        <span class="aad-slider"></span>
                    </label>
                </div>
            `);
        });

        panel.innerHTML = `
            <div class="aad-header">
                <div class="aad-title">⚡ LibertyJS · 配置面板 v1.0</div>
                <div class="aad-close" id="aad-close-btn">×</div>
            </div>
            <div class="aad-body">${rows.join('')}</div>
            <div class="aad-footer">
                <button class="aad-btn aad-btn-danger" id="aad-reset-btn">重置默认</button>
                <button class="aad-btn" id="aad-cancel-btn">取消</button>
                <button class="aad-btn aad-btn-primary" id="aad-save-btn">保存并刷新</button>
            </div>
        `;
        doc.body.appendChild(panel);

        // 事件绑定
        const closePanel = () => { panel.style.display = 'none'; mask.style.display = 'none'; };
        doc.getElementById('aad-close-btn').onclick = closePanel;
        doc.getElementById('aad-cancel-btn').onclick = closePanel;
        doc.getElementById('aad-save-btn').onclick = () => {
            doc.querySelectorAll('#aad-config-panel input[type=checkbox]').forEach(cb => {
                CONFIG[cb.dataset.key] = cb.checked;
            });
            try { localStorage.setItem('__libertyjs_config__', JSON.stringify(CONFIG)); } catch (e) {}
            closePanel();
            try { GM_notification({ title: 'LibertyJS', text: '配置已保存，刷新页面后生效', timeout: 3000 }); } catch (e) {}
            setTimeout(() => location.reload(), 500);
        };
        doc.getElementById('aad-reset-btn').onclick = () => {
            if (confirm('确认重置为默认配置？将刷新页面。')) {
                try { localStorage.setItem('__libertyjs_config__', JSON.stringify(DEFAULT_CONFIG)); } catch (e) {}
                location.reload();
            }
        };

        // 显示面板
        panel.style.display = 'block';
        mask.style.display = 'block';
    };

    // 暴露打开面板的函数
    win.LibertyJS.openPanel = function () {
        if (doc.body) injectConfigPanel();
        else doc.addEventListener('DOMContentLoaded', injectConfigPanel);
    };

    // 注册篡改猴菜单
    const registerMenus = function () {
        if (typeof GM_registerMenuCommand !== 'function') return;

        GM_registerMenuCommand('⚡ 打开配置面板', () => {
            win.LibertyJS.openPanel();
        });

        GM_registerMenuCommand(
            (CONFIG.debug ? '🐛 调试日志: ON' : '🐛 调试日志: OFF'),
            () => {
                CONFIG.debug = !CONFIG.debug;
                try { localStorage.setItem('__libertyjs_config__', JSON.stringify(CONFIG)); } catch (e) {}
                try { GM_notification({ title: 'LibertyJS', text: '调试日志: ' + (CONFIG.debug ? 'ON' : 'OFF'), timeout: 2000 }); } catch (e) {}
                location.reload();
            }
        );

        GM_registerMenuCommand('🔄 重置为默认配置', () => {
            if (confirm('确认重置所有配置为默认值？将刷新页面。')) {
                try { localStorage.setItem('__libertyjs_config__', JSON.stringify(DEFAULT_CONFIG)); } catch (e) {}
                location.reload();
            }
        });

        GM_registerMenuCommand('📋 查看模块状态（控制台）', () => {
            try { GM_notification({ title: 'LibertyJS', text: '请在浏览器控制台输入 LibertyJS.listModules() 查看', timeout: 3000 }); } catch (e) {}
            console.log(win.LibertyJS.listModules());
        });

        // 为每个模块注册快速切换菜单
        Object.keys(MODULE_LABELS).forEach(key => {
            const label = MODULE_LABELS[key];
            const status = CONFIG[key] ? '✓' : '✗';
            GM_registerMenuCommand(`${status} ${label}`, () => {
                CONFIG[key] = !CONFIG[key];
                try { localStorage.setItem('__libertyjs_config__', JSON.stringify(CONFIG)); } catch (e) {}
                try { GM_notification({
                    title: 'LibertyJS',
                    text: `${label}\n已切换为: ${CONFIG[key] ? '开启' : '关闭'}\n刷新页面后生效`,
                    timeout: 3000
                }); } catch (e) {}
            });
        });
    };

    // 等待 DOM ready 后注册菜单（菜单注册本身不需要 DOM，但 GM_notification 可能需要）
    registerMenus();

    _log('LibertyJS v1.0 所有模块初始化完成，菜单已注册');
})();
