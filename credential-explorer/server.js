const http = require('http');
const crypto = require('crypto');

const port = Number(process.env.PORT || 3000);
const sovereignInternalOrigin = String(process.env.SOVEREIGN_INTERNAL_ORIGIN || '').trim();
const demoWebId = String(process.env.DEMO_WEBID || '').trim();
const sovereignJweActiveKeyId = String(process.env.SOVEREIGN_JWE_ACTIVE_KEY_ID || 'sovereign-x25519-2026-01').trim();
const sovereignJwePrivateKeyPem = process.env.SOVEREIGN_JWE_PRIVATE_KEY_PEM || `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VuBCIEIBBsNwKs3mpfB3sxWsbpwLcCJvVFcoFt9s75bKLovoVA
-----END PRIVATE KEY-----`;
const sovereignJweRevokedKidSet = new Set(
  String(process.env.SOVEREIGN_JWE_REVOKED_KIDS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
);

if (!sovereignInternalOrigin) {
  throw new Error('SOVEREIGN_INTERNAL_ORIGIN is required');
}
if (!demoWebId) {
  throw new Error('DEMO_WEBID is required');
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const decodeBase64UrlJson = (value) => JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));

const decryptSovereignSealedEnvelope = (envelope) => {
  const protectedB64u = String(envelope?.protected || '').trim();
  const ivB64u = String(envelope?.iv || '').trim();
  const tagB64u = String(envelope?.tag || '').trim();
  const ciphertextB64u = String(envelope?.ciphertext || '').trim();
  if (!protectedB64u || !ivB64u || !tagB64u || !ciphertextB64u) {
    throw new Error('invalid envelope: missing protected, iv, ciphertext, or tag');
  }

  const header = decodeBase64UrlJson(protectedB64u);
  if (header.alg !== 'ECDH-ES' || header.enc !== 'A256GCM') {
    throw new Error('unsupported JWE algorithms');
  }
  const kid = String(header.kid || '').trim();
  if (!kid) throw new Error('missing key id');
  if (sovereignJweRevokedKidSet.has(kid)) throw new Error(`key id revoked: ${kid}`);
  if (kid !== sovereignJweActiveKeyId) throw new Error(`unknown key id: ${kid}`);
  if (!header.epk || typeof header.epk !== 'object') throw new Error('missing ephemeral public key');

  const sharedSecret = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey(sovereignJwePrivateKeyPem),
    publicKey: crypto.createPublicKey({ key: header.epk, format: 'jwk' })
  });
  const cek = crypto.hkdfSync(
    'sha256',
    sharedSecret,
    Buffer.alloc(0),
    Buffer.from(`jwe-cek:${kid}`, 'utf8'),
    32
  );
  const decipher = crypto.createDecipheriv('aes-256-gcm', cek, Buffer.from(ivB64u, 'base64url'));
  decipher.setAAD(Buffer.from(protectedB64u, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64u, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64u, 'base64url')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plaintext);
};

const credentialsContainerPath = '/credentials/';

const listCredentialResourceUrls = async () => {
  const containerUrl = `${sovereignInternalOrigin}${credentialsContainerPath}`;
  const response = await fetch(containerUrl, { headers: { Accept: 'text/turtle' } });
  if (response.status === 404) return { ok: true, containerUrl, resources: [] };
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      containerUrl,
      reason: `credentials container read failed (${response.status})`,
      status: response.status,
      body: text.slice(0, 400)
    };
  }

  const resources = [];
  const containsRegex = /ldp:contains\s+<([^>]+)>/g;
  let match;
  while ((match = containsRegex.exec(text))) {
    const resourceUrl = match[1];
    const normalized = resourceUrl.startsWith('http://') || resourceUrl.startsWith('https://')
      ? resourceUrl
      : new URL(resourceUrl, containerUrl).toString();
    if (normalized.endsWith('.json') && !resources.includes(normalized)) resources.push(normalized);
  }

  return { ok: true, containerUrl, resources };
};

const readCredentials = async () => {
  const listed = await listCredentialResourceUrls();
  if (!listed.ok) return listed;
  const credentials = [];
  for (const resourceUrl of listed.resources) {
    const response = await fetch(resourceUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) continue;
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') continue;
    const type = payload.type;
    if (Array.isArray(type) ? type.length === 0 : !type) continue;
    credentials.push({ resourceUrl, credential: payload });
  }
  return {
    ok: true,
    containerUrl: listed.containerUrl,
    exists: true,
    credentials,
    resources: listed.resources
  };
};

const readContainerListing = async (path) => {
  const target = `${sovereignInternalOrigin}${path}`;
  const response = await fetch(target, { headers: { Accept: 'text/turtle' } });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      path,
      status: response.status,
      reason: `listing failed with status ${response.status}`,
      sample: text.slice(0, 600)
    };
  }

  const links = [];
  const containsRegex = /ldp:contains\s+<([^>]+)>/g;
  let match;
  while ((match = containsRegex.exec(text))) {
    const href = match[1];
    const normalized = href.startsWith('http://') || href.startsWith('https://')
      ? href
      : new URL(href, target).toString();
    if (!links.includes(normalized)) links.push(normalized);
  }

  return { ok: true, path, links, rawSample: text.slice(0, 1200) };
};

const renderHomePage = () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Credential Explorer</title>
  <style>
    :root {
      --bg:#eef3f8;
      --panel:#ffffff;
      --line:#d5deea;
      --text:#18212f;
      --muted:#516074;
      --accent:#0e7490;
      --soft:#f2f8ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      background: radial-gradient(1200px 400px at 20% -10%, #d8efff, transparent), linear-gradient(180deg, #f7fbff, var(--bg));
      color: var(--text);
    }
    .wrap { max-width: 1100px; margin: 1rem auto; padding: 0 1rem 1rem; }
    .header {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 1rem;
      box-shadow: 0 12px 24px rgba(24,33,47,.08);
      margin-bottom: 12px;
    }
    h1 { margin: 0; font-size: 1.2rem; }
    .hint { color: var(--muted); font-size: .95rem; margin-top: .45rem; }
    .row { display: grid; grid-template-columns: 1.3fr .7fr; gap: 12px; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: .9rem;
      box-shadow: 0 10px 20px rgba(24,33,47,.06);
    }
    label { display:block; font-weight:700; margin-bottom:.35rem; }
    input {
      width: 100%;
      padding: .6rem .65rem;
      border-radius: 10px;
      border: 1px solid #c5d4e8;
      background: #fff;
      color: var(--text);
      font: inherit;
    }
    .btns { display: flex; gap: 8px; margin-top: 8px; }
    button {
      border: 0;
      border-radius: 10px;
      padding: .55rem .85rem;
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    button.secondary { background: #334155; }
    .meta {
      margin-top: 8px;
      background: var(--soft);
      border: 1px solid #d8e4f2;
      border-radius: 10px;
      padding: .65rem;
      color: #334155;
      font-size: .9rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: .9rem;
    }
    th, td {
      border-bottom: 1px solid #e5edf6;
      padding: .5rem;
      text-align: left;
      vertical-align: top;
    }
    th { color: #334155; background: #f8fbff; }
    pre {
      margin: 10px 0 0;
      background: #101827;
      color: #e5edf6;
      border-radius: 12px;
      padding: .75rem;
      max-height: 300px;
      overflow: auto;
      font-size: .82rem;
    }
    ul { margin: .5rem 0 0 1rem; }
    @media (max-width: 920px) {
      .row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="header">
      <h1>Personal Identity and Record Storage</h1>
      <p class="hint">Credential Explorer: browse your sovereign Solid pod credential files under <code>/credentials/</code>.</p>
    </section>

    <div class="row">
      <section class="panel">
        <label for="webId">WebID</label>
        <input id="webId" value="${escapeHtml(demoWebId)}" />
        <div class="btns">
          <button id="loadBtn">Load Credentials</button>
          <button id="listBtn" class="secondary">Browse Pod</button>
        </div>
        <div id="meta" class="meta">Ready.</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Issuer</th>
              <th>Issued</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </section>

      <section class="panel">
        <strong>Pod Resources</strong>
        <ul id="links"></ul>
        <pre id="out">{}</pre>
      </section>
    </div>
  </div>

  <script>
    const webIdEl = document.getElementById('webId');
    const rowsEl = document.getElementById('rows');
    const outEl = document.getElementById('out');
    const linksEl = document.getElementById('links');
    const metaEl = document.getElementById('meta');

    const setMeta = (text) => {
      metaEl.textContent = text;
    };

    const renderRows = (credentials) => {
      rowsEl.innerHTML = credentials.map((cred, idx) => {
        const types = Array.isArray(cred.type) ? cred.type.filter((t) => t !== 'VerifiableCredential').join(', ') : 'Unknown';
        const issuer = cred && cred.issuer ? (cred.issuer.name || cred.issuer.id || 'Unknown') : 'Unknown';
        const issued = cred && (cred.issuanceDate || cred.validFrom) ? (cred.issuanceDate || cred.validFrom) : 'Unknown';
        return '<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td>' + types + '</td>' +
          '<td>' + issuer + '</td>' +
          '<td>' + issued + '</td>' +
          '</tr>';
      }).join('');
    };

    const loadCredentials = async () => {
      const webId = webIdEl.value.trim();
      if (!webId) {
        setMeta('WebID is required.');
        return;
      }
      const res = await fetch('/api/credentials?webId=' + encodeURIComponent(webId));
      const data = await res.json();
      outEl.textContent = JSON.stringify(data, null, 2);
      if (!res.ok || !data.ok) {
        setMeta('Unable to load credentials.');
        rowsEl.innerHTML = '';
        return;
      }
      renderRows(data.credentials || []);
      setMeta('Loaded ' + (data.credentials || []).length + ' credential files from /credentials/.');
    };

    const browsePod = async () => {
      const res = await fetch('/api/browse');
      const data = await res.json();
      outEl.textContent = JSON.stringify(data, null, 2);
      linksEl.innerHTML = '';
      if (!res.ok || !data.ok) {
        setMeta('Unable to browse pod resources.');
        return;
      }
      const links = data.links || [];
      links.forEach((href) => {
        const li = document.createElement('li');
        li.textContent = href;
        linksEl.appendChild(li);
      });
      setMeta('Found ' + links.length + ' visible pod resources.');
    };

    document.getElementById('loadBtn').addEventListener('click', () => loadCredentials().catch((e) => {
      outEl.textContent = JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }, null, 2);
      setMeta('Load failed.');
    }));
    document.getElementById('listBtn').addEventListener('click', () => browsePod().catch((e) => {
      outEl.textContent = JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }, null, 2);
      setMeta('Browse failed.');
    }));

    loadCredentials();
    browsePod();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderHomePage());
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      json(res, 200, {
        ok: true,
        service: 'credential-explorer',
        sovereignInternalOrigin,
        demoWebId,
        jwe: {
          activeKid: sovereignJweActiveKeyId,
          revokedKids: [...sovereignJweRevokedKidSet]
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/jwe-key-status') {
      json(res, 200, {
        ok: true,
        activeKid: sovereignJweActiveKeyId,
        revokedKids: [...sovereignJweRevokedKidSet]
      });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/credentials')) {
      const url = new URL(req.url, `http://localhost:${port}`);
      const webId = String(url.searchParams.get('webId') || '').trim();
      if (!webId) {
        json(res, 400, { ok: false, error: 'webId is required' });
        return;
      }

      const credentialsRead = await readCredentials();
      if (!credentialsRead.ok) {
        json(res, 502, credentialsRead);
        return;
      }
      const credentials = credentialsRead.credentials.map((entry) => entry.credential);

      json(res, 200, {
        ok: true,
        webId,
        walletUrl: credentialsRead.containerUrl,
        exists: credentialsRead.exists,
        credentialCount: credentials.length,
        credentials,
        resources: credentialsRead.credentials.map((entry) => entry.resourceUrl)
      });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/browse')) {
      const url = new URL(req.url, `http://localhost:${port}`);
      const webId = String(url.searchParams.get('webId') || demoWebId).trim();
      const rootListing = await readContainerListing('/');
      const credentialsListing = await readContainerListing('/credentials/');
      const credentialsRead = await readCredentials();

      if (!rootListing.ok && !credentialsListing.ok && !credentialsRead.ok) {
        json(res, 502, { ok: false, error: 'failed to browse pod', rootListing, credentialsListing, credentialsRead });
        return;
      }

      const links = [];
      if (rootListing.ok) links.push(...rootListing.links);
      if (credentialsListing.ok) links.push(...credentialsListing.links);
      if (credentialsRead.ok) links.push(...credentialsRead.resources);

      const uniqueLinks = [...new Set(links)].sort();
      json(res, 200, {
        ok: true,
        webId,
        links: uniqueLinks,
        rootListing,
        credentialsListing,
        credentialResources: {
          ok: credentialsRead.ok,
          containerUrl: credentialsRead.containerUrl,
          credentialCount: credentialsRead.credentials ? credentialsRead.credentials.length : 0
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/decrypt-shared-envelope') {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const webId = String(body.webId || '').trim();
      const envelope = body.envelope;
      if (!webId) {
        json(res, 400, { ok: false, error: 'webId is required' });
        return;
      }
      if (webId !== demoWebId) {
        json(res, 403, { ok: false, error: 'only sovereign webid may decrypt shared envelopes' });
        return;
      }
      if (!envelope || typeof envelope !== 'object') {
        json(res, 400, { ok: false, error: 'envelope object is required' });
        return;
      }

      const payload = decryptSovereignSealedEnvelope(envelope);
      json(res, 200, {
        ok: true,
        webId,
        decrypted: payload,
        context: envelope.context || null
      });
      return;
    }

    json(res, 404, { ok: false, error: 'not found' });
  } catch (error) {
    json(res, 500, { ok: false, error: String(error && error.message ? error.message : error) });
  }
});

server.listen(port, () => {
  console.log(`Credential Explorer listening on ${port} (sovereign origin ${sovereignInternalOrigin})`);
});
