(function () {
const highlightStyleKeys = [
  'outline',
  'outline-offset',
  'box-shadow',
  'border-color',
  'border-width',
  'border-style',
  'background',
  'color',
  'font-weight',
  'transform',
  'filter'
];
const TUTORIAL_CHANNEL = 'sovereign_tutorial';

const resolveParentTargetOrigin = () => {
  const referrer = String((typeof document !== 'undefined' && document.referrer) || '').trim();
  if (!referrer) return '*';
  try {
    const parsed = new URL(referrer, window.location.href);
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol === 'http:' || protocol === 'https:') return parsed.origin;
  } catch {
    // ignore parse errors and fall back to wildcard for local file mode
  }
  return '*';
};

const clearTutorialInlineStyle = (el) => {
  if (!el || !el.style) return;
  highlightStyleKeys.forEach((key) => {
    el.style.removeProperty(key);
  });
};

const applyTutorialInlineStyle = (el) => {
  if (!el || !el.style) return;
  el.style.setProperty('outline', '5px solid #ffd22d', 'important');
  el.style.setProperty('outline-offset', '2px', 'important');
  el.style.setProperty('box-shadow', '0 0 0 4px rgba(255, 210, 45, 0.35), 0 0 24px rgba(255, 210, 45, 0.74)', 'important');
  el.style.setProperty('filter', 'saturate(1.18)', 'important');
};
const createTutorialBridge = (options) => {
  const config = options && typeof options === 'object' ? options : {};
  const byId = typeof config.byId === 'function' ? config.byId : null;
  const highlightIds = Array.isArray(config.highlightIds) ? config.highlightIds : [];
  const onClearControl = typeof config.onClearControl === 'function' ? config.onClearControl : null;
  const onApplyControl = typeof config.onApplyControl === 'function' ? config.onApplyControl : null;
  const statePayload = typeof config.statePayload === 'function' ? config.statePayload : null;
  const parentTargetOrigin = resolveParentTargetOrigin();

  const clearHighlight = () => {
    if (!byId) return;
    highlightIds.forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.classList.remove('tutorial-next-click');
      clearTutorialInlineStyle(el);
      if (onClearControl) onClearControl(id, el);
    });
  };

  const applyHighlight = (controlId, details) => {
    if (!byId) return false;
    const id = String(controlId || '').trim();
    clearHighlight();
    if (!id) return false;

    const target = byId(id);
    if (!target) return false;
    target.classList.add('tutorial-next-click');

    const handled = onApplyControl ? Boolean(onApplyControl(id, target, details || {})) : false;
    if (!handled) {
      applyTutorialInlineStyle(target);
    }
    return true;
  };

  const postState = () => {
    if (!statePayload) return;
    if (!window.parent || window.parent === window) return;
    let payload = null;
    try {
      payload = statePayload();
    } catch {
      payload = null;
    }
    if (!payload || typeof payload !== 'object') return;

    try {
      window.parent.postMessage({ channel: TUTORIAL_CHANNEL, ...payload }, parentTargetOrigin);
    } catch {
      // no-op
    }
  };

  const onMessage = (event) => {
    if (!event) return;
    if (event.source !== window.parent) return;
    const data = event && event.data ? event.data : null;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    if (data.channel !== TUTORIAL_CHANNEL) return;
    if (data.type !== 'clear-highlight' && data.type !== 'highlight-control') return;
    if (data.type === 'clear-highlight') {
      clearHighlight();
      return;
    }
    if (data.type === 'highlight-control') {
      applyHighlight(data.controlId, data);
    }
  };

  window.addEventListener('message', onMessage);

  return {
    clearHighlight,
    applyHighlight,
    postState,
    dispose: () => {
      window.removeEventListener('message', onMessage);
    }
  };
};

window.SovereignTutorialBridge = { TUTORIAL_CHANNEL, createTutorialBridge };
})();
