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

  const output = document.getElementById('output');
  const error = document.getElementById('error');
  const rawInput = document.getElementById('raw-input');
  const btnExpand = document.getElementById('btn-expand');
  const btnCollapse = document.getElementById('btn-collapse');
  const btnCopy = document.getElementById('btn-copy');
  const btnRaw = document.getElementById('btn-raw');

  let currentJson = null;
  let showingRaw = false;

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
    html += '<span class="collapse-toggle">▼</span>';
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
    html += '<span class="collapse-toggle">▼</span>';
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

    if (!text || !text.trim()) {
      error.textContent = msg('errorEmpty');
      error.classList.remove('hidden');
      return;
    }

    try {
      currentJson = JSON.parse(text);
      output.innerHTML = renderValue(currentJson, 0);
    } catch (e) {
      error.textContent = msg('errorParse', [e.message]);
      error.classList.remove('hidden');
      currentJson = null;
    }
  }

  // 事件委托：仅点击箭头触发折叠，不影响文本选择
  output.addEventListener('click', (e) => {
    if (e.target.classList.contains('collapse-toggle')) {
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

  // 复制格式化后的 JSON
  btnCopy.addEventListener('click', () => {
    if (!currentJson) return;
    const text = JSON.stringify(currentJson, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg('copied'));
    });
  });

  // 切换原始文本 / 格式化视图
  btnRaw.addEventListener('click', () => {
    showingRaw = !showingRaw;
    if (showingRaw) {
      output.classList.add('hidden');
      rawInput.classList.remove('hidden');
      rawInput.value = currentJson
        ? JSON.stringify(currentJson, null, 2)
        : '';
      btnRaw.textContent = msg('btnFormatted');
      rawInput.focus();
    } else {
      rawInput.classList.add('hidden');
      output.classList.remove('hidden');
      btnRaw.textContent = msg('btnRaw');
      if (rawInput.value.trim()) {
        formatJson(rawInput.value);
      }
    }
  });

  // 在原始文本框中按 Ctrl+Enter 格式化
  rawInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (rawInput.value.trim()) {
        formatJson(rawInput.value);
        showingRaw = false;
        rawInput.classList.add('hidden');
        output.classList.remove('hidden');
        btnRaw.textContent = msg('btnRaw');
      }
    }
  });

  // 页面加载时从 chrome.storage 读取右键选中的文本
  chrome.storage.local.get('jsonText', (result) => {
    if (result.jsonText) {
      formatJson(result.jsonText);
      chrome.storage.local.remove('jsonText');
    } else {
      // 没有数据时显示原始文本输入框
      showingRaw = true;
      output.classList.add('hidden');
      rawInput.classList.remove('hidden');
      btnRaw.textContent = msg('btnFormatted');
      rawInput.focus();
    }
  });
})();
