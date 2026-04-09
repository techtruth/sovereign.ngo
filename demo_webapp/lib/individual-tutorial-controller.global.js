(function () {
const createIndividualTutorialController = (config) => {
  const options = config && typeof config === 'object' ? config : {};
  const tutorialChains = Array.isArray(options.tutorialChains) ? options.tutorialChains : [];
  const tutorialCompletionNarrativeById = options.tutorialCompletionNarrativeById && typeof options.tutorialCompletionNarrativeById === 'object'
    ? options.tutorialCompletionNarrativeById
    : {};
  const TUTORIAL_CHANNEL = typeof options.tutorialChannel === 'string'
    ? options.tutorialChannel
    : 'sovereign_tutorial';
  const endpointDirectory = options.endpointDirectory && typeof options.endpointDirectory === 'object'
    ? options.endpointDirectory
    : {};
  const frameRegistry = Array.isArray(options.frameRegistry) ? options.frameRegistry : [];
  const demoStore = options.demoStore || null;
  const applyFrameSource = typeof options.applyFrameSource === 'function'
    ? options.applyFrameSource
    : () => {};

let activeTutorialId = '';
let activeTutorialStepIndex = 0;
let activeTutorialTargetCard = null;
let activeTutorialInstruction = '';
let activeTutorialComplete = false;
let activeTutorialSubjectWebId = '';
let tutorialSeenEventIds = new Set();
const tutorialChannel = TUTORIAL_CHANNEL;
const providerPortalState = new Map();
let guidanceRefreshQueued = false;
let tutorialCompletionShownFor = '';

const queueGuidanceRefresh = (options) => {
  if (guidanceRefreshQueued) return;
  guidanceRefreshQueued = true;
  const opts = options || {};
  const run = () => {
    guidanceRefreshQueued = false;
    if (!activeTutorialId) return;
    const currentStep = getActiveTutorialStep();
    if (!currentStep) return;
    focusTutorialStep(currentStep, {
      scroll: opts.scroll === true,
      forceReload: Boolean(opts.forceReload)
    });
    renderWalkthroughPanel();
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(run);
    return;
  }
  setTimeout(run, 0);
};

const getFrameMessageTargetOrigin = (record) => {
  if (!record || !record.frame) return '*';
  const raw = String(
    (record.frame.dataset && record.frame.dataset.activeSrc)
    || record.frame.getAttribute('src')
    || ''
  ).trim();
  if (!raw || raw === 'about:blank') return '*';
  try {
    const parsed = new URL(raw, window.location.href);
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol === 'http:' || protocol === 'https:') return parsed.origin;
  } catch {
    // keep wildcard for local file mode or unparseable URLs
  }
  return '*';
};

const getEndpointUrl = (endpointKey) => {
  const entry = endpointDirectory[endpointKey];
  return entry ? String(entry.url || '').trim() : '';
};

const buildTutorialReloadUrl = (rawUrl) => {
  const base = String(rawUrl || '').trim();
  if (!base || base === 'about:blank') return base || 'about:blank';
  const divider = base.includes('?') ? '&' : '?';
  return `${base}${divider}tutorial_reload=${Date.now()}`;
};

const getTutorialById = (tutorialId) => tutorialChains.find((entry) => entry.id === tutorialId) || null;

const closeTutorialCompletionModal = () => {
  const modal = document.getElementById('tutorialCompletionModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('tutorial-modal-open');
};

const resetTutorialStatus = () => {
  activeTutorialId = '';
  activeTutorialStepIndex = 0;
  activeTutorialComplete = false;
  activeTutorialInstruction = '';
  activeTutorialSubjectWebId = '';
  tutorialCompletionShownFor = '';
  clearTutorialButtonHighlights();
  clearTutorialTarget();
  renderWalkthroughButtons();
  renderWalkthroughPanel();
};

const dismissTutorialCompletionAndReset = () => {
  closeTutorialCompletionModal();
  resetTutorialStatus();
};

const openTutorialCompletionModal = (tutorial) => {
  if (!tutorial || !tutorial.id) return;
  if (tutorialCompletionShownFor === tutorial.id) return;
  tutorialCompletionShownFor = tutorial.id;

  const modal = document.getElementById('tutorialCompletionModal');
  const titleEl = document.getElementById('tutorialCompletionTitle');
  const summaryEl = document.getElementById('tutorialCompletionSummary');
  const benefitsEl = document.getElementById('tutorialCompletionBenefits');
  const closeBtn = document.getElementById('tutorialCompletionCloseBtn');
  if (!modal || !titleEl || !summaryEl || !benefitsEl) return;

  const chainTitle = String(tutorial.title || 'this tutorial chain').trim();
  const summary = tutorialCompletionNarrativeById[tutorial.id]
    || `You completed the ${chainTitle} flow from start to finish across multiple organizations.`;
  const benefits = [
    'The handoff worked without one giant shared database.',
    'Each organization stayed responsible for its own records while still coordinating.',
    'Sharing happened through explicit steps that can be reviewed and audited.',
    'The person gets what they need with fewer delays and less back-and-forth.'
  ];

  titleEl.textContent = `You have just done ${chainTitle}!`;
  summaryEl.textContent = summary;
  benefitsEl.innerHTML = '';
  benefits.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = entry;
    benefitsEl.appendChild(li);
  });

  modal.hidden = false;
  document.body.classList.add('tutorial-modal-open');
  if (closeBtn) closeBtn.focus();
};

const getStepProviderId = (step) => {
  if (!step || typeof step !== 'object') return '';
  const expected = step.expectedEvent && typeof step.expectedEvent === 'object' ? step.expectedEvent : null;
  if (expected && expected.providerId) return String(expected.providerId);
  return '';
};

const postTutorialFrameCommand = (record, payload) => {
  if (!record || !record.frame || !record.frame.contentWindow || !payload || typeof payload !== 'object') return;
  try {
    const targetOrigin = getFrameMessageTargetOrigin(record);
    record.frame.contentWindow.postMessage({ channel: tutorialChannel, ...payload }, targetOrigin);
  } catch {
    // no-op
  }
};

const clearTutorialTarget = () => {
  if (activeTutorialTargetCard) {
    activeTutorialTargetCard.classList.remove('tutorial-target');
  }
  activeTutorialTargetCard = null;
};

const openTutorialHierarchy = (step) => {
  if (!step || typeof step !== 'object') return;

  if (step.groupId) {
    const groupEl = document.querySelector(`details.service-group[data-group-id="${step.groupId}"]`);
    if (groupEl) groupEl.open = true;
  }

  if (step.subsectorId) {
    const subsectorEl = document.querySelector(`details.subsector-group[data-subsector-id="${step.subsectorId}"]`);
    if (subsectorEl) subsectorEl.open = true;
  }
};

const resolveTutorialRecord = (step) => {
  if (!step || typeof step !== 'object') return null;

  if (step.serviceId) {
    const byService = frameRegistry.find((entry) => entry.id === step.serviceId);
    if (byService) return byService;
  }

  if (step.endpointKey) {
    const targetUrl = getEndpointUrl(step.endpointKey);
    if (targetUrl) {
      const byEndpoint = frameRegistry.find((entry) => {
        const options = Array.isArray(entry.endpointOptions) ? entry.endpointOptions : [];
        return options.some((option) => String(option.url || '').trim() === targetUrl);
      });
      if (byEndpoint) return byEndpoint;
    }
  }

  return null;
};

const getActiveTutorialStep = () => {
  const tutorial = getTutorialById(activeTutorialId);
  if (!tutorial || !Array.isArray(tutorial.steps) || tutorial.steps.length === 0) return null;
  const safeIndex = Math.min(Math.max(activeTutorialStepIndex, 0), tutorial.steps.length - 1);
  return tutorial.steps[safeIndex] || null;
};

const getFrameDocument = (record) => {
  if (!record || !record.frame) return null;
  try {
    return record.frame.contentDocument || null;
  } catch {
    return null;
  }
};

const ensureTutorialFrameStyles = (doc) => {
  if (!doc || !doc.head || doc.getElementById('tutorialFrameHighlightStyles')) return;
  const style = doc.createElement('style');
  style.id = 'tutorialFrameHighlightStyles';
  style.textContent = `
    @keyframes tutorialPulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 210, 45, 0.62); }
      70% { box-shadow: 0 0 0 12px rgba(255, 210, 45, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 210, 45, 0); }
    }
    .tutorial-click-target {
      position: relative !important;
      z-index: 2 !important;
      outline: 5px solid #ffd22d !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(255, 210, 45, 0.35), 0 0 22px rgba(255, 210, 45, 0.74) !important;
      animation: tutorialPulse 1.15s ease-in-out infinite !important;
    }
  `;
  doc.head.appendChild(style);
};

const clearTutorialButtonHighlights = () => {
  frameRegistry.forEach((entry) => {
    postTutorialFrameCommand(entry, { type: 'clear-highlight' });
    const doc = getFrameDocument(entry);
    if (!doc) return;
    doc.querySelectorAll('.tutorial-click-target').forEach((el) => {
      el.classList.remove('tutorial-click-target');
      el.removeAttribute('data-tutorial-glow');
      if (el.style) {
        el.style.removeProperty('outline');
        el.style.removeProperty('outline-offset');
        el.style.removeProperty('box-shadow');
        el.style.removeProperty('border-color');
        el.style.removeProperty('border-width');
        el.style.removeProperty('border-style');
        el.style.removeProperty('background');
        el.style.removeProperty('color');
        el.style.removeProperty('font-weight');
        el.style.removeProperty('transform');
        el.style.removeProperty('filter');
      }
    });
  });
};

const applyDirectTutorialGlow = (controlEl) => {
  if (!controlEl || !controlEl.style) return;
  controlEl.setAttribute('data-tutorial-glow', '1');
  controlEl.style.setProperty('outline', '5px solid #ffd22d', 'important');
  controlEl.style.setProperty('outline-offset', '2px', 'important');
  controlEl.style.setProperty('box-shadow', '0 0 0 4px rgba(255, 210, 45, 0.35), 0 0 24px rgba(255, 210, 45, 0.74)', 'important');
  controlEl.style.setProperty('filter', 'saturate(1.18)', 'important');
};

const highlightTutorialButtons = (record, buttonIds, details) => {
  const ids = Array.isArray(buttonIds) ? buttonIds.filter(Boolean) : [];
  const primaryId = ids[0];
  if (primaryId) {
    postTutorialFrameCommand(record, { type: 'highlight-control', controlId: primaryId, ...(details || {}) });
  }

  const doc = getFrameDocument(record);
  if (!doc) return primaryId ? 1 : 0;
  ensureTutorialFrameStyles(doc);
  let highlightedCount = 0;
  ids.forEach((buttonId) => {
    const button = doc.getElementById(buttonId);
    if (!button) return;
    if (button.hidden || button.getAttribute('hidden') !== null) return;
    button.classList.add('tutorial-click-target');
    applyDirectTutorialGlow(button);
    highlightedCount += 1;
  });
  return highlightedCount;
};

const getSelectOptionLabelByValue = (doc, selectId, optionValue) => {
  if (!doc || !selectId || !optionValue) return '';
  const select = doc.getElementById(selectId);
  if (!select) return '';
  const match = Array.from(select.options || []).find((option) => String(option.value || '') === String(optionValue));
  return match ? String(match.textContent || '').trim() : '';
};

const getFirstOpenSelectOption = (doc, selectId) => {
  if (!doc || !selectId) return null;
  const select = doc.getElementById(selectId);
  if (!select) return null;
  const match = Array.from(select.options || []).find((option) => option.value && !option.disabled);
  if (!match) return null;
  return {
    value: String(match.value || ''),
    label: String(match.textContent || '').trim()
  };
};

const canClickControl = (controlEl) => {
  if (!controlEl) return false;
  if (controlEl.disabled) return false;
  if (controlEl.hidden || controlEl.getAttribute('hidden') !== null) return false;
  return true;
};

const buildIdentityAlignmentGuidance = (record, doc, runtimeState, isLoggedIn) => {
  const expectedSubjectWebId = String(activeTutorialSubjectWebId || '').trim();
  if (!expectedSubjectWebId) return '';

  const selectedIdentityWebId = String(
    (doc && doc.getElementById('identitySelect') && doc.getElementById('identitySelect').value)
    || (runtimeState && runtimeState.selectedIdentityWebId)
    || ''
  ).trim();
  if (selectedIdentityWebId !== expectedSubjectWebId) {
    const optionLabel = getSelectOptionLabelByValue(doc, 'identitySelect', expectedSubjectWebId);
    highlightTutorialButtons(record, ['identitySelect'], {
      expectedValue: expectedSubjectWebId,
      expectedLabel: optionLabel
    });
    return optionLabel
      ? `Choose Sovereign Identity: ${optionLabel}.`
      : 'Choose the same identity used in the previous tutorial step.';
  }

  const loggedInSubjectWebId = String((runtimeState && runtimeState.currentSubjectWebId) || '').trim();
  if (isLoggedIn && loggedInSubjectWebId && loggedInSubjectWebId !== expectedSubjectWebId) {
    highlightTutorialButtons(record, ['loginBtn']);
    return 'This card is logged into a different identity. Click LOGIN to switch to the selected tutorial identity.';
  }

  return '';
};

const sameProviderRuntimeState = (a, b) => {
  if (!a || !b) return false;
  return (
    Boolean(a.isLoggedIn) === Boolean(b.isLoggedIn)
    && Boolean(a.hasOpenReferral) === Boolean(b.hasOpenReferral)
    && String(a.currentSubjectWebId || '') === String(b.currentSubjectWebId || '')
    && String(a.selectedIdentityWebId || '') === String(b.selectedIdentityWebId || '')
    && String(a.selectedStaffActionId || '') === String(b.selectedStaffActionId || '')
    && String(a.selectedSelfActionId || '') === String(b.selectedSelfActionId || '')
    && String(a.selectedReferralId || '') === String(b.selectedReferralId || '')
    && Boolean(a.selectedReferralOpen) === Boolean(b.selectedReferralOpen)
    && Boolean(a.consentToStore) === Boolean(b.consentToStore)
    && Boolean(a.canVerify) === Boolean(b.canVerify)
  );
};

const updateTutorialActionGuidance = (step, record) => {
  if (!step || !record || !step.action || typeof step.action !== 'object') return '';

  const doc = getFrameDocument(record);
  const stepProviderId = getStepProviderId(step);
  const runtimeState = stepProviderId ? providerPortalState.get(stepProviderId) : null;

  const controlValue = (id, stateKey) => {
    const fromDoc = doc && doc.getElementById(id);
    if (fromDoc && typeof fromDoc.value === 'string') return String(fromDoc.value);
    const fromState = runtimeState && typeof runtimeState[stateKey] === 'string' ? runtimeState[stateKey] : '';
    return String(fromState || '');
  };

  if (step.action.kind === 'staff') {
    const isLoggedIn = runtimeState
      ? Boolean(runtimeState.isLoggedIn)
      : canClickControl(doc && doc.getElementById('runStaffBtn'));
    const identityGuidance = buildIdentityAlignmentGuidance(record, doc, runtimeState, isLoggedIn);
    if (identityGuidance) return identityGuidance;

    if (!isLoggedIn) {
      highlightTutorialButtons(record, ['loginBtn']);
      return 'Click LOGIN in this card.';
    }

    const requiredStaffActionId = String(step.action.actionId || '');
    if (requiredStaffActionId) {
      const selectedStaffActionId = controlValue('staffActionSelect', 'selectedStaffActionId');
      if (selectedStaffActionId !== requiredStaffActionId) {
        const optionLabel = getSelectOptionLabelByValue(doc, 'staffActionSelect', requiredStaffActionId);
        highlightTutorialButtons(record, ['staffActionSelect'], {
          expectedValue: requiredStaffActionId,
          expectedLabel: optionLabel
        });
        return optionLabel
          ? `Choose Staff Action: ${optionLabel}.`
          : 'Choose the highlighted Staff Action for this step.';
      }
    }

    if (step.action.actionId === 'fulfill_selected_referral') {
      const hasOpenReferral = runtimeState
        ? Boolean(runtimeState.hasOpenReferral)
        : Boolean(doc && doc.getElementById('referralSelect') && Array.from(doc.getElementById('referralSelect').options || []).some((option) => option.value && !option.disabled));
      if (!hasOpenReferral) {
        highlightTutorialButtons(record, ['referralSelect']);
        return 'No open referral is available in this card yet.';
      }

      const selectedReferralId = controlValue('referralSelect', 'selectedReferralId');
      const selectedReferralOpen = runtimeState
        ? Boolean(runtimeState.selectedReferralOpen)
        : Boolean((() => {
          const referralSelect = doc && doc.getElementById('referralSelect');
          if (!referralSelect || !referralSelect.value) return false;
          const selectedOption = referralSelect.selectedOptions && referralSelect.selectedOptions[0];
          return selectedOption ? !selectedOption.disabled : false;
        })());

      if (!selectedReferralId || !selectedReferralOpen) {
        const firstOpen = getFirstOpenSelectOption(doc, 'referralSelect');
        highlightTutorialButtons(record, ['referralSelect'], {
          expectedMode: 'open',
          expectedValue: firstOpen ? firstOpen.value : '',
          expectedLabel: firstOpen ? firstOpen.label : 'any open referral'
        });
        return firstOpen
          ? `Choose referral: ${firstOpen.label}.`
          : 'Choose an open referral in this card.';
      }
    }

    highlightTutorialButtons(record, ['runStaffBtn']);
    return 'Click Run Staff Action in this card.';
  }

  if (step.action.kind === 'self') {
    const isLoggedIn = runtimeState
      ? Boolean(runtimeState.isLoggedIn)
      : canClickControl(doc && doc.getElementById('runSelfBtn'));
    const identityGuidance = buildIdentityAlignmentGuidance(record, doc, runtimeState, isLoggedIn);
    if (identityGuidance) return identityGuidance;

    if (!isLoggedIn) {
      highlightTutorialButtons(record, ['loginBtn']);
      return 'Click LOGIN in this card.';
    }

    const requiredSelfActionId = String(step.action.actionId || '');
    if (requiredSelfActionId) {
      const selectedSelfActionId = controlValue('selfActionSelect', 'selectedSelfActionId');
      if (selectedSelfActionId !== requiredSelfActionId) {
        const optionLabel = getSelectOptionLabelByValue(doc, 'selfActionSelect', requiredSelfActionId);
        highlightTutorialButtons(record, ['selfActionSelect'], {
          expectedValue: requiredSelfActionId,
          expectedLabel: optionLabel
        });
        return optionLabel
          ? `Choose Self-Service Action: ${optionLabel}.`
          : 'Choose the highlighted Self-Service Action for this step.';
      }
    }

    highlightTutorialButtons(record, ['runSelfBtn']);
    return 'Click Run Self-Service Action in this card.';
  }

  if (step.action.kind === 'verify') {
    const verifyBtn = doc && doc.getElementById('verifyBtn');
    const isLoggedIn = runtimeState
      ? Boolean(runtimeState.isLoggedIn)
      : Boolean(verifyBtn && !verifyBtn.disabled);
    const identityGuidance = buildIdentityAlignmentGuidance(record, doc, runtimeState, isLoggedIn);
    if (identityGuidance) return identityGuidance;

    if (!isLoggedIn) {
      highlightTutorialButtons(record, ['loginBtn']);
      return 'Click LOGIN in this card.';
    }

    if (step.action.requireConsentToStore) {
      const consentCheckbox = doc && doc.getElementById('consentToStore');
      const consentToStoreEnabled = runtimeState
        ? Boolean(runtimeState.consentToStore)
        : Boolean(consentCheckbox && consentCheckbox.checked);
      if (!consentToStoreEnabled) {
        highlightTutorialButtons(record, ['consentToStore']);
        return 'Turn on "Store issued credential in sovereign demo data."';
      }
    }

    highlightTutorialButtons(record, ['verifyBtn']);
    return 'Click Verify and Issue VC in this card.';
  }

  return '';
};

const focusTutorialStep = (step, options) => {
  const opts = options || {};
  clearTutorialTarget();
  clearTutorialButtonHighlights();
  activeTutorialInstruction = '';
  openTutorialHierarchy(step);

  const record = resolveTutorialRecord(step);
  if (!record) return false;

  const targetUrl = getEndpointUrl(step.endpointKey);
  if (targetUrl && record.selector) {
    const hasOption = Array.from(record.selector.options).some((option) => option.value === targetUrl);
    if (hasOption && record.selector.value !== targetUrl) {
      record.selector.value = targetUrl;
      record.selector.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  if (opts.forceReload && targetUrl) {
    applyFrameSource(record, buildTutorialReloadUrl(targetUrl));
    activeTutorialInstruction = 'Loading card...';
  } else {
    activeTutorialInstruction = updateTutorialActionGuidance(step, record);
  }

  if (record.card) {
    record.card.classList.add('tutorial-target');
    activeTutorialTargetCard = record.card;
    if (opts.scroll !== false) {
      record.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return true;
};

const primeTutorialSeenEvents = () => {
  tutorialSeenEventIds = new Set();
  if (!demoStore || typeof demoStore.listEvents !== 'function') return;
  const recentEvents = demoStore.listEvents({ limit: 300 });
  if (!Array.isArray(recentEvents)) return;
  recentEvents.forEach((entry) => {
    if (entry && entry.id) tutorialSeenEventIds.add(entry.id);
  });
};

const collectUnseenTutorialEvents = () => {
  if (!demoStore || typeof demoStore.listEvents !== 'function') return [];
  const recentEvents = demoStore.listEvents({ limit: 24 });
  if (!Array.isArray(recentEvents) || recentEvents.length === 0) return [];

  const unseen = recentEvents.filter((entry) => entry && entry.id && !tutorialSeenEventIds.has(entry.id));
  unseen.forEach((entry) => tutorialSeenEventIds.add(entry.id));
  return unseen.reverse();
};

const doesEventMatchExpected = (event, expected) => {
  if (!event || !expected) return false;
  if (expected.type && event.type !== expected.type) return false;
  if (expected.providerId && event.providerId !== expected.providerId) return false;

  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  if (expected.targetCapability && payload.targetCapability !== expected.targetCapability) return false;
  if (expected.actionId && payload.actionId !== expected.actionId) return false;
  if (expected.credentialType && payload.credentialType !== expected.credentialType) return false;
  if (expected.verifierProfile && payload.verifierProfile !== expected.verifierProfile) return false;

  return true;
};

const renderWalkthroughButtons = () => {
  const mount = document.getElementById('walkthroughButtons');
  if (!mount) return;
  mount.innerHTML = '';

  tutorialChains.forEach((chain) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'walkthrough-start-btn';
    if (activeTutorialId === chain.id) button.classList.add('is-active');
    button.textContent = chain.title;
    button.addEventListener('click', () => {
      activeTutorialId = chain.id;
      activeTutorialStepIndex = 0;
      activeTutorialComplete = false;
      activeTutorialSubjectWebId = '';
      tutorialCompletionShownFor = '';
      closeTutorialCompletionModal();
      primeTutorialSeenEvents();
      renderWalkthroughButtons();
      runTutorialStep(0, { forceReload: true });
    });
    mount.appendChild(button);
  });
};

const renderWalkthroughPanel = () => {
  const panel = document.getElementById('walkthroughPanel');
  const titleEl = document.getElementById('walkthroughTitle');
  const descriptionEl = document.getElementById('walkthroughDescription');
  const progressEl = document.getElementById('walkthroughProgress');
  const instructionEl = document.getElementById('walkthroughInstruction');
  const stepsEl = document.getElementById('walkthroughSteps');
  if (!panel || !titleEl || !descriptionEl || !progressEl || !instructionEl || !stepsEl) return;

  const tutorial = getTutorialById(activeTutorialId);
  if (!tutorial) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  titleEl.textContent = tutorial.title;
  descriptionEl.textContent = tutorial.description;

  const steps = Array.isArray(tutorial.steps) ? tutorial.steps : [];
  const safeIndex = Math.min(Math.max(activeTutorialStepIndex, 0), Math.max(steps.length - 1, 0));
  activeTutorialStepIndex = safeIndex;
  const currentStep = steps[safeIndex] || null;

  progressEl.textContent = activeTutorialComplete
    ? `Step ${steps.length} of ${steps.length} (Complete)`
    : `Step ${steps.length ? safeIndex + 1 : 0} of ${steps.length}`;

  const defaultInstruction = currentStep && currentStep.instruction
    ? currentStep.instruction
    : 'Choose a tutorial chain to begin.';
  instructionEl.textContent = activeTutorialComplete
    ? 'Tutorial complete. Close the completion message to reset tutorial.'
    : (activeTutorialInstruction || defaultInstruction);

  stepsEl.innerHTML = '';
  steps.forEach((step, index) => {
    const li = document.createElement('li');
    li.textContent = step.label || `Step ${index + 1}`;
    if (index < safeIndex || (activeTutorialComplete && index === safeIndex)) li.classList.add('is-complete');
    if (!activeTutorialComplete && index === safeIndex) li.classList.add('is-active');
    stepsEl.appendChild(li);
  });
};

const runTutorialStep = (nextIndex, options) => {
  const tutorial = getTutorialById(activeTutorialId);
  if (!tutorial || !Array.isArray(tutorial.steps) || tutorial.steps.length === 0) return;
  const boundedIndex = Math.min(Math.max(Number(nextIndex) || 0, 0), tutorial.steps.length - 1);
  activeTutorialStepIndex = boundedIndex;
  activeTutorialComplete = false;
  if (boundedIndex === 0) {
    tutorialCompletionShownFor = '';
    closeTutorialCompletionModal();
  }
  focusTutorialStep(tutorial.steps[activeTutorialStepIndex], options);
  renderWalkthroughPanel();
};

const advanceTutorialFromEvent = (event) => {
  const tutorial = getTutorialById(activeTutorialId);
  if (!tutorial || !Array.isArray(tutorial.steps) || tutorial.steps.length === 0) return false;
  const currentStep = tutorial.steps[activeTutorialStepIndex] || null;
  if (!currentStep || !currentStep.expectedEvent) return false;
  const eventSubjectWebId = String(event && event.subjectWebId ? event.subjectWebId : '').trim();
  if (activeTutorialSubjectWebId && eventSubjectWebId && eventSubjectWebId !== activeTutorialSubjectWebId) return false;
  if (!doesEventMatchExpected(event, currentStep.expectedEvent)) return false;
  if (!activeTutorialSubjectWebId && eventSubjectWebId) {
    activeTutorialSubjectWebId = eventSubjectWebId;
  }

  if (activeTutorialStepIndex >= tutorial.steps.length - 1) {
    activeTutorialComplete = true;
    activeTutorialInstruction = 'Tutorial complete. Close the completion message to reset tutorial.';
    clearTutorialButtonHighlights();
    renderWalkthroughPanel();
    openTutorialCompletionModal(tutorial);
    return true;
  }

  runTutorialStep(activeTutorialStepIndex + 1);
  return true;
};

const handleTutorialStoreUpdate = () => {
  if (!activeTutorialId) return;

  const unseenEvents = collectUnseenTutorialEvents();
  if (unseenEvents.length === 0) return;

  let hasAdvanced = false;
  unseenEvents.forEach((event) => {
    if (advanceTutorialFromEvent(event)) {
      hasAdvanced = true;
    }
  });

  if (!hasAdvanced) {
    queueGuidanceRefresh({ scroll: false });
  }
};

  const handleFrameLoad = (record) => {
    const currentStep = getActiveTutorialStep();
    if (!currentStep) return;
    const expectedRecord = resolveTutorialRecord(currentStep);
    if (!expectedRecord || expectedRecord.id !== record.id) return;
    queueGuidanceRefresh({ scroll: false });
  };

  const handleStoreUpdate = () => {
    handleTutorialStoreUpdate();
  };

  const handleProviderStateMessage = (data) => {
    if (!data || data.type !== 'provider-state' || !data.providerId) return;
    const providerId = String(data.providerId);
    const nextState = {
      isLoggedIn: Boolean(data.isLoggedIn),
      hasOpenReferral: Boolean(data.hasOpenReferral),
      currentSubjectWebId: String(data.currentSubjectWebId || ''),
      selectedIdentityWebId: String(data.selectedIdentityWebId || ''),
      selectedStaffActionId: String(data.selectedStaffActionId || ''),
      selectedSelfActionId: String(data.selectedSelfActionId || ''),
      selectedReferralId: String(data.selectedReferralId || ''),
      selectedReferralOpen: Boolean(data.selectedReferralOpen),
      consentToStore: Boolean(data.consentToStore),
      canVerify: Boolean(data.canVerify)
    };
    const previousState = providerPortalState.get(providerId);
    if (previousState && sameProviderRuntimeState(previousState, nextState)) return;
    providerPortalState.set(providerId, nextState);

    if (!activeTutorialId) return;
    const currentStep = getActiveTutorialStep();
    if (!currentStep) return;
    const currentStepProviderId = getStepProviderId(currentStep);
    if (currentStepProviderId && currentStepProviderId !== providerId) return;
    queueGuidanceRefresh({ scroll: false });
  };

  const handleExternalTutorialEvent = (event) => {
    if (!event || typeof event !== 'object') return;
    if (!activeTutorialId) return;
    const advanced = advanceTutorialFromEvent(event);
    if (advanced) return;
    queueGuidanceRefresh({ scroll: false });
  };

  const handleDemoDataReset = () => {
    primeTutorialSeenEvents();
    activeTutorialSubjectWebId = '';
    tutorialCompletionShownFor = '';
    closeTutorialCompletionModal();

    if (activeTutorialId) {
      runTutorialStep(0, { forceReload: true });
      return;
    }

    clearTutorialButtonHighlights();
    clearTutorialTarget();
    activeTutorialInstruction = '';
    activeTutorialComplete = false;
    renderWalkthroughPanel();
  };

  const initialize = () => {
    renderWalkthroughButtons();
    renderWalkthroughPanel();
    primeTutorialSeenEvents();
  };

  return {
    channel: tutorialChannel,
    initialize,
    handleFrameLoad,
    handleStoreUpdate,
    handleProviderStateMessage,
    handleExternalTutorialEvent,
    handleDemoDataReset,
    dismissTutorialCompletionAndReset
  };
};

window.SovereignIndividualTutorialController = { createIndividualTutorialController };
})();
