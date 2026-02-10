(function () {
  const msg = chrome.i18n.getMessage;

  // i18n: text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = msg(el.dataset.i18n);
  });

  // Version badge
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = 'v' + manifest.version;

  // CTA button → open viewer.html
  document.getElementById('cta-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
  });
})();
