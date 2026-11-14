/* The browser reads a server snapshot; all account and learning writes go through the API. */
(function (root) {
  'use strict';
  const readMethods = new Set(['today', 'plusDays', 'previewSchedule']);
  const storageKey = 'learnio.local.v1';
  let view, catalogue = [], defaults = {}, academy = {}, connectionError = '', needsReload = false;
  let queue = Promise.resolve();
  const methods = new Map();

  function showConnectionError(message) {
    connectionError = message;
    let banner = document.getElementById('connection-status');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'connection-status';
      banner.className = 'connection-banner demo-banner';
      banner.setAttribute('role', 'alert');
      banner.style.cssText = 'margin:1rem;padding:1rem;position:relative;z-index:1000;';
      const text = document.createElement('span');
      text.id = 'connection-error-text';
      const reload = document.createElement('button');
      reload.type = 'button';
      reload.className = 'button secondary';
      reload.textContent = 'Reload records';
      reload.addEventListener('click', () => root.location.reload());
      banner.append(text, reload);
      document.body.prepend(banner);
    }
    document.getElementById('connection-error-text').textContent = message;
  }

  function installSnapshot(response) {
    const snapshot = response.snapshot;
    if (!snapshot || snapshot.version !== 1 || !Number.isInteger(snapshot.revision)
      || !Array.isArray(snapshot.users) || !snapshot.userData
      || snapshot.activeUserId && (!snapshot.users.some(u => u.id === snapshot.activeUserId) || !snapshot.userData[snapshot.activeUserId])) {
      throw Error('The server returned an incomplete account snapshot.');
    }
    const serialized = JSON.stringify(snapshot);
    const next = root.LearnioDomain.createStore({ seed: false, catalogue: response.catalogue || catalogue, storage: {
      getItem: key => key === storageKey ? serialized : null,
      setItem: () => { throw Error('The browser snapshot is read-only.'); },
      removeItem: () => { throw Error('The browser snapshot is read-only.'); }
    } });
    if (next.getPersistence().error) throw Error('The server account snapshot could not be read.');
    // Swap only after validation, so a failed request never erases the last confirmed records.
    view = next;
    if (Array.isArray(response.catalogue)) catalogue = response.catalogue;
    if (response.defaults && typeof response.defaults === 'object') defaults = response.defaults;
    if (Object.hasOwn(response, 'academy')) academy = response.academy || {};
    connectionError = '';
    document.getElementById('connection-status')?.remove();
  }

  async function request(path, body) {
    const writing = body !== undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, {
        method: writing ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: writing ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
        ...(writing ? { body } : {}), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        if (typeof result.ok !== 'boolean') throw Error('Unexpected server response.');
        if (response.status === 401 && writing && JSON.parse(body).action !== 'login') {
          needsReload = true;
          showConnectionError('Your session has ended. Reload records to sign in again.');
        }
        return { ...result, ok: false, error: result.error || 'The server could not save this change.' };
      }
      installSnapshot(result);
      return result;
    } catch (_) {
      const message = writing
        ? 'The server response was interrupted. This change may have been saved. Reload records to check before trying again; no request will be automatically repeated.'
        : 'Learnio could not reach its server. Start the Learnio server and reload this page. Your records have not been replaced with offline data.';
      if (writing) needsReload = true;
      showConnectionError(message);
      return { ok: false, error: message, uncertain: writing };
    } finally {
      clearTimeout(timeout);
    }
  }

  function mutate(action, args) {
    let body;
    try { body = JSON.stringify({ action, args }); }
    catch (_) { return Promise.resolve({ ok: false, error: 'This change contains data that cannot be sent.' }); }
    // One request at a time preserves rapid answer selections and their returned snapshots.
    const pending = queue.then(async () => {
      const ready = await root.learnioReady;
      if (!ready.ok || needsReload) return { ok: false, error: connectionError || 'Reload records before making another change.' };
      return request('/api/action', body);
    });
    queue = pending.catch(() => {});
    return pending;
  }

  root.LearnioStore = new Proxy({}, {
    get(_target, property) {
      if (property === 'then' || typeof property === 'symbol') return undefined;
      if (property === 'catalogue') return structuredClone(catalogue);
      if (property === 'defaults') return structuredClone(defaults);
      if (property === 'questions') return []; // Answer keys belong on the server.
      if (property === 'storageKey') return storageKey;
      if (property === 'version') return 1;
      if (!methods.has(property)) {
        if (property === 'whenIdle') methods.set(property, () => queue);
        else if (property === 'getPersistence') methods.set(property, () => ({ available: !!view && !connectionError, error: connectionError }));
        else if (property === 'getWorkspace') methods.set(property, () => structuredClone(academy));
        else if (property.startsWith('get') || readMethods.has(property)) methods.set(property, (...args) => {
          if (!view) throw Error('Wait for Learnio to load its server records.');
          if (typeof view[property] !== 'function') throw Error(`Unknown Learnio reader: ${property}`);
          return view[property](...args);
        });
        else methods.set(property, (...args) => mutate(property, args));
      }
      return methods.get(property);
    },
    set() { throw Error('Use the Learnio API to change saved records.'); }
  });

  root.learnioReady = request('/api/session').then(result => {
    if (!result.ok && !connectionError) showConnectionError(result.error || 'Your session could not be loaded. Reload to try again.');
    return result;
  });
})(window);
