chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'format-json',
    title: chrome.i18n.getMessage('contextMenuTitle'),
    contexts: ['selection']
  });
});

// 回退到新标签页打开 viewer.html
function fallbackToViewer(text) {
  chrome.storage.local.set({ jsonText: text }, () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('viewer.html')
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'format-json') {
    const text = info.selectionText || '';

    // 尝试注入 content.js 到当前标签页
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).then(() => {
      // 注入成功，发送 JSON 文本给 content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'formatJson',
        text: text
      });
    }).catch(() => {
      // 注入失败（如 chrome:// 页面），回退到新标签页
      fallbackToViewer(text);
    });
  }
});

// 点击扩展图标直接打开查看器
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('viewer.html')
  });
});
