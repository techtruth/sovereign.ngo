(function () {
  if (window.SovereignDemoStoreConfig && typeof window.SovereignDemoStoreConfig === 'object') {
    return;
  }

  const currentLocation = window.location || null;
  const host = currentLocation ? String(currentLocation.host || '').toLowerCase() : '';
  const protocol = currentLocation ? String(currentLocation.protocol || '').toLowerCase() : '';
  const isContainerGatewayHost = host === 'localhost:8180' || host === '127.0.0.1:8180';
  const isHttpProtocol = protocol === 'http:' || protocol === 'https:';
  const useSolidPodBackend = isContainerGatewayHost && isHttpProtocol;

  const backend = useSolidPodBackend
    ? {
        mode: 'solid-pod',
        podBaseUrl: `${protocol}//${host}/`,
        resourcePath: '/sovereign/demo/state.json'
      }
    : {
        mode: 'local'
      };

  window.SovereignDemoStoreConfig = {
    backend
  };
})();
