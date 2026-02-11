(() => {
  // 移除旧版固定 ID 的悬浮窗（兼容升级）
  const legacy = document.getElementById('__json_formatter_host__');
  if (legacy) legacy.remove();

  // 移除所有未 pin 的悬浮窗，保留已 pin 的
  document.querySelectorAll('[id^="__json_formatter_host_"]').forEach(el => {
    if (!el.classList.contains('pinned')) el.remove();
  });

  // 统计已 pin 窗口数量，用于错开位置
  const pinnedCount = document.querySelectorAll('[id^="__json_formatter_host_"].pinned').length;

  const msg = chrome.i18n.getMessage;

  // ── JSON 渲染逻辑（复用 viewer.js） ──

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderValue(value, indent) {
    if (value === null) {
      return '<span class="json-null">null</span>';
    }
    switch (typeof value) {
      case 'string':
        return '<span class="json-string">"' + escapeHtml(value) + '"</span>';
      case 'number':
        return '<span class="json-number">' + value + '</span>';
      case 'boolean':
        return '<span class="json-boolean">' + value + '</span>';
      case 'object':
        if (Array.isArray(value)) {
          return renderArray(value, indent);
        }
        return renderObject(value, indent);
      default:
        return escapeHtml(String(value));
    }
  }

  function renderObject(obj, indent) {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '<span class="json-bracket">{}</span>';
    }
    const pad = '  '.repeat(indent);
    const innerPad = '  '.repeat(indent + 1);
    const count = keys.length;
    const placeholder = '<span class="json-placeholder">{ ' + msg('items', [count]) + ' }</span>';

    let html = '<span class="collapsible">';
    html += '<span class="collapse-toggle" role="button" tabindex="0" aria-label="toggle">▼</span>';
    html += '<span class="json-bracket">{</span>' + placeholder;
    html += '<span class="json-content">\n';

    keys.forEach((key, i) => {
      html += innerPad;
      html += '<span class="json-key">"' + escapeHtml(key) + '"</span>: ';
      html += renderValue(obj[key], indent + 1);
      if (i < count - 1) html += ',';
      html += '\n';
    });

    html += pad + '<span class="json-bracket">}</span>';
    html += '</span></span>';
    return html;
  }

  function renderArray(arr, indent) {
    if (arr.length === 0) {
      return '<span class="json-bracket">[]</span>';
    }
    const pad = '  '.repeat(indent);
    const innerPad = '  '.repeat(indent + 1);
    const count = arr.length;
    const placeholder = '<span class="json-placeholder">[ ' + msg('items', [count]) + ' ]</span>';

    let html = '<span class="collapsible">';
    html += '<span class="collapse-toggle" role="button" tabindex="0" aria-label="toggle">▼</span>';
    html += '<span class="json-bracket">[</span>' + placeholder;
    html += '<span class="json-content">\n';

    arr.forEach((item, i) => {
      html += innerPad + renderValue(item, indent + 1);
      if (i < count - 1) html += ',';
      html += '\n';
    });

    html += pad + '<span class="json-bracket">]</span>';
    html += '</span></span>';
    return html;
  }
  // ── Shadow DOM 样式 ──

  const STYLES = `
    :host {
      all: initial;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Menlo, monospace;
    }

    :host(.pinned) {
      pointer-events: none;
    }

    /* 暗色主题（默认） */
    .jf-root {
      --bg: #1e1e2e;
      --bg-toolbar: #181825;
      --bg-btn: #313244;
      --bg-btn-hover: #45475a;
      --bg-error: #45273a;
      --bg-toast: #a6e3a1;
      --text: #cdd6f4;
      --text-title: #cba6f7;
      --text-toast: #1e1e2e;
      --border: #313244;
      --border-btn: #45475a;
      --border-btn-hover: #585b70;
      --border-error: #f38ba8;
      --color-error: #f38ba8;
      --color-key: #89b4fa;
      --color-string: #a6e3a1;
      --color-number: #fab387;
      --color-boolean: #cba6f7;
      --color-null: #6c7086;
      --color-bracket: #9399b2;
      --color-toggle: #6c7086;
      --shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      --shadow-toast: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    /* 亮色主题 */
    @media (prefers-color-scheme: light) {
      .jf-root {
        --bg: #f5f5f5;
        --bg-toolbar: #ffffff;
        --bg-btn: #e8e8e8;
        --bg-btn-hover: #d8d8d8;
        --bg-error: #fde8e8;
        --bg-toast: #16a34a;
        --text: #1e1e2e;
        --text-title: #7c3aed;
        --text-toast: #ffffff;
        --border: #d4d4d8;
        --border-btn: #c4c4c8;
        --border-btn-hover: #a1a1aa;
        --border-error: #dc2626;
        --color-error: #dc2626;
        --color-key: #2563eb;
        --color-string: #16a34a;
        --color-number: #ea580c;
        --color-boolean: #7c3aed;
        --color-null: #9ca3af;
        --color-bracket: #6b7280;
        --color-toggle: #9ca3af;
        --shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        --shadow-toast: 0 4px 12px rgba(0, 0, 0, 0.12);
      }
    }

    .jf-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      animation: jf-fade-in 0.15s ease;
    }

    :host(.pinned) .jf-overlay {
      display: none;
    }

    @keyframes jf-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes jf-scale-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .jf-dialog {
      position: fixed;
      width: 620px;
      height: 520px;
      min-width: 320px;
      min-height: 200px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
      resize: both;
      animation: jf-scale-in 0.15s ease;
    }

    .jf-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: var(--bg-toolbar);
      border-bottom: 1px solid var(--border);
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
    }

    .jf-titlebar:active {
      cursor: grabbing;
    }
    .jf-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .jf-logo {
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--text-title), var(--color-key));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .jf-title h2 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-title);
      margin: 0;
    }

    .jf-actions {
      display: flex;
      gap: 4px;
    }

    .jf-actions button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 10px;
      border: 1px solid var(--border-btn);
      border-radius: 6px;
      background: var(--bg-btn);
      color: var(--text);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .jf-actions button:hover {
      background: var(--bg-btn-hover);
      border-color: var(--border-btn-hover);
    }

    .jf-actions button:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    .jf-actions button svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      opacity: 0.7;
    }

    .jf-actions button:hover svg {
      opacity: 1;
    }
    .jf-close {
      background: transparent !important;
      border: none !important;
      padding: 4px 6px !important;
      font-size: 18px !important;
      color: var(--color-null) !important;
      line-height: 1;
    }

    .jf-close:hover {
      color: var(--color-error) !important;
      background: transparent !important;
    }

    .jf-pin.active {
      background: var(--text-title) !important;
      border-color: var(--text-title) !important;
      color: #fff !important;
    }

    .jf-pin.active svg {
      opacity: 1 !important;
    }

    .jf-body {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    .jf-body::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    .jf-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .jf-body::-webkit-scrollbar-thumb {
      background: var(--border-btn);
      border-radius: 4px;
    }

    .jf-body::-webkit-scrollbar-thumb:hover {
      background: var(--border-btn-hover);
    }

    .jf-output {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace;
      font-size: 13px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--text);
      margin: 0;
    }

    .jf-error {
      padding: 10px 14px;
      background: var(--bg-error);
      border: 1px solid var(--border-error);
      border-radius: 6px;
      color: var(--color-error);
      font-size: 13px;
      display: none;
    }

    .jf-error.show {
      display: block;
    }
    /* JSON 语法高亮 */
    .json-key { color: var(--color-key); }
    .json-string { color: var(--color-string); }
    .json-number { color: var(--color-number); }
    .json-boolean { color: var(--color-boolean); }
    .json-null { color: var(--color-null); font-style: italic; }
    .json-bracket { color: var(--color-bracket); }

    .collapsible { position: relative; }

    .collapse-toggle {
      display: inline-block;
      width: 16px;
      font-size: 10px;
      color: var(--color-toggle);
      cursor: pointer;
      user-select: none;
      transition: transform 0.15s, color 0.15s;
    }

    .collapse-toggle:hover { color: var(--text-title); }

    .collapse-toggle:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
      border-radius: 2px;
    }

    .collapsible.collapsed > .collapse-toggle {
      transform: rotate(-90deg);
    }

    .collapsible.collapsed > .json-content {
      display: none;
    }

    .collapsible.collapsed > .json-placeholder {
      display: inline;
    }

    .json-placeholder {
      display: none;
      color: var(--color-null);
      font-style: italic;
    }

    .json-content { display: inline; }

    .jf-toast {
      position: absolute;
      bottom: 16px;
      right: 16px;
      padding: 8px 16px;
      background: var(--bg-toast);
      color: var(--text-toast);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: var(--shadow-toast);
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
    }

    .jf-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  // ── SVG 图标 ──

  const ICON_EXPAND = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  const ICON_COLLAPSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  const ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const ICON_PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';

  // ── 创建 Shadow DOM 容器 ──

  const host = document.createElement('div');
  host.id = '__json_formatter_host_' + Date.now() + '__';
  const shadow = host.attachShadow({ mode: 'closed' });

  // 注入样式
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.appendChild(style);

  // 根容器
  const root = document.createElement('div');
  root.className = 'jf-root';
  shadow.appendChild(root);

  // 遮罩层
  const overlay = document.createElement('div');
  overlay.className = 'jf-overlay';
  root.appendChild(overlay);

  // 对话框
  const dialog = document.createElement('div');
  dialog.className = 'jf-dialog';
  root.appendChild(dialog);

  // 标题栏
  const titlebar = document.createElement('div');
  titlebar.className = 'jf-titlebar';
  dialog.appendChild(titlebar);

  const titleLeft = document.createElement('div');
  titleLeft.className = 'jf-title';
  titleLeft.innerHTML = '<span class="jf-logo">{ }</span><h2>JSON Formatter</h2>';
  titlebar.appendChild(titleLeft);

  const actions = document.createElement('div');
  actions.className = 'jf-actions';
  titlebar.appendChild(actions);

  // 按钮：展开全部
  const btnExpand = document.createElement('button');
  btnExpand.innerHTML = ICON_EXPAND + '<span>' + msg('btnExpand') + '</span>';
  btnExpand.title = msg('btnExpand');
  actions.appendChild(btnExpand);

  // 按钮：折叠全部
  const btnCollapse = document.createElement('button');
  btnCollapse.innerHTML = ICON_COLLAPSE + '<span>' + msg('btnCollapse') + '</span>';
  btnCollapse.title = msg('btnCollapse');
  actions.appendChild(btnCollapse);

  // 按钮：复制
  const btnCopy = document.createElement('button');
  btnCopy.innerHTML = ICON_COPY + '<span>' + msg('btnCopy') + '</span>';
  btnCopy.title = msg('btnCopyTitle');
  actions.appendChild(btnCopy);

  // 按钮：固定
  const btnPin = document.createElement('button');
  btnPin.className = 'jf-pin';
  btnPin.innerHTML = ICON_PIN;
  btnPin.title = msg('btnPin');
  actions.appendChild(btnPin);

  // 按钮：关闭
  const btnClose = document.createElement('button');
  btnClose.className = 'jf-close';
  btnClose.textContent = '✕';
  btnClose.title = msg('btnClose');
  actions.appendChild(btnClose);

  // 内容区域
  const body = document.createElement('div');
  body.className = 'jf-body';
  dialog.appendChild(body);

  const errorEl = document.createElement('div');
  errorEl.className = 'jf-error';
  body.appendChild(errorEl);
  const output = document.createElement('pre');
  output.className = 'jf-output';
  body.appendChild(output);

  const toast = document.createElement('div');
  toast.className = 'jf-toast';
  dialog.appendChild(toast);

  // ── 功能逻辑 ──

  let currentJson = null;

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  }

  function formatJson(text) {
    errorEl.classList.remove('show');
    output.innerHTML = '';
    currentJson = null;

    if (!text || !text.trim()) {
      errorEl.textContent = msg('errorEmpty');
      errorEl.classList.add('show');
      return;
    }

    const sizeMB = new Blob([text]).size / (1024 * 1024);

    if (sizeMB > 10) {
      errorEl.textContent = msg('errorTooLarge');
      errorEl.classList.add('show');
      return;
    }

    try {
      currentJson = JSON.parse(text);
      output.innerHTML = renderValue(currentJson, 0);
    } catch (e) {
      errorEl.textContent = msg('errorParse', [e.message]);
      errorEl.classList.add('show');
    }
  }

  function closeDialog() {
    host.remove();
    document.removeEventListener('keydown', onEsc);
    chrome.runtime.onMessage.removeListener(onMessage);
  }
  // ── 事件绑定 ──

  // 折叠/展开点击
  output.addEventListener('click', (e) => {
    if (e.target.classList.contains('collapse-toggle')) {
      e.target.closest('.collapsible').classList.toggle('collapsed');
    }
  });

  // 键盘支持折叠
  output.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('collapse-toggle') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.target.closest('.collapsible').classList.toggle('collapsed');
    }
  });

  // 展开全部
  btnExpand.addEventListener('click', () => {
    output.querySelectorAll('.collapsible.collapsed').forEach(el => {
      el.classList.remove('collapsed');
    });
  });

  // 折叠全部
  btnCollapse.addEventListener('click', () => {
    output.querySelectorAll('.collapsible').forEach(el => {
      el.classList.add('collapsed');
    });
  });

  // 复制
  btnCopy.addEventListener('click', () => {
    if (!currentJson) return;
    const text = JSON.stringify(currentJson, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg('copied'));
    }).catch(() => {
      showToast(msg('copyFailed'));
    });
  });

  // 关闭按钮
  btnClose.addEventListener('click', closeDialog);

  // 固定/取消固定
  let pinned = false;
  btnPin.addEventListener('click', () => {
    pinned = !pinned;
    host.classList.toggle('pinned', pinned);
    btnPin.classList.toggle('active', pinned);
    btnPin.title = pinned ? msg('btnUnpin') : msg('btnPin');
    // pin 后不再响应新的格式化消息
    if (pinned) {
      chrome.runtime.onMessage.removeListener(onMessage);
    } else {
      chrome.runtime.onMessage.addListener(onMessage);
    }
  });

  // 点击遮罩关闭（仅非固定模式）
  overlay.addEventListener('click', closeDialog);

  // ESC 关闭（只关闭当前实例的未 pin 窗口）
  function onEsc(e) {
    if (e.key === 'Escape' && !pinned && host.parentNode) {
      closeDialog();
    }
  }
  document.addEventListener('keydown', onEsc);
  // ── 拖拽移动 ──

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  titlebar.addEventListener('mousedown', (e) => {
    // 不拦截按钮点击
    if (e.target.closest('button')) return;
    isDragging = true;
    const rect = dialog.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    dialog.style.left = x + 'px';
    dialog.style.top = y + 'px';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.margin = '0';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // ── 居中定位 ──

  function centerDialog() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const offset = pinnedCount * 30;
    dialog.style.left = Math.max(0, (w - 620) / 2 + offset) + 'px';
    dialog.style.top = Math.max(0, (h - 520) / 2 + offset) + 'px';
  }

  centerDialog();

  // ── 挂载到页面 ──

  document.body.appendChild(host);

  // ── 监听来自 background.js 的消息 ──

  function onMessage(message) {
    if (message.action === 'formatJson') {
      formatJson(message.text);
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);
})();
