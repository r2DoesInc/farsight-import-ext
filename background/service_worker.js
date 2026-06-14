// Farsight Importer — background service worker
// Minimal for v1. Future: listen for cobalt-token cookie changes and auto-push to app.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Farsight Importer] Extension installed.');
});
