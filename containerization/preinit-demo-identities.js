const fs = require('fs');
const crypto = require('crypto');

const configuredDemoWebId = String(process.env.DEMO_WEBID || 'http://localhost:8180/profile/card#me').trim();
const outputPath = String(process.env.DEMO_IDENTITIES_FILE || '/tmp/sovereign-demo-identities.json').trim() || '/tmp/sovereign-demo-identities.json';

const demoOrigin = (() => {
  try {
    return new URL(configuredDemoWebId).origin;
  } catch {
    return 'http://localhost:8180';
  }
})();

const parseNameList = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const stableBase36Fragment = (seed, length = 8) => {
  const digest = crypto.createHash('sha256').update(String(seed || '')).digest('hex');
  const value = BigInt(`0x${digest.slice(0, 16)}`);
  const token = value.toString(36).toUpperCase();
  return token.padStart(length, '0').slice(0, length);
};

const toWebId = (fragment) => `${demoOrigin}/profile/card#${fragment}`;

const residentNames = (() => {
  const fromEnv = parseNameList(process.env.DEMO_RESIDENT_IDENTITIES);
  if (fromEnv.length > 0) return fromEnv;
  return ['Alex Sovereign', 'Betty Medina', 'Charlie Krier', 'Debra Harbor', 'Ed Erins'];
})();

const residentIdentities = residentNames.map((name) => ({
  label: name,
  webId: toWebId(stableBase36Fragment(`${demoOrigin}:resident:${name}`))
}));

const stephenStafferWebId = toWebId(stableBase36Fragment(`${demoOrigin}:staff:Stephen Staffer`));
const stephenStafferIdentity = {
  label: 'Stephen Staffer',
  webId: stephenStafferWebId
};

const dedupeByWebId = (list) => {
  const out = [];
  const seen = new Set();
  for (const entry of list) {
    const webId = String(entry?.webId || '').trim();
    if (!webId || seen.has(webId)) continue;
    const label = String(entry?.label || '').trim() || webId;
    out.push({ label, webId });
    seen.add(webId);
  }
  return out;
};

const includeConfiguredDemoWebId = !configuredDemoWebId.endsWith('/profile/card#me');
const configuredEntry = includeConfiguredDemoWebId
  ? [{ label: 'Configured Identity', webId: configuredDemoWebId }]
  : [];

const identities = dedupeByWebId([
  ...configuredEntry,
  ...residentIdentities,
  stephenStafferIdentity
]);

const defaultDemoIdentityWebId = includeConfiguredDemoWebId
  ? configuredDemoWebId
  : (residentIdentities[0]?.webId || configuredDemoWebId);

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  demoWebId: configuredDemoWebId,
  demoOrigin,
  defaultDemoIdentityWebId,
  stephenStafferWebId,
  identities
};

const outputDir = outputPath.includes('/') ? outputPath.slice(0, outputPath.lastIndexOf('/')) : '.';
if (outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`[preinit] Seeded ${identities.length} demo identities to ${outputPath}`);
