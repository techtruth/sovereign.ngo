// Optional demo-store backend configuration.
// Load this BEFORE demo-store.js (and before any page that consumes SovereignDemoStore).
//
// Example 1: explicit local browser-state mode
// window.SovereignDemoStoreConfig = {
//   backend: {
//     mode: 'local'
//   }
// };
//
// Example 2: Solid Pod-backed mode with local browser cache + remote sync
// window.SovereignDemoStoreConfig = {
//   backend: {
//     mode: 'solid-pod',
//     podBaseUrl: 'https://localhost:8180/',
//     resourcePath: '/sovereign/demo/state.json',
//     // bearerToken: 'optional-token',
//     // fetchInit: { credentials: 'include' }
//   }
// };
