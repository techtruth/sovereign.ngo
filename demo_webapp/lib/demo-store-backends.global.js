(function () {
  const parseJson = (raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const createLocalStorageBackend = (options) => {
    const config = options && typeof options === 'object' ? options : {};
    const storageKey = String(config.storageKey || 'sovereign_demo_state');
    const eventKey = String(config.eventKey || 'sovereign_demo_event');
    const channelName = String(config.channelName || 'sovereign_demo_channel');
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;

    const readState = () => {
      const sessionRaw = sessionStorage.getItem(storageKey);
      if (sessionRaw) {
        return parseJson(sessionRaw);
      }
      return null;
    };

    const writeState = (state) => {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    };

    const notify = (payload) => {
      if (channel) {
        try {
          channel.postMessage(payload);
        } catch {
          // no-op
        }
      }

      try {
        localStorage.setItem(eventKey, JSON.stringify(payload));
        localStorage.removeItem(eventKey);
      } catch {
        // no-op
      }
    };

    const subscribe = (listener) => {
      if (typeof listener !== 'function') {
        return function noop() {};
      }

      const onStorage = (event) => {
        if (event.key !== eventKey || !event.newValue) return;
        try {
          listener(JSON.parse(event.newValue));
        } catch {
          listener({ type: 'state-updated', reason: 'storage-event-parse-failed' });
        }
      };

      const onChannel = (event) => {
        listener(event && event.data ? event.data : { type: 'state-updated', reason: 'broadcast' });
      };

      window.addEventListener('storage', onStorage);
      if (channel) {
        channel.addEventListener('message', onChannel);
      }

      return function unsubscribe() {
        window.removeEventListener('storage', onStorage);
        if (channel) {
          channel.removeEventListener('message', onChannel);
        }
      };
    };

    return {
      mode: 'local',
      readState,
      writeState,
      notify,
      subscribe
    };
  };

  const createSolidPodBackend = (options) => {
    const config = options && typeof options === 'object' ? options : {};
    const localBackend = createLocalStorageBackend(config);
    const podBaseUrl = String(config.podBaseUrl || '').trim();
    const resourcePath = String(config.resourcePath || '/sovereign/demo/state.json').trim();
    const bearerToken = String(config.bearerToken || '').trim();
    const fetchInit = config.fetchInit && typeof config.fetchInit === 'object' ? config.fetchInit : {};

    if (!podBaseUrl) {
      throw new Error('Solid pod backend requires `podBaseUrl`.');
    }

    let remoteUrl = '';
    try {
      remoteUrl = new URL(resourcePath, podBaseUrl).toString();
    } catch {
      throw new Error('Invalid solid pod backend URL configuration.');
    }

    const buildHeaders = (extra) => {
      const headers = {
        ...(extra && typeof extra === 'object' ? extra : {})
      };
      if (bearerToken) {
        headers.Authorization = `Bearer ${bearerToken}`;
      }
      return headers;
    };

    let persistChain = Promise.resolve();

    const queueRemoteWrite = (state) => {
      const body = JSON.stringify(state);
      persistChain = persistChain
        .catch(() => null)
        .then(async () => {
          const response = await fetch(remoteUrl, {
            method: 'PUT',
            headers: buildHeaders({
              'content-type': 'application/json'
            }),
            body,
            ...fetchInit
          });
          if (!response.ok) {
            throw new Error(`Solid pod write failed (${response.status}).`);
          }
        })
        .catch((error) => {
          console.error('Sovereign solid backend write failed:', error);
        });
    };

    const initialize = async ({ parseState, onHydrated, onError } = {}) => {
      try {
        const response = await fetch(remoteUrl, {
          method: 'GET',
          headers: buildHeaders({
            accept: 'application/json'
          }),
          ...fetchInit
        });

        if (response.status === 404) return;
        if (!response.ok) {
          throw new Error(`Solid pod read failed (${response.status}).`);
        }

        const raw = await response.text();
        const parsedRaw = parseJson(raw);
        const parsedState = typeof parseState === 'function' ? parseState(parsedRaw) : parsedRaw;
        if (!parsedState) return;

        localBackend.writeState(parsedState);

        if (typeof onHydrated === 'function') {
          onHydrated(parsedState);
        }
      } catch (error) {
        if (typeof onError === 'function') {
          onError(error);
          return;
        }
        console.error('Sovereign solid backend init failed:', error);
      }
    };

    return {
      mode: 'solid-pod',
      remoteUrl,
      readState: () => localBackend.readState(),
      writeState: (state) => {
        localBackend.writeState(state);
        queueRemoteWrite(state);
      },
      notify: localBackend.notify,
      subscribe: localBackend.subscribe,
      initialize
    };
  };

  window.SovereignDemoStoreBackends = Object.freeze({
    createLocalStorageBackend,
    createSolidPodBackend
  });
})();
