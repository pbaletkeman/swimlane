"""Self-contained dev/test page for exercising the API without a frontend.

The page is served by the backend (same origin, so no CORS) at `/devtools` and
also rendered by `GET /auth/callback` when no OAuth `code` is present. After a
Google login the backend redirects the browser here with the JWTs in the URL,
so the tokens can be captured, stored, and used to call API endpoints straight
from the browser.
"""

DEVTOOLS_HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Swimlane API Devtools</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f6f7f9;
        --panel: #ffffff;
        --text: #1f2430;
        --muted: #5b6472;
        --border: #d7dce3;
        --accent: #3b82f6;
        --danger: #dc2626;
        --code-bg: #0f172a;
        --code-text: #e2e8f0;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0f172a;
          --panel: #1e293b;
          --text: #e2e8f0;
          --muted: #94a3b8;
          --border: #334155;
          --code-bg: #0b1120;
          --code-text: #cbd5e1;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      header {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
      }
      header h1 { font-size: 1.1rem; margin: 0; }
      header p { margin: 0; color: var(--muted); font-size: 0.85rem; }
      main {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 60rem;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .panel h2 { margin: 0; font-size: 0.95rem; }
      label { font-size: 0.85rem; color: var(--muted); }
      input[type="text"], textarea, select {
        width: 100%;
        padding: 0.5rem 0.65rem;
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        background: var(--panel);
        color: var(--text);
        font: inherit;
      }
      textarea { font-family: ui-monospace, monospace; font-size: 0.85rem; resize: vertical; }
      .row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
      .grow { flex: 1; }
      button {
        padding: 0.45rem 0.9rem;
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        background: var(--panel);
        color: var(--text);
        font: inherit;
        cursor: pointer;
      }
      button:hover { border-color: var(--accent); }
      button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
      button.danger { color: var(--danger); }
      button.small { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
      pre {
        margin: 0;
        padding: 1rem;
        background: var(--code-bg);
        color: var(--code-text);
        border-radius: 0.375rem;
        overflow: auto;
        font-size: 0.8rem;
        max-height: 24rem;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .status { font-size: 0.85rem; font-weight: 600; }
      .status.ok { color: #16a34a; }
      .status.err { color: var(--danger); }
      .hint { font-size: 0.8rem; color: var(--muted); }
    </style>
  </head>
  <body>
    <header>
      <h1>Swimlane API Devtools</h1>
      <p>Same-origin API tester — login via <a href="/login">/login</a> to capture a token automatically.</p>
    </header>
    <main>
      <section class="panel">
        <h2>Tokens</h2>
        <label for="access-token">Access token (Bearer)</label>
        <input type="text" id="access-token" placeholder="eyJ... (auto-filled after login)" spellcheck="false" />
        <label for="refresh-token">Refresh token</label>
        <input type="text" id="refresh-token" placeholder="eyJ..." spellcheck="false" />
        <label for="user-info">User (JSON from the login redirect)</label>
        <textarea id="user-info" rows="4" placeholder='{"sub": "...", "email": "..."}'></textarea>
        <div class="row">
          <button id="copy-access" class="small">Copy access token</button>
          <button id="clear-tokens" class="small">Clear tokens</button>
          <span id="saved-hint" class="hint"></span>
        </div>
      </section>

      <section class="panel">
        <h2>Quick endpoints</h2>
        <div class="row">
          <button data-path="/me">GET /me</button>
          <button data-path="/profile">GET /profile</button>
          <button data-path="/frequencies">GET /frequencies</button>
          <button data-path="/facilities">GET /facilities</button>
          <button data-path="/events">GET /events</button>
          <button data-path="/venues">GET /venues</button>
          <button data-path="/schedules">GET /schedules</button>
          <button data-path="/forms">GET /forms</button>
        </div>
        <div class="row">
          <button id="btn-refresh" class="primary">POST /refresh</button>
          <button id="btn-logout">GET /logout</button>
        </div>
      </section>

      <section class="panel">
        <h2>Custom request</h2>
        <div class="row">
          <select id="method">
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
          <input type="text" id="path" class="grow" placeholder="/frequencies" spellcheck="false" />
        </div>
        <label for="body">JSON body (optional)</label>
        <textarea id="body" rows="4" placeholder='{"name": "Weekly"}'></textarea>
        <div class="row">
          <button id="btn-send" class="primary">Send</button>
          <span class="hint">Requests run from this origin (<code>window.location.origin</code>).</span>
        </div>
      </section>

      <section class="panel">
        <h2>Response</h2>
        <div id="status" class="status hint">No request sent yet.</div>
        <pre id="output">Response body appears here.</pre>
      </section>
    </main>

    <script>
      var KEY = 'swimlane_devtools';

      function readParam(name) {
        return new URLSearchParams(window.location.search).get(name);
      }

      function restore() {
        var saved = {};
        try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
        var access = readParam('access_token') || saved.access || '';
        var refresh = readParam('refresh_token') || saved.refresh || '';
        var userRaw = readParam('user') || saved.user || '';
        if (userRaw && !readParam('user')) {
          try { userRaw = JSON.stringify(JSON.parse(userRaw), null, 2); } catch (e) {}
        } else if (userRaw) {
          try { userRaw = JSON.stringify(JSON.parse(userRaw), null, 2); } catch (e) {}
        }
        document.getElementById('access-token').value = access;
        document.getElementById('refresh-token').value = refresh;
        document.getElementById('user-info').value = userRaw;
        // Drop the tokens from the URL so they don't linger in history.
        if (readParam('access_token') || readParam('refresh_token') || readParam('user')) {
          history.replaceState({}, '', '/devtools');
        }
        persist();
      }

      function persist() {
        var data = {
          access: document.getElementById('access-token').value.trim(),
          refresh: document.getElementById('refresh-token').value.trim(),
          user: document.getElementById('user-info').value.trim()
        };
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
        document.getElementById('saved-hint').textContent = 'Saved to localStorage.';
        setTimeout(function () { document.getElementById('saved-hint').textContent = ''; }, 1200);
      }

      function showResult(status, text) {
        var statusEl = document.getElementById('status');
        statusEl.textContent = 'Status: ' + status;
        statusEl.className = 'status ' + (status >= 200 && status < 300 ? 'ok' : 'err');
        var pretty = text;
        try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) {}
        document.getElementById('output').textContent = pretty;
      }

      function callApi(method, path, body) {
        var token = document.getElementById('access-token').value.trim();
        var headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        var options = { method: method, headers: headers };
        if (body !== undefined) options.body = JSON.stringify(body);
        fetch(path, options)
          .then(function (res) { return res.text().then(function (t) { return { status: res.status, text: t }; }); })
          .then(function (r) { showResult(r.status, r.text); })
          .catch(function (err) {
            document.getElementById('status').textContent = 'Network error';
            document.getElementById('status').className = 'status err';
            document.getElementById('output').textContent = String(err);
          });
      }

      document.querySelectorAll('button[data-path]').forEach(function (btn) {
        btn.addEventListener('click', function () { callApi('GET', btn.getAttribute('data-path')); });
      });

      document.getElementById('btn-refresh').addEventListener('click', function () {
        var refresh = document.getElementById('refresh-token').value.trim();
        callApi('POST', '/refresh', { refresh_token: refresh });
      });

      document.getElementById('btn-logout').addEventListener('click', function () {
        callApi('GET', '/logout');
      });

      document.getElementById('btn-send').addEventListener('click', function () {
        var method = document.getElementById('method').value;
        var path = document.getElementById('path').value.trim() || '/';
        var bodyRaw = document.getElementById('body').value.trim();
        var body;
        if (bodyRaw) {
          try { body = JSON.parse(bodyRaw); } catch (e) {
            showResult(400, 'Body is not valid JSON: ' + String(e));
            return;
          }
        }
        callApi(method, path, body);
      });

      document.getElementById('copy-access').addEventListener('click', function () {
        var input = document.getElementById('access-token');
        input.select();
        try { navigator.clipboard.writeText(input.value); } catch (e) {}
      });

      document.getElementById('clear-tokens').addEventListener('click', function () {
        document.getElementById('access-token').value = '';
        document.getElementById('refresh-token').value = '';
        document.getElementById('user-info').value = '';
        localStorage.removeItem(KEY);
        document.getElementById('saved-hint').textContent = 'Tokens cleared.';
      });

      ['access-token', 'refresh-token', 'user-info'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', persist);
      });

      restore();
    </script>
  </body>
</html>
"""
