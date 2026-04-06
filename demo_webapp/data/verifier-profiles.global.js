(function () {
  const profileConfigs = {
        drivers_license: {
          label: "Driver's License / State ID VC Issuer",
          verifierDid: 'did:example:verifier:drivers-license',
          credentialType: 'DriversLicenseCredential',
          submitRoute: '/submit/drivers-license',
          buildClaims: (identity) => ({
            name: identity.displayName,
            dob: '1990-01-15',
            address: '100 Buffalo St, Northeast Tennessee 37604, USA',
            state: 'TN',
            licenseNumber: 'DL-000-123-456',
            stateIdType: 'drivers_license_or_state_id'
          })
        },
        passport: {
          label: 'Passport / Passport Card VC Issuer',
          verifierDid: 'did:example:verifier:passport',
          credentialType: 'PassportCredential',
          submitRoute: '/submit/passport',
          buildClaims: (identity) => ({
            name: identity.displayName,
            dob: '1990-01-15',
            passportNumber: 'XK1200099',
            nationality: 'US',
            issuingCountry: 'US',
            expiryDate: '2032-08-30',
            passportDocumentType: 'passport_or_passport_card'
          })
        },
        birth_certificate: {
          label: 'Birth Certificate VC Issuer',
          verifierDid: 'did:example:verifier:birth-certificate',
          credentialType: 'BirthCertificateCredential',
          submitRoute: '/submit/birth-certificate',
          buildClaims: (identity) => ({
            name: identity.displayName,
            dob: '1990-01-15',
            birthPlace: 'Johnson City, Tennessee, USA',
            certificateNumber: 'TN-BC-1990-001234',
            issuingAuthority: 'Tennessee Office of Vital Records',
            registrationDate: '1990-01-20'
          })
        },
        utility_bill: {
          label: 'Utility Bill VC Issuer',
          verifierDid: 'did:example:verifier:utility-bill',
          credentialType: 'UtilityBillCredential',
          submitRoute: '/submit/utility-bill',
          buildClaims: (identity) => ({
            name: identity.displayName,
            address: '100 Buffalo St, Northeast Tennessee 37604, USA',
            lastPaidDate: '2026-02-28',
            billingPeriod: '2026-02',
            provider: 'Mock Utility Electric Co.',
            accountNumber: 'UTIL-998877'
          })
        },
        proof_of_residency: {
          label: 'Proof of Residency VC Issuer',
          verifierDid: 'did:example:verifier:proof-of-residency',
          credentialType: 'ProofOfResidencyCredential',
          submitRoute: '/submit/proof-of-residency',
          buildClaims: (identity) => ({
            name: identity.displayName,
            address: '100 Buffalo St, Northeast Tennessee 37604, USA',
            documentType: 'Lease Agreement',
            issuer: 'Buffalo Street Property Management',
            issuedDate: '2026-01-01',
            jurisdiction: 'TN'
          })
        },
        social_security: {
          label: 'Social Security VC Issuer',
          verifierDid: 'did:example:verifier:social-security',
          credentialType: 'SocialSecurityCredential',
          submitRoute: '/submit/social-security',
          buildClaims: (identity) => ({
            name: identity.displayName,
            ssnLast4: '1234',
            issuingAuthority: 'Social Security Administration',
            status: 'active',
            issuedDate: '2008-05-01'
          })
        }
      };
  const defaultProfile = 'drivers_license';

  if (typeof window !== "undefined") {
    window.SovereignVerifierProfiles = Object.freeze({
      profileConfigs,
      defaultProfile
    });
  }
})();
