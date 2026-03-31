const http = require('http');

const port = Number(process.env.PORT || 4000);
const podName = process.env.POD_NAME || 'holder-pod';
const businessName = process.env.BUSINESS_NAME || 'business';
const configuredWebId = process.env.SOVEREIGN_WEBID || 'https://sovereign.example/profile/card#me';
const configuredWalletApi = process.env.SOVEREIGN_WALLET_API || `http://holder_sovereign:${port}/wallet/credentials`;
const demoOrigin = (() => {
  try {
    return new URL(configuredWebId).origin;
  } catch {
    return 'http://localhost:8180';
  }
})();
const defaultDemoIdentityWebId = configuredWebId.endsWith('/profile/card#me')
  ? `${demoOrigin}/profile/card#8N4Q7Z2K`
  : configuredWebId;
const stephenStafferWebId = `${demoOrigin}/profile/card#S7T4F9R2`;
const demoIdentityOptions = [
  { label: 'Alex Sovereign', webId: `${demoOrigin}/profile/card#8N4Q7Z2K` },
  { label: 'Betty Medina', webId: `${demoOrigin}/profile/card#3H9X5M1R` },
  { label: 'Charlie Krier', webId: `${demoOrigin}/profile/card#W2C8J6P4` },
  { label: 'Debra Harbor', webId: `${demoOrigin}/profile/card#7T1B9LQ5` },
  { label: 'Ed Erins', webId: `${demoOrigin}/profile/card#K4D3R8X2` },
  { label: 'Stephen Staffer', webId: stephenStafferWebId }
];
if (!demoIdentityOptions.some((entry) => entry.webId === defaultDemoIdentityWebId)) {
  demoIdentityOptions.unshift({ label: 'Default Demo Identity', webId: defaultDemoIdentityWebId });
}

const credentialsByWebId = new Map();

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const ensureCredentialList = (webId) => {
  const existing = credentialsByWebId.get(webId);
  if (existing) return existing;
  const empty = [];
  credentialsByWebId.set(webId, empty);
  return empty;
};

const hasRequiredFlags = (credential, requiredFlags) => {
  if (!requiredFlags || requiredFlags.length === 0) return true;
  const flags = credential?.credentialSubject?.stateIdFlags || {};
  return requiredFlags.every((flag) => Boolean(flags[flag]));
};

const findCredential = (credentials, credentialType, requiredFlags) =>
  credentials.find((cred) => {
    const types = Array.isArray(cred?.type) ? cred.type : [];
    return types.includes(credentialType) && hasRequiredFlags(cred, requiredFlags);
  });

const renderHomePage = () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Identity and Record Storage</title>
  <style>
    :root {
      --bg: #f7f7f8;
      --panel: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --primary: #0f766e;
      --line: #e5e7eb;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; background: linear-gradient(180deg, #eef6f5, var(--bg)); color: var(--text); }
    .wrap { max-width: 920px; margin: 1.5rem auto; padding: 0 1rem; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 1rem; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.06); margin-bottom: 12px; }
    h1, h2 { margin-top: 0; }
    p { color: var(--muted); }
    label { display: block; margin: 8px 0 4px; font-weight: 600; }
    input, select, button { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #d1d5db; font: inherit; }
    button { background: var(--primary); color: #fff; border: 0; cursor: pointer; font-weight: 700; margin-top: 10px; }
    button:hover { filter: brightness(1.05); }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #f8fafc; }
    pre { background: #111827; color: #f9fafb; padding: 12px; border-radius: 10px; overflow: auto; min-height: 180px; margin-top: 10px; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-all; }
    .hint { font-size: 13px; color: var(--muted); }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="panel">
      <h1>Identity and Record Storage</h1>
      <p>Pod: <strong>${escapeHtml(podName)}</strong> | Business context: <strong>${escapeHtml(businessName)}</strong></p>
      <p>This page browses records currently stored in this pod.</p>
    </section>

    <section class="panel">
      <h2>Pod Browser</h2>
      <label for="identityPreset">Sovereign Identity</label>
      <select id="identityPreset" name="identityPreset">
        ${demoIdentityOptions.map((entry) => `<option value="${escapeHtml(entry.webId)}"${entry.webId === defaultDemoIdentityWebId ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`).join('')}
        <option value="__custom__">Custom WebID</option>
      </select>
      <label for="webId">WebID</label>
      <input id="webId" name="webId" value="${escapeHtml(defaultDemoIdentityWebId)}" />
      <button id="refreshWallet" type="button">Browse Records</button>
      <p class="hint">Showing credential records stored for the selected WebID.</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Credential Type</th>
            <th>Issuer</th>
            <th>Issued At</th>
          </tr>
        </thead>
        <tbody id="recordsTable"></tbody>
      </table>
      <pre id="walletOut">{}</pre>
    </section>
  </div>

  <script>
    const walletOutEl = document.getElementById("walletOut");
    const recordsTableEl = document.getElementById("recordsTable");
    const webIdEl = document.getElementById("webId");
    const identityPresetEl = document.getElementById("identityPreset");
    const customIdentityPresetValue = "__custom__";
    const namedIdentityPresets = ${JSON.stringify(demoIdentityOptions)};
    const identityPresetByWebId = new Map(namedIdentityPresets.map((entry) => [String(entry.webId || "").trim(), entry]));

    const syncIdentityPresetFromWebId = () => {
      const currentWebId = webIdEl.value.trim();
      if (!currentWebId) {
        identityPresetEl.value = customIdentityPresetValue;
        return;
      }
      identityPresetEl.value = identityPresetByWebId.has(currentWebId) ? currentWebId : customIdentityPresetValue;
    };

    const applyIdentityPresetToWebId = () => {
      const selectedWebId = String(identityPresetEl.value || "").trim();
      if (!selectedWebId || selectedWebId === customIdentityPresetValue) return;
      webIdEl.value = selectedWebId;
      syncIdentityPresetFromWebId();
    };

    const refreshWallet = async () => {
      const webId = webIdEl.value.trim();
      if (!webId) {
        walletOutEl.textContent = JSON.stringify({ ok: false, error: "webId required" }, null, 2);
        recordsTableEl.innerHTML = "";
        return;
      }

      const res = await fetch("/wallet/credentials?webId=" + encodeURIComponent(webId));
      const data = await res.json();
      walletOutEl.textContent = JSON.stringify(data, null, 2);

      if (!res.ok || !Array.isArray(data.credentials)) {
        recordsTableEl.innerHTML = "";
        return;
      }

      recordsTableEl.innerHTML = data.credentials.map((cred, index) => {
        const types = Array.isArray(cred.type) ? cred.type.filter((t) => t !== "VerifiableCredential").join(", ") : "Unknown";
        const issuer = cred && cred.issuer ? (cred.issuer.name || cred.issuer.id || "Unknown") : "Unknown";
        const issued = cred && cred.issuanceDate ? cred.issuanceDate : "Unknown";
        return "<tr>" +
          "<td>" + (index + 1) + "</td>" +
          "<td>" + types + "</td>" +
          "<td>" + issuer + "</td>" +
          "<td>" + issued + "</td>" +
          "</tr>";
      }).join("");
    };

    document.getElementById("refreshWallet").addEventListener("click", async () => {
      try {
        await refreshWallet();
      } catch (error) {
        walletOutEl.textContent = JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }, null, 2);
        recordsTableEl.innerHTML = "";
      }
    });

    identityPresetEl.addEventListener("change", applyIdentityPresetToWebId);
    webIdEl.addEventListener("input", syncIdentityPresetFromWebId);
    webIdEl.addEventListener("blur", syncIdentityPresetFromWebId);
    syncIdentityPresetFromWebId();
    refreshWallet();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderHomePage());
    return;
  }

  if (req.url === '/health') {
    json(res, 200, { ok: true, podName, businessName });
    return;
  }

  if (req.url === '/profile') {
    json(res, 200, {
      podType: 'holder',
      podName,
      businessName,
      defaultWebId: configuredWebId,
      walletApi: configuredWalletApi,
      did: `did:example:${podName}`,
      vault: `vault://${podName}/credentials`
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/profile/card') {
    json(res, 200, {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: configuredWebId,
      type: 'Person',
      podName,
      walletApi: configuredWalletApi
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/wallet/credentials')) {
    const url = new URL(req.url, `http://localhost:${port}`);
    const webId = (url.searchParams.get('webId') || '').trim();
    if (!webId) {
      json(res, 400, { ok: false, error: 'webId query param is required' });
      return;
    }

    const credentials = ensureCredentialList(webId);
    json(res, 200, { ok: true, webId, count: credentials.length, credentials });
    return;
  }

  if (req.method === 'POST' && req.url === '/wallet/credentials') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const webId = String(body.webId || '').trim();
      const credential = body.credential;

      if (!webId) {
        json(res, 400, { ok: false, error: 'webId is required' });
        return;
      }

      if (!credential || typeof credential !== 'object') {
        json(res, 400, { ok: false, error: 'credential object is required' });
        return;
      }

      const list = ensureCredentialList(webId);
      list.push(credential);
      json(res, 200, { ok: true, webId, stored: true, count: list.length });
    } catch (err) {
      json(res, 400, { ok: false, error: 'invalid request body', detail: err.message });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/auth/verify-webid') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const webId = String(body.webId || '').trim();
      const credentialType = String(body.requiredCredentialType || 'DriversLicenseCredential').trim();
      const requiredFlags = Array.isArray(body.requiredFlags) ? body.requiredFlags : ['isOver18'];

      if (!webId) {
        json(res, 400, { ok: false, authorized: false, error: 'webId is required' });
        return;
      }

      const credentials = ensureCredentialList(webId);
      const matched = findCredential(credentials, credentialType, requiredFlags);

      if (!matched) {
        json(res, 403, {
          ok: false,
          authorized: false,
          webId,
          reason: `Missing ${credentialType} with required flags ${requiredFlags.join(', ')}`
        });
        return;
      }

      json(res, 200, {
        ok: true,
        authorized: true,
        webId,
        matchedCredentialType: credentialType,
        stateIdFlags: matched?.credentialSubject?.stateIdFlags || {},
        credentialSubject: matched?.credentialSubject || {}
      });
    } catch (err) {
      json(res, 400, { ok: false, authorized: false, error: 'invalid request body', detail: err.message });
    }
    return;
  }

  json(res, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => {
  console.log(`Holder pod '${podName}' for '${businessName}' listening on ${port}`);
});
