(function () {
  const msg = chrome.i18n.getMessage;

  // i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = msg(el.dataset.i18n);
  });

  // Version
  document.getElementById('version').textContent = 'v' + chrome.runtime.getManifest().version;

  // CTA
  document.getElementById('cta-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
  });
})();
