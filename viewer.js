(() => {
  const msg = chrome.i18n.getMessage;

  // 初始化 i18n：填充 data-i18n 属性的元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = msg(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = msg(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = msg(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', msg(el.dataset.i18nAria));
  });

  // 从 manifest.json 读取版本号
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = 'v' + manifest.version;

  // 检测平台，动态设置快捷键提示
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutKey = isMac ? 'Cmd+Enter' : 'Ctrl+Enter';
  const rawInput = document.getElementById('raw-input');
  rawInput.placeholder = msg('placeholder', [shortcutKey]);

  const output = document.getElementById('output');
  const error = document.getElementById('error');
  const btnToggleCollapse = document.getElementById('btn-toggle-collapse');
  const btnToggleLabel = btnToggleCollapse.querySelector('span');
  const btnToggleIconCollapse = btnToggleCollapse.querySelector('.icon-collapse');
  const btnToggleIconExpand = btnToggleCollapse.querySelector('.icon-expand');
  const btnCopy = document.getElementById('btn-copy');
  const btnRaw = document.getElementById('btn-raw');
  const btnQuery = document.getElementById('btn-query');

  let currentJson = null;
  let showingRaw = false;
  let queryResult = null;
  let queryDebounceTimer = null;

  const queryBar = document.getElementById('query-bar');
  const queryInput = document.getElementById('query-input');
  const queryStatusEl = document.getElementById('query-status');

  // JSONPath 查询引擎
  function jsonPathQuery(root, path) {
    if (!path || path === '$') return [root];
    let expr = path.replace(/^\$/, '');
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      if (expr[i] === '.') {
        if (expr[i + 1] === '.') {
          tokens.push({ type: 'recurse' });
          i += 2;
        } else {
          i += 1;
          let key = '';
          while (i < expr.length && expr[i] !== '.' && expr[i] !== '[') {
            key += expr[i++];
          }
          if (key === '*') tokens.push({ type: 'wildcard' });
          else if (key) tokens.push({ type: 'key', value: key });
        }
      } else if (expr[i] === '[') {
        i++;
        let inner = '';
        while (i < expr.length && expr[i] !== ']') {
          inner += expr[i++];
        }
        i++;
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

  function executeQuery() {
    const path = queryInput.value.trim();
    if (!path) {
      queryResult = null;
      queryStatusEl.textContent = '';
      queryStatusEl.className = 'query-status';
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
        queryStatusEl.textContent = msg('jsonpathNoResults');
        queryStatusEl.className = 'query-status has-error';
        output.innerHTML = '';
      } else {
        queryResult = results.length === 1 ? results[0] : results;
        const count = results.length;
        queryStatusEl.textContent = count === 1 ? msg('jsonpathMatch', [count]) : msg('jsonpathMatches', [count]);
        queryStatusEl.className = 'query-status has-success';
        output.innerHTML = renderValue(queryResult, 0);
      }
    } catch (e) {
      queryResult = null;
      queryStatusEl.textContent = msg('jsonpathError');
      queryStatusEl.className = 'query-status has-error';
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
    if (e.key === 'Escape' && queryInput.value) {
      e.stopPropagation();
      queryInput.value = '';
      executeQuery();
    }
  });

  // 转义 HTML 特殊字符
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 显示 toast 提示
  function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  }

  // 渲染 JSON 值（递归）
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

  // 渲染对象
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

  // 渲染数组
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

  // 格式化并展示 JSON
  function formatJson(text) {
    error.classList.add('hidden');
    output.innerHTML = '';
    queryResult = null;
    queryInput.value = '';
    queryStatusEl.textContent = '';
    queryStatusEl.className = 'query-status';

    if (!text || !text.trim()) {
      error.textContent = msg('errorEmpty');
      error.classList.remove('hidden');
      return;
    }

    const sizeMB = new Blob([text]).size / (1024 * 1024);

    // 超过 10MB 直接拒绝
    if (sizeMB > 10) {
      error.textContent = msg('errorTooLarge');
      error.classList.remove('hidden');
      return;
    }

    // 超过 5MB 弹出警告
    if (sizeMB > 5) {
      const sizeLabel = sizeMB.toFixed(1) + 'MB';
      if (!confirm(msg('warnLargeJson', [sizeLabel]))) {
        return;
      }
    }

    try {
      currentJson = JSON.parse(text);
      output.innerHTML = renderValue(currentJson, 0);
    } catch (e) {
      error.textContent = msg('errorParse', [e.message]);
      error.classList.remove('hidden');
      currentJson = null;
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

  // 事件委托：仅点击箭头触发折叠，不影响文本选择
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

  // 键盘支持：Enter/Space 触发折叠切换
  output.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('collapse-toggle') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.target.closest('.collapsible').classList.toggle('collapsed');
    }
  });

  // 展开/折叠 toggle
  let allCollapsed = false;
  btnToggleCollapse.addEventListener('click', () => {
    allCollapsed = !allCollapsed;
    if (allCollapsed) {
      output.querySelectorAll('.collapsible').forEach(el => {
        el.classList.add('collapsed');
      });
      btnToggleCollapse.classList.add('active');
      btnToggleLabel.textContent = msg('btnExpand');
      btnToggleIconCollapse.classList.add('hidden');
      btnToggleIconExpand.classList.remove('hidden');
    } else {
      output.querySelectorAll('.collapsible.collapsed').forEach(el => {
        el.classList.remove('collapsed');
      });
      btnToggleCollapse.classList.remove('active');
      btnToggleLabel.textContent = msg('btnCollapse');
      btnToggleIconCollapse.classList.remove('hidden');
      btnToggleIconExpand.classList.add('hidden');
    }
  });

  // 复制格式化后的 JSON
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

  // 切换编辑 / 格式化视图
  btnRaw.addEventListener('click', () => {
    showingRaw = !showingRaw;
    btnRaw.classList.toggle('active', showingRaw);
    if (showingRaw) {
      output.classList.add('hidden');
      rawInput.classList.remove('hidden');
      queryBar.classList.add('hidden');
      rawInput.value = currentJson
        ? JSON.stringify(currentJson, null, 2)
        : '';
      rawInput.focus();
    } else {
      rawInput.classList.add('hidden');
      output.classList.remove('hidden');
      if (rawInput.value.trim()) {
        formatJson(rawInput.value);
      }
    }
  });

  // 切换查询栏
  let queryBarVisible = false;
  btnQuery.addEventListener('click', () => {
    if (showingRaw) return;
    queryBarVisible = !queryBarVisible;
    queryBar.classList.toggle('hidden', !queryBarVisible);
    if (queryBarVisible) {
      queryInput.focus();
    } else {
      queryInput.value = '';
      executeQuery();
    }
  });

  // 在原始文本框中按 Ctrl+Enter 格式化
  rawInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (rawInput.value.trim()) {
        formatJson(rawInput.value);
        showingRaw = false;
        btnRaw.classList.remove('active');
        rawInput.classList.add('hidden');
        output.classList.remove('hidden');
      }
    }
  });

  // 页面加载时从 chrome.storage 读取右键选中的文本
  chrome.storage.local.get('jsonText', (result) => {
    if (result.jsonText) {
      formatJson(result.jsonText);
      chrome.storage.local.remove('jsonText');
    } else {
      // 没有数据时显示编辑模式
      showingRaw = true;
      btnRaw.classList.add('active');
      output.classList.add('hidden');
      rawInput.classList.remove('hidden');
      rawInput.focus();
    }
  });
})();
