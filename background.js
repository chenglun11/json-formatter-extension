chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'format-json',
    title: chrome.i18n.getMessage('contextMenuTitle'),
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'format-json') {
    const text = info.selectionText || '';
    chrome.storage.local.set({ jsonText: text }, () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('viewer.html')
      });
    });
  }
});

// 点击扩展图标直接打开查看器
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('viewer.html')
  });
});
