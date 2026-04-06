(function () {
  const providerCatalog = typeof window !== "undefined" ? window.SovereignProviderCatalog : null;
  if (!Array.isArray(providerCatalog)) {
    throw new Error("Provider catalog failed to load.");
  }

  const currentHost = typeof window !== "undefined"
    ? String((window.location && window.location.host) || "").toLowerCase()
    : "";
  const useProviderSiteContainers = currentHost === "localhost:8180" || currentHost === "127.0.0.1:8180";

  const providerEntries = providerCatalog.reduce((acc, provider) => {
    if (!provider || !provider.id) return acc;
    const providerId = String(provider.id);
    const encodedProviderId = encodeURIComponent(providerId);
    const providerUrl = useProviderSiteContainers
      ? `/provider-sites/${encodedProviderId}/services/provider/index.html?provider=${encodedProviderId}`
      : `../services/provider/index.html?provider=${encodedProviderId}`;
    acc[providerId] = {
      label: provider.label,
      url: providerUrl,
      type: provider.type,
      taxonomies: provider && provider.taxonomies && typeof provider.taxonomies === "object"
        ? { ...provider.taxonomies }
        : null
    };
    return acc;
  }, {});

  const prefixEntries = {
  "sovereign_pod": {
    "label": "Sovereign Pod",
    "url": "../services/solid-pod/index.html",
    "type": "resident-data-store"
  },
  "credential_manager": {
    "label": "Credential Manager",
    "url": "../services/credential-manager/index.html",
    "type": "consent-and-credential-control"
  }
};
  const suffixEntries = {
  "verifier_drivers_license": {
    "label": "Driver's License / State ID VC Issuer",
    "url": "../services/verifier/index.html?profile=drivers_license",
    "type": "identity-vc-issuer"
  },
  "verifier_passport": {
    "label": "Passport / Passport Card VC Issuer",
    "url": "../services/verifier/index.html?profile=passport",
    "type": "identity-vc-issuer"
  },
  "verifier_birth_certificate": {
    "label": "Birth Certificate VC Issuer",
    "url": "../services/verifier/index.html?profile=birth_certificate",
    "type": "identity-vc-issuer"
  },
  "verifier_utility_bill": {
    "label": "Utility Bill VC Issuer",
    "url": "../services/verifier/index.html?profile=utility_bill",
    "type": "identity-vc-issuer"
  },
  "verifier_proof_of_residency": {
    "label": "Proof of Residency VC Issuer",
    "url": "../services/verifier/index.html?profile=proof_of_residency",
    "type": "identity-vc-issuer"
  },
  "verifier_social_security": {
    "label": "Social Security VC Issuer",
    "url": "../services/verifier/index.html?profile=social_security",
    "type": "identity-vc-issuer"
  },
  "blank": {
    "label": "Blank",
    "url": "about:blank",
    "type": "none"
  }
};

  const endpointDirectory = {
    ...prefixEntries,
    ...providerEntries,
    ...suffixEntries
  };

  if (typeof window !== "undefined") {
    window.SovereignEndpointDirectory = Object.freeze(endpointDirectory);
  }
})();
