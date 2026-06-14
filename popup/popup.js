// Farsight Importer — popup logic
// Communicates with the Farsight app's embedded server via /api/import/* REST endpoints.

// ── State ─────────────────────────────────────────────────────────────────────

let serverUrl = '';
let selectedCharIds = new Set();
let selectedCampaignIds = new Set();
let foundryPacksCache = [];
let selectedPackIds = new Set();
let partiesCache = [];

// ── Initialisation ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupTabs();
  setupSettingsTab();
  await initDdbTab();
  setupFoundryTab();
  updateConnectionBadge();
});

// ── Settings persistence ──────────────────────────────────────────────────────

async function loadSettings() {
  const { farsightServerUrl = '' } = await chrome.storage.local.get('farsightServerUrl');
  serverUrl = farsightServerUrl.replace(/\/$/, '');
  document.getElementById('settings-server-url').value = serverUrl;
}

function setupSettingsTab() {
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const raw = document.getElementById('settings-server-url').value.trim().replace(/\/$/, '');
    serverUrl = raw;
    await chrome.storage.local.set({ farsightServerUrl: serverUrl });
    showResult('settings-result', 'Saved.', 'info');
    updateConnectionBadge();
  });

  document.getElementById('btn-test-connection').addEventListener('click', async () => {
    if (!serverUrl) { showResult('settings-result', 'Enter a server URL first.', 'error'); return; }
    try {
      const res = await appFetch('/api/import/status');
      if (res.ok) {
        const data = await res.json();
        showResult('settings-result',
          `Connected. DDB: ${data.ddbConnected ? '✓' : '✗'}, Foundry discovered: ${data.foundryDiscovered ? '✓' : '✗'}`,
          'success');
        updateConnectionBadge(true);
      } else {
        showResult('settings-result', `Server responded ${res.status}`, 'error');
      }
    } catch (e) {
      showResult('settings-result', `Cannot reach server: ${e.message}`, 'error');
    }
  });
}

// ── Tab navigation ────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
  });
}

// ── D&D Beyond tab ────────────────────────────────────────────────────────────

async function initDdbTab() {
  const token = await readCobaltToken();
  const statusEl = document.getElementById('ddb-auth-status');

  if (!token) {
    statusEl.textContent = 'Not logged in to D&D Beyond in this browser.';
    document.getElementById('ddb-not-logged-in').classList.remove('hidden');
    return;
  }

  statusEl.textContent = 'D&D Beyond session detected.';

  // Push token to app
  if (serverUrl) {
    try {
      await appFetch('/api/import/ddb-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch (_) { /* non-fatal */ }
  }

  document.getElementById('ddb-connected-ui').classList.remove('hidden');
  await loadParties('ddb-party-select');
  await loadDdbCharacters();
  await loadDdbCampaigns();

  document.getElementById('btn-refresh-chars').addEventListener('click', loadDdbCharacters);
  document.getElementById('btn-refresh-campaigns').addEventListener('click', loadDdbCampaigns);
  document.getElementById('btn-import-ddb').addEventListener('click', importDdb);
}

async function readCobaltToken() {
  try {
    const cookie = await chrome.cookies.get({ url: 'https://www.dndbeyond.com', name: 'cobalt-token' });
    return cookie?.value ?? null;
  } catch (_) {
    return null;
  }
}

async function loadDdbCharacters() {
  const listEl = document.getElementById('ddb-chars-list');
  listEl.innerHTML = '<p class="muted">Loading…</p>';
  if (!serverUrl) { listEl.innerHTML = '<p class="muted">Set server URL in Settings first.</p>'; return; }
  try {
    const res = await appFetch('/api/import/ddb/characters');
    if (!res.ok) throw new Error(await extractError(res));
    const { characters = [] } = await res.json();
    renderCharacterList(listEl, characters);
  } catch (e) {
    listEl.innerHTML = `<p class="muted" style="color:var(--error)">${e.message}</p>`;
  }
}

function renderCharacterList(el, characters) {
  if (!characters.length) { el.innerHTML = '<p class="muted">No characters found.</p>'; return; }
  el.innerHTML = '';
  characters.forEach(c => {
    const item = makeListItem(
      `char-${c.id}`,
      c.name,
      `${c.klass} · Lv ${c.level}`,
      false,
    );
    item.addEventListener('change', () => {
      if (item.checked) selectedCharIds.add(c.id);
      else selectedCharIds.delete(c.id);
      updateImportButton();
    });
    el.appendChild(item.parentElement);
  });
}

async function loadDdbCampaigns() {
  const listEl = document.getElementById('ddb-campaigns-list');
  listEl.innerHTML = '<p class="muted">Loading…</p>';
  if (!serverUrl) return;
  try {
    const res = await appFetch('/api/import/ddb/campaigns');
    if (!res.ok) throw new Error(await extractError(res));
    const { campaigns = [] } = await res.json();
    renderCampaignList(listEl, campaigns);
  } catch (e) {
    listEl.innerHTML = `<p class="muted" style="color:var(--error)">${e.message}</p>`;
  }
}

function renderCampaignList(el, campaigns) {
  if (!campaigns.length) { el.innerHTML = '<p class="muted">No campaigns found.</p>'; return; }
  el.innerHTML = '';
  campaigns.forEach(c => {
    const item = makeListItem(
      `campaign-${c.id}`,
      c.name,
      `${c.characterCount} character${c.characterCount !== 1 ? 's' : ''}`,
      false,
    );
    item.addEventListener('change', () => {
      if (item.checked) selectedCampaignIds.add(c.id);
      else selectedCampaignIds.delete(c.id);
      updateImportButton();
    });
    el.appendChild(item.parentElement);
  });
}

function updateImportButton() {
  const hasSelection = selectedCharIds.size > 0 || selectedCampaignIds.size > 0;
  document.getElementById('btn-import-ddb').disabled = !hasSelection;
}

async function importDdb() {
  const partyId = parseInt(document.getElementById('ddb-party-select').value, 10);
  if (!partyId) { showResult('ddb-result', 'Select a party first.', 'error'); return; }

  const btn = document.getElementById('btn-import-ddb');
  btn.disabled = true;
  btn.textContent = 'Importing…';

  try {
    // Import individually selected characters
    let imported = 0;
    if (selectedCharIds.size > 0) {
      const res = await appFetch('/api/import/ddb/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterIds: Array.from(selectedCharIds), partyId }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      const data = await res.json();
      imported += data.imported ?? 0;
    }

    // Import all characters from selected campaigns
    for (const campaignId of selectedCampaignIds) {
      const campaignEl = document.getElementById(`campaign-${campaignId}-checkbox`);
      const charIds = campaignEl ? JSON.parse(campaignEl.dataset.charIds ?? '[]') : [];
      if (charIds.length > 0) {
        const res = await appFetch('/api/import/ddb/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterIds: charIds, partyId }),
        });
        if (res.ok) {
          const data = await res.json();
          imported += data.imported ?? 0;
        }
      }
    }

    showResult('ddb-result', `Imported ${imported} character${imported !== 1 ? 's' : ''} successfully.`, 'success');
    selectedCharIds.clear();
    selectedCampaignIds.clear();
  } catch (e) {
    showResult('ddb-result', `Import failed: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Import selected';
    updateImportButton();
  }
}

// ── Foundry VTT tab ───────────────────────────────────────────────────────────

function setupFoundryTab() {
  // Restore saved Foundry credentials
  chrome.storage.local.get(['foundryUrl', 'foundryUser'], ({ foundryUrl = '', foundryUser = '' }) => {
    document.getElementById('foundry-url').value = foundryUrl;
    document.getElementById('foundry-user').value = foundryUser;
  });

  document.getElementById('btn-foundry-connect').addEventListener('click', connectFoundry);
  document.getElementById('btn-import-foundry').addEventListener('click', importFoundry);
}

async function connectFoundry() {
  const url = document.getElementById('foundry-url').value.trim();
  const user = document.getElementById('foundry-user').value.trim();
  const pass = document.getElementById('foundry-pass').value;

  if (!url || !user) { showResult('foundry-connect-status', 'Enter Foundry URL and username.', 'error'); return; }
  if (!serverUrl) { showResult('foundry-connect-status', 'Set Farsight server URL in Settings first.', 'error'); return; }

  await chrome.storage.local.set({ foundryUrl: url, foundryUser: user });

  const btn = document.getElementById('btn-foundry-connect');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  showResult('foundry-connect-status', 'Connecting to Foundry…', 'info');
  document.getElementById('foundry-connect-status').classList.remove('hidden');

  try {
    const res = await appFetch('/api/import/foundry/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, username: user, password: pass }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    const data = await res.json();
    foundryPacksCache = data.packs ?? [];
    selectedPackIds.clear();

    const gen = data.foundryGeneration ? ` (Foundry v${data.foundryGeneration})` : '';
    const title = data.worldTitle ? `"${data.worldTitle}"` : 'World';
    showResult('foundry-connect-status', `Connected to ${title}${gen}. ${foundryPacksCache.length} pack(s) found.`, 'success');
    renderFoundryPacks();
    document.getElementById('foundry-packs-ui').classList.remove('hidden');
  } catch (e) {
    showResult('foundry-connect-status', `Connection failed: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect & Discover Packs';
  }
}

function renderFoundryPacks() {
  const listEl = document.getElementById('foundry-packs-list');
  listEl.innerHTML = '';
  if (!foundryPacksCache.length) { listEl.innerHTML = '<p class="muted">No actor packs found.</p>'; return; }

  foundryPacksCache.forEach(p => {
    const count = p.actorCount != null ? `${p.actorCount} actors` : 'inactive';
    const item = makeListItem(`pack-${p.id}`, p.label, `${p.packageTitle} · ${count}`, !p.active);
    if (!p.active) item.disabled = true;
    item.addEventListener('change', () => {
      if (item.checked) selectedPackIds.add(p.id);
      else selectedPackIds.delete(p.id);
      document.getElementById('btn-import-foundry').disabled = selectedPackIds.size === 0;
    });
    listEl.appendChild(item.parentElement);
  });
}

async function importFoundry() {
  if (selectedPackIds.size === 0) return;

  const btn = document.getElementById('btn-import-foundry');
  btn.disabled = true;
  btn.textContent = 'Importing…';

  try {
    const res = await appFetch('/api/import/foundry/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packIds: Array.from(selectedPackIds) }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    const data = await res.json();
    showResult('foundry-result', `Imported ${data.imported ?? 0} monster${data.imported !== 1 ? 's' : ''}.`, 'success');
    document.getElementById('foundry-result').classList.remove('hidden');

    // Release Foundry socket
    appFetch('/api/import/foundry/release', { method: 'POST' }).catch(() => {});
    foundryPacksCache = [];
    selectedPackIds.clear();
    document.getElementById('foundry-packs-ui').classList.add('hidden');
  } catch (e) {
    showResult('foundry-result', `Import failed: ${e.message}`, 'error');
    document.getElementById('foundry-result').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Import selected packs';
  }
}

// ── Parties helper ────────────────────────────────────────────────────────────

async function loadParties(selectId) {
  const select = document.getElementById(selectId);
  if (!serverUrl) return;
  try {
    const res = await appFetch('/api/import/parties');
    if (!res.ok) return;
    const { parties = [] } = await res.json();
    partiesCache = parties;
    select.innerHTML = parties.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  } catch (_) {
    select.innerHTML = '<option value="">Could not load parties</option>';
  }
}

// ── Connection badge ──────────────────────────────────────────────────────────

async function updateConnectionBadge(forceConnected = false) {
  const badge = document.getElementById('connection-badge');
  if (forceConnected) {
    badge.textContent = 'Connected';
    badge.className = 'badge badge-connected';
    return;
  }
  if (!serverUrl) {
    badge.textContent = 'Not connected';
    badge.className = 'badge badge-disconnected';
    return;
  }
  try {
    const res = await appFetch('/api/import/status', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      badge.textContent = 'Connected';
      badge.className = 'badge badge-connected';
    } else {
      throw new Error();
    }
  } catch (_) {
    badge.textContent = 'Not connected';
    badge.className = 'badge badge-disconnected';
  }
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function appFetch(path, options = {}) {
  return fetch(`${serverUrl}${path}`, options);
}

async function extractError(res) {
  try {
    const data = await res.json();
    return data.error ?? `HTTP ${res.status}`;
  } catch (_) {
    return `HTTP ${res.status}`;
  }
}

/**
 * Creates a checkbox list item and returns the checkbox input element.
 * The returned element's .parentElement is the full row to append.
 */
function makeListItem(id, name, sub, disabled) {
  const row = document.createElement('label');
  row.className = `list-item${disabled ? ' pack-inactive' : ''}`;
  row.htmlFor = `${id}-checkbox`;

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = `${id}-checkbox`;
  cb.disabled = disabled;

  const info = document.createElement('div');
  info.className = 'list-item-info';
  info.innerHTML = `<div class="list-item-name">${escHtml(name)}</div>
                    <div class="list-item-sub">${escHtml(sub)}</div>`;

  row.appendChild(cb);
  row.appendChild(info);
  return cb;
}

function showResult(id, message, type) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `result-msg ${type}`;
  el.classList.remove('hidden');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
