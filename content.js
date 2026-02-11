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

  function decodeUnicode(text) {
    return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

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
  // ── JSONPath 查询引擎 ──

  function jsonPathQuery(root, path) {
    if (!path || path === '$') return [root];
    // 去掉开头的 $
    let expr = path.replace(/^\$/, '');
    // 词法分析：拆分为 token
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      if (expr[i] === '.') {
        if (expr[i + 1] === '.') {
          tokens.push({ type: 'recurse' });
          i += 2;
        } else {
          i += 1;
          // 读取 key
          let key = '';
          while (i < expr.length && expr[i] !== '.' && expr[i] !== '[') {
            key += expr[i++];
          }
          if (key === '*') tokens.push({ type: 'wildcard' });
          else if (key) tokens.push({ type: 'key', value: key });
        }
      } else if (expr[i] === '[') {
        i++; // skip [
        let inner = '';
        while (i < expr.length && expr[i] !== ']') {
          inner += expr[i++];
        }
        i++; // skip ]
        inner = inner.trim();
        if (inner === '*') {
          tokens.push({ type: 'wildcard' });
        } else if (inner.includes(':')) {
          const parts = inner.split(':');
          tokens.push({ type: 'slice', start: parts[0] ? parseInt(parts[0], 10) : undefined, end: parts[1] ? parseInt(parts[1], 10) : undefined });
        } else if ((inner[0] === "'" && inner[inner.length - 1] === "'") || (inner[0] === '"' && inner[inner.length - 1] === '"')) {
          tokens.push({ type: 'key', value: inner.slice(1, -1) });
        } else {
          const idx = parseInt(inner, 10);
          if (!isNaN(idx)) tokens.push({ type: 'index', value: idx });
          else tokens.push({ type: 'key', value: inner });
        }
      } else {
        // 直接读取 key（无前导点的情况，不应出现，但容错）
        let key = '';
        while (i < expr.length && expr[i] !== '.' && expr[i] !== '[') {
          key += expr[i++];
        }
        if (key) tokens.push({ type: 'key', value: key });
      }
    }
    if (tokens.length === 0) return [root];

    function resolve(nodes, tIdx) {
      if (tIdx >= tokens.length) return nodes;
      const token = tokens[tIdx];
      let next = [];
      if (token.type === 'recurse') {
        // 递归下降：收集所有后代，然后对每个后代应用下一个 token
        if (tIdx + 1 >= tokens.length) return nodes;
        const descendants = [];
        function collect(val) {
          descendants.push(val);
          if (val && typeof val === 'object') {
            if (Array.isArray(val)) val.forEach(v => collect(v));
            else Object.values(val).forEach(v => collect(v));
          }
        }
        nodes.forEach(n => collect(n));
        return resolve(descendants, tIdx + 1);
      }
      for (const node of nodes) {
        if (node === null || typeof node !== 'object') continue;
        if (token.type === 'key') {
          if (!Array.isArray(node) && token.value in node) next.push(node[token.value]);
        } else if (token.type === 'index') {
          const arr = Array.isArray(node) ? node : Object.values(node);
          const idx = token.value < 0 ? arr.length + token.value : token.value;
          if (idx >= 0 && idx < arr.length) next.push(arr[idx]);
        } else if (token.type === 'wildcard') {
          if (Array.isArray(node)) next.push(...node);
          else next.push(...Object.values(node));
        } else if (token.type === 'slice') {
          const arr = Array.isArray(node) ? node : Object.values(node);
          const start = token.start !== undefined ? (token.start < 0 ? arr.length + token.start : token.start) : 0;
          const end = token.end !== undefined ? (token.end < 0 ? arr.length + token.end : token.end) : arr.length;
          next.push(...arr.slice(start, end));
        }
      }
      return resolve(next, tIdx + 1);
    }

    return resolve([root], 0);
  }

  // ── Shadow DOM 样式 ──

  const STYLES = `
    :host {
      all: initial;
      position: fixed;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Menlo, monospace;
    }

    :host(:not(.pinned)) {
      top: 0; left: 0; right: 0; bottom: 0;
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

    .jf-actions button.active {
      background: var(--text-title);
      border-color: var(--text-title);
      color: #fff;
    }

    .jf-actions button.active svg {
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

    .json-line-num {
      color: var(--color-null);
      user-select: none;
    }

    .json-error-line {
      display: inline-block;
      width: 100%;
      background: var(--bg-error);
      border-radius: 2px;
    }

    .collapsible {
      position: relative;
      border-radius: 3px;
      transition: background 0.15s;
    }

    .collapsible.highlight {
      background: rgba(137, 180, 250, 0.08);
    }

    @media (prefers-color-scheme: light) {
      .collapsible.highlight {
        background: rgba(37, 99, 235, 0.06);
      }
    }

    .collapse-toggle {
      display: inline-block;
      width: 16px;
      font-size: 10px;
      color: var(--color-toggle);
      cursor: pointer;
      user-select: none;
      vertical-align: text-top;
      text-align: center;
      transform-origin: center;
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

    .jf-query-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: var(--bg-toolbar);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .jf-query-input {
      flex: 1;
      padding: 3px 0;
      background: transparent;
      border: none;
      color: var(--text);
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-size: 13px;
      outline: none;
    }

    .jf-query-input:focus {
      border-bottom-color: var(--text-title);
    }

    .jf-query-status {
      font-size: 11px;
      color: var(--color-null);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .jf-query-status.error {
      color: var(--color-error);
    }

    .jf-query-status.success {
      color: var(--color-string);
    }

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
  const ICON_UNICODE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

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

  // 按钮：展开/折叠 toggle
  const btnToggleCollapse = document.createElement('button');
  btnToggleCollapse.innerHTML = '<span class="icon-collapse">' + ICON_COLLAPSE + '</span><span class="icon-expand" style="display:none">' + ICON_EXPAND + '</span><span class="toggle-label">' + msg('btnCollapse') + '</span>';
  btnToggleCollapse.title = msg('btnCollapse');
  actions.appendChild(btnToggleCollapse);

  // 按钮：复制
  const btnCopy = document.createElement('button');
  btnCopy.innerHTML = ICON_COPY + '<span>' + msg('btnCopy') + '</span>';
  btnCopy.title = msg('btnCopyTitle');
  actions.appendChild(btnCopy);

  // 按钮：Unicode 解码
  const btnUnicode = document.createElement('button');
  btnUnicode.innerHTML = ICON_UNICODE + '<span>' + msg('btnUnicode') + '</span>';
  btnUnicode.title = msg('btnUnicodeTitle');
  actions.appendChild(btnUnicode);

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

  // 查询栏
  const queryBar = document.createElement('div');
  queryBar.className = 'jf-query-bar';
  dialog.appendChild(queryBar);

  const queryInput = document.createElement('input');
  queryInput.type = 'text';
  queryInput.className = 'jf-query-input';
  queryInput.placeholder = msg('jsonpathPlaceholder');
  queryInput.setAttribute('aria-label', msg('jsonpathLabel'));
  queryBar.appendChild(queryInput);

  const queryStatus = document.createElement('span');
  queryStatus.className = 'jf-query-status';
  queryBar.appendChild(queryStatus);

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
  let queryResult = null;
  let queryDebounceTimer = null;
  let unicodeDecode = false;
  let lastRawText = '';

  // 拖拽状态（提前声明，closeDialog 需要引用）
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onDragMove(e) {
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    dialog.style.left = x + 'px';
    dialog.style.top = y + 'px';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.margin = '0';
  }

  function onDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove, true);
    document.removeEventListener('mouseup', onDragEnd, true);
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  }

  function executeQuery() {
    const path = queryInput.value.trim();
    if (!path) {
      queryResult = null;
      queryStatus.textContent = '';
      queryStatus.className = 'jf-query-status';
      if (currentJson !== null) {
        output.innerHTML = renderValue(currentJson, 0);
      }
      return;
    }
    if (!currentJson) return;
    try {
      const results = jsonPathQuery(currentJson, path);
      if (results.length === 0) {
        queryResult = null;
        queryStatus.textContent = msg('jsonpathNoResults');
        queryStatus.className = 'jf-query-status error';
        output.innerHTML = '';
      } else {
        queryResult = results.length === 1 ? results[0] : results;
        const count = results.length;
        queryStatus.textContent = count === 1 ? msg('jsonpathMatch', [count]) : msg('jsonpathMatches', [count]);
        queryStatus.className = 'jf-query-status success';
        output.innerHTML = renderValue(queryResult, 0);
      }
    } catch (e) {
      queryResult = null;
      queryStatus.textContent = msg('jsonpathError');
      queryStatus.className = 'jf-query-status error';
    }
  }

  queryInput.addEventListener('input', () => {
    clearTimeout(queryDebounceTimer);
    queryDebounceTimer = setTimeout(executeQuery, 300);
  });

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(queryDebounceTimer);
      executeQuery();
    }
    if (e.key === 'Escape') {
      if (queryInput.value) {
        e.stopPropagation();
        queryInput.value = '';
        executeQuery();
      }
    }
  });

  function formatJson(text) {
    lastRawText = text;
    errorEl.classList.remove('show');
    output.innerHTML = '';
    currentJson = null;
    queryResult = null;
    queryInput.value = '';
    queryStatus.textContent = '';
    queryStatus.className = 'jf-query-status';

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

    // 自动检测 Unicode 转义序列，检测到则锁定开启
    const hasUnicode = /\\u[0-9a-fA-F]{4}/.test(text);
    if (hasUnicode) {
      unicodeDecode = true;
      btnUnicode.classList.add('active');
      btnUnicode.disabled = true;
    } else {
      btnUnicode.disabled = false;
    }
    if (unicodeDecode) text = decodeUnicode(text);

    try {
      currentJson = JSON.parse(text);
      output.innerHTML = renderValue(currentJson, 0);
    } catch (e) {
      if (!unicodeDecode) {
        errorEl.textContent = msg('errorParse', [e.message]);
        errorEl.classList.add('show');
      }
      // 显示带行号的原始文本，高亮出错行
      const pos = /position\s+(\d+)/i.exec(e.message);
      const lines = text.split('\n');
      let errorLine = -1;
      if (pos) {
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
          count += lines[i].length + 1;
          if (count > parseInt(pos[1], 10)) {
            errorLine = i;
            break;
          }
        }
      }
      const pad = String(lines.length).length;
      output.innerHTML = lines.map((line, i) => {
        const num = String(i + 1).padStart(pad, ' ');
        const prefix = '<span class="json-line-num">' + num + '</span>  ';
        if (i === errorLine) {
          return '<span class="json-error-line">' + prefix + escapeHtml(line) + '</span>';
        }
        return prefix + escapeHtml(line);
      }).join('\n');
    }
  }

  function closeDialog() {
    if (isDragging) onDragEnd();
    host.remove();
    document.removeEventListener('keydown', onEsc, true);
    chrome.runtime.onMessage.removeListener(onMessage);
  }
  // ── 事件绑定 ──

  // 折叠/展开点击
  output.addEventListener('click', (e) => {
    if (e.target.classList.contains('collapse-toggle')) {
      e.target.closest('.collapsible').classList.toggle('collapsed');
    }
  });

  // 悬停高亮最近的可折叠区块
  let highlightedEl = null;
  output.addEventListener('mouseover', (e) => {
    const target = e.target.closest('.collapsible');
    if (target === highlightedEl) return;
    if (highlightedEl) highlightedEl.classList.remove('highlight');
    highlightedEl = target;
    if (highlightedEl) highlightedEl.classList.add('highlight');
  });
  output.addEventListener('mouseleave', () => {
    if (highlightedEl) {
      highlightedEl.classList.remove('highlight');
      highlightedEl = null;
    }
  });

  // 键盘支持折叠
  output.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('collapse-toggle') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.target.closest('.collapsible').classList.toggle('collapsed');
    }
  });

  // 展开/折叠 toggle
  let allCollapsed = false;
  const toggleLabel = btnToggleCollapse.querySelector('.toggle-label');
  const toggleIconCollapse = btnToggleCollapse.querySelector('.icon-collapse');
  const toggleIconExpand = btnToggleCollapse.querySelector('.icon-expand');
  btnToggleCollapse.addEventListener('click', () => {
    allCollapsed = !allCollapsed;
    if (allCollapsed) {
      output.querySelectorAll('.collapsible').forEach(el => {
        el.classList.add('collapsed');
      });
      btnToggleCollapse.classList.add('active');
      toggleLabel.textContent = msg('btnExpand');
      toggleIconCollapse.style.display = 'none';
      toggleIconExpand.style.display = '';
    } else {
      output.querySelectorAll('.collapsible.collapsed').forEach(el => {
        el.classList.remove('collapsed');
      });
      btnToggleCollapse.classList.remove('active');
      toggleLabel.textContent = msg('btnCollapse');
      toggleIconCollapse.style.display = '';
      toggleIconExpand.style.display = 'none';
    }
  });

  // 复制
  btnCopy.addEventListener('click', () => {
    if (!currentJson) return;
    const data = queryResult !== null ? queryResult : currentJson;
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg('copied'));
    }).catch(() => {
      showToast(msg('copyFailed'));
    });
  });

  // Unicode 解码切换（仅手动输入无 \uXXXX 时可切换）
  btnUnicode.addEventListener('click', () => {
    unicodeDecode = !unicodeDecode;
    btnUnicode.classList.toggle('active', unicodeDecode);
    if (lastRawText) formatJson(lastRawText);
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
      // 如果查询栏有内容，先清空查询
      if (queryInput.value) {
        e.stopPropagation();
        e.preventDefault();
        queryInput.value = '';
        executeQuery();
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      closeDialog();
    }
  }
  document.addEventListener('keydown', onEsc, true);
  // ── 拖拽移动 ──

  titlebar.addEventListener('mousedown', (e) => {
    // 不拦截按钮点击
    if (e.target.closest('button')) return;
    isDragging = true;
    const rect = dialog.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
    document.addEventListener('mousemove', onDragMove, true);
    document.addEventListener('mouseup', onDragEnd, true);
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
