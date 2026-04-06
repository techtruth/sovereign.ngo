(function () {
const tutorialChains = [
      {
        id: 'onboard-all-documents',
        title: "Onboard All My Documents (Driver's License / State ID VC Issuer + Passport VC Issuer + Birth Certificate VC Issuer + Utility Bill VC Issuer + Proof of Residency VC Issuer + Social Security VC Issuer)",
        description: 'Build a complete trusted document set for everyday service onboarding.',
        steps: [
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_drivers_license',
            label: "Issue driver's license/state ID credential",
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_drivers_license', credentialType: 'DriversLicenseCredential' }
          },
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_passport',
            label: 'Issue passport/passport card credential',
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_passport', credentialType: 'PassportCredential' }
          },
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_birth_certificate',
            label: 'Issue birth certificate credential',
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_birth_certificate', credentialType: 'BirthCertificateCredential' }
          },
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_utility_bill',
            label: 'Issue utility bill credential',
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_utility_bill', credentialType: 'UtilityBillCredential' }
          },
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_proof_of_residency',
            label: 'Issue proof of residency credential',
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_proof_of_residency', credentialType: 'ProofOfResidencyCredential' }
          },
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_social_security',
            label: 'Issue social security credential',
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_social_security', credentialType: 'SocialSecurityCredential' }
          }
        ]
      },
      {
        id: 'clinic-to-pharmacy',
        title: 'Get My Medicine (Primary Care Provider + Pharmacy)',
        description: 'A common clinic-to-pharmacy handoff for medication access.',
        steps: [
          {
            groupId: 'naics-62',
            subsectorId: 'naics-621',
            serviceId: 'hospital-clinic',
            endpointKey: 'nolichucky_family_clinic',
            label: 'Clinic issues pharmacy referral',
            instruction: "Set staff action to 'Issue pharmacy fulfillment referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_pharmacy_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'nolichucky_family_clinic', targetCapability: 'pharmacy-services' }
          },
          {
            groupId: 'naics-44-45',
            subsectorId: 'naics-446',
            serviceId: 'mainstreet-community-pharmacy',
            endpointKey: 'mainstreet_community_pharmacy',
            label: 'Pharmacy fulfills referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'mainstreet_community_pharmacy', targetCapability: 'pharmacy-services' }
          }
        ]
      },
      {
        id: 'ambulance-hospital-home-health',
        title: '911 Emergency to Home Recovery (Ambulance Service + Hospital Emergency Department + Home Health Provider)',
        description: 'Emergency transport, hospital treatment, and home recovery follow-through.',
        steps: [
          {
            groupId: 'naics-62',
            subsectorId: 'naics-621',
            serviceId: 'tri-county-ambulance',
            endpointKey: 'tri_county_ambulance',
            label: 'Ambulance issues emergency handoff',
            instruction: "Set staff action to 'Issue emergency handoff referral to hospital', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_emergency_handoff_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'tri_county_ambulance', targetCapability: 'emergency-care' }
          },
          {
            groupId: 'naics-62',
            subsectorId: 'naics-622',
            serviceId: 'emergency-department',
            endpointKey: 'summitview_emergency_department',
            label: 'Hospital fulfills emergency handoff',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'summitview_emergency_department', targetCapability: 'emergency-care' }
          },
          {
            groupId: 'naics-62',
            subsectorId: 'naics-622',
            serviceId: 'emergency-department',
            endpointKey: 'summitview_emergency_department',
            label: 'Hospital issues home-health follow-up',
            instruction: "Set staff action to 'Issue home health follow-up referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_home_health_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'summitview_emergency_department', targetCapability: 'home-health' }
          },
          {
            groupId: 'naics-62',
            subsectorId: 'naics-621',
            serviceId: 'caringhands-home-health',
            endpointKey: 'caringhands_home_health',
            label: 'Home health fulfills follow-up',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'caringhands_home_health', targetCapability: 'home-health' }
          }
        ]
      },
      {
        id: 'childcare-training-employment',
        title: 'Child Care to Job Support (Child Care Provider + Workforce Training Provider + Employment Placement Agency)',
        description: 'Link family support to training and job placement.',
        steps: [
          {
            groupId: 'naics-62',
            subsectorId: 'naics-624',
            serviceId: 'sunrise-child-day-center',
            endpointKey: 'sunrise_child_day_center',
            label: 'Child care issues training referral',
            instruction: "Set staff action to 'Issue workforce training referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_workforce_training_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'sunrise_child_day_center', targetCapability: 'workforce-training' }
          },
          {
            groupId: 'naics-61',
            subsectorId: 'naics-611',
            serviceId: 'highland-workforce-training-institute',
            endpointKey: 'highland_workforce_training_institute',
            label: 'Training provider fulfills referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'highland_workforce_training_institute', targetCapability: 'workforce-training' }
          },
          {
            groupId: 'naics-61',
            subsectorId: 'naics-611',
            serviceId: 'highland-workforce-training-institute',
            endpointKey: 'highland_workforce_training_institute',
            label: 'Training provider issues placement referral',
            instruction: "Set staff action to 'Issue employment placement referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_employment_placement_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'highland_workforce_training_institute', targetCapability: 'employment-support' }
          },
          {
            groupId: 'naics-56',
            subsectorId: 'naics-561',
            serviceId: 'ascent-employment-placement-agency',
            endpointKey: 'ascent_employment_placement_agency',
            label: 'Placement agency fulfills referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'ascent_employment_placement_agency', targetCapability: 'employment-support' }
          }
        ]
      },
      {
        id: 'behavioral-stepup-stepdown',
        title: 'Mental Health Step-Up and Step-Down (Outpatient Behavioral Health Provider + Residential Recovery Provider)',
        description: 'Escalate to residential support when needed, then step back down to outpatient care.',
        steps: [
          {
            groupId: 'naics-62',
            subsectorId: 'naics-621',
            serviceId: 'ridgeview-behavioral-health-center',
            endpointKey: 'ridgeview_behavioral_health_center',
            label: 'Outpatient issues residential escalation',
            instruction: "Set staff action to 'Issue residential recovery referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_residential_recovery_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'ridgeview_behavioral_health_center', targetCapability: 'residential-treatment' }
          },
          {
            groupId: 'naics-62',
            subsectorId: 'naics-623',
            serviceId: 'horizon-residential-recovery-center',
            endpointKey: 'horizon_residential_recovery_center',
            label: 'Residential fulfills escalation',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'horizon_residential_recovery_center', targetCapability: 'residential-treatment' }
          },
          {
            groupId: 'naics-62',
            subsectorId: 'naics-623',
            serviceId: 'horizon-residential-recovery-center',
            endpointKey: 'horizon_residential_recovery_center',
            label: 'Residential issues outpatient follow-up',
            instruction: "Set staff action to 'Issue outpatient behavioral follow-up referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_outpatient_behavioral_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'horizon_residential_recovery_center', targetCapability: 'behavioral-health' }
          },
          {
            groupId: 'naics-62',
            subsectorId: 'naics-621',
            serviceId: 'ridgeview-behavioral-health-center',
            endpointKey: 'ridgeview_behavioral_health_center',
            label: 'Outpatient fulfills follow-up',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'ridgeview_behavioral_health_center', targetCapability: 'behavioral-health' }
          }
        ]
      },
      {
        id: 'care-insurance-claims',
        title: 'Check My Coverage and Claim (Primary Care Provider + Health Insurance Carrier + Claims Administrator)',
        description: 'Coordinate care, coverage checks, and claim status updates.',
        steps: [
          {
            groupId: 'naics-62',
            subsectorId: 'naics-621',
            serviceId: 'hospital-clinic',
            endpointKey: 'nolichucky_family_clinic',
            label: 'Care provider issues eligibility referral',
            instruction: "Set staff action to 'Issue insurance eligibility referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_insurance_eligibility_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'nolichucky_family_clinic', targetCapability: 'insurance-enrollment' }
          },
          {
            groupId: 'naics-52',
            subsectorId: 'naics-524',
            serviceId: 'summit-health-insurance-carrier',
            endpointKey: 'summit_health_insurance_carrier',
            label: 'Insurance fulfills eligibility referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'summit_health_insurance_carrier', targetCapability: 'insurance-enrollment' }
          },
          {
            groupId: 'naics-52',
            subsectorId: 'naics-524',
            serviceId: 'summit-health-insurance-carrier',
            endpointKey: 'summit_health_insurance_carrier',
            label: 'Insurance issues claims administration referral',
            instruction: "Set staff action to 'Issue claims administration referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_claims_admin_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'summit_health_insurance_carrier', targetCapability: 'claims-processing' }
          },
          {
            groupId: 'naics-52',
            subsectorId: 'naics-524',
            serviceId: 'atlas-claims-administration',
            endpointKey: 'atlas_claims_administration',
            label: 'Claims admin fulfills referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'atlas_claims_administration', targetCapability: 'claims-processing' }
          },
          {
            groupId: 'naics-52',
            subsectorId: 'naics-524',
            serviceId: 'atlas-claims-administration',
            endpointKey: 'atlas_claims_administration',
            label: 'Claims admin returns status referral',
            instruction: "Set staff action to 'Issue claims status referral back to care provider', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_claims_status_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'atlas_claims_administration', targetCapability: 'medical-records' }
          },
          {
            groupId: 'naics-62',
            subsectorId: 'naics-621',
            serviceId: 'hospital-clinic',
            endpointKey: 'nolichucky_family_clinic',
            label: 'Care provider fulfills status return',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'nolichucky_family_clinic', targetCapability: 'medical-records' }
          }
        ]
      },
      {
        id: 'legal-rights-disputes',
        title: 'Resolve Legal and Consumer Issues (Legal Aid Provider + Claims Administrator + Consumer Protection Organization)',
        description: 'Handle legal and consumer issues with clear handoffs and accountability.',
        steps: [
          {
            groupId: 'naics-54',
            subsectorId: 'naics-541',
            serviceId: 'community-legal-aid-collective',
            endpointKey: 'community_legal_aid_collective',
            label: 'Legal aid issues insurance-dispute referral',
            instruction: "Set staff action to 'Issue insurance dispute referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_insurance_dispute_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'community_legal_aid_collective', targetCapability: 'claims-processing' }
          },
          {
            groupId: 'naics-52',
            subsectorId: 'naics-524',
            serviceId: 'atlas-claims-administration',
            endpointKey: 'atlas_claims_administration',
            label: 'Claims admin fulfills dispute referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'atlas_claims_administration', targetCapability: 'claims-processing' }
          },
          {
            groupId: 'naics-54',
            subsectorId: 'naics-541',
            serviceId: 'community-legal-aid-collective',
            endpointKey: 'community_legal_aid_collective',
            label: 'Legal aid issues consumer-protection referral',
            instruction: "Set staff action to 'Issue consumer protection referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_consumer_protection_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'community_legal_aid_collective', targetCapability: 'consumer-protection' }
          },
          {
            groupId: 'naics-81',
            subsectorId: 'naics-813',
            serviceId: 'consumer-regulation-support',
            endpointKey: 'consumer_regulation_support',
            label: 'Consumer-protection agency fulfills referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'consumer_regulation_support', targetCapability: 'consumer-protection' }
          }
        ]
      },
      {
        id: 'recover-core-documents',
        title: "Recover My Missing Core Documents (Birth Certificate VC Issuer + Social Security VC Issuer + Driver's License / State ID VC Issuer)",
        description: 'Rebuild essential identity proofs when key documents are missing.',
        steps: [
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_birth_certificate',
            label: 'Issue birth certificate credential',
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_birth_certificate', credentialType: 'BirthCertificateCredential' }
          },
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_social_security',
            label: 'Issue social security credential',
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_social_security', credentialType: 'SocialSecurityCredential' }
          },
          {
            groupId: 'identity-vc-issuers',
            serviceId: 'identity-vc-issuer',
            endpointKey: 'verifier_drivers_license',
            label: "Issue driver's license/state ID credential",
            instruction: "Click LOGIN, then click Verify and Issue VC.",
            action: { kind: 'verify', requireConsentToStore: true },
            expectedEvent: { type: 'identity-vc-issued', providerId: 'verifier_drivers_license', credentialType: 'DriversLicenseCredential' }
          }
        ]
      },
      {
        id: 'coordinated-entry-to-housing-match',
        title: 'Move from Coordinated Entry to Housing Match (Housing Navigation Provider + Residential Leasing Provider + Property Management Provider)',
        description: 'Model the coordinated-entry queue moving into housing placement and stabilization.',
        steps: [
          {
            groupId: 'naics-62',
            subsectorId: 'naics-624',
            serviceId: 'fairmannor-house',
            endpointKey: 'fairmannor_house',
            label: 'Housing navigation issues placement referral',
            instruction: "Set staff action to 'Issue housing placement referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_housing_placement_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'fairmannor_house', targetCapability: 'housing-access' }
          },
          {
            groupId: 'naics-53',
            subsectorId: 'naics-531',
            serviceId: 'homestead-residential-leasing',
            endpointKey: 'homestead_residential_leasing',
            label: 'Leasing provider fulfills placement referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'homestead_residential_leasing', targetCapability: 'housing-access' }
          },
          {
            groupId: 'naics-53',
            subsectorId: 'naics-531',
            serviceId: 'homestead-residential-leasing',
            endpointKey: 'homestead_residential_leasing',
            label: 'Leasing provider issues property handoff',
            instruction: "Set staff action to 'Issue property management referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_property_management_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'homestead_residential_leasing', targetCapability: 'housing-stability' }
          },
          {
            groupId: 'naics-53',
            subsectorId: 'naics-531',
            serviceId: 'cornerstone-property-management',
            endpointKey: 'cornerstone_property_management',
            label: 'Property management fulfills stabilization handoff',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'cornerstone_property_management', targetCapability: 'housing-stability' }
          }
        ]
      },
      {
        id: 'housing-stabilization',
        title: 'Get Me Housed and Connected (Emergency Shelter + Residential Leasing + Property Management + Electric Utility)',
        description: 'Move from shelter to stable housing with utility activation and proof of residency.',
        steps: [
          {
            groupId: 'naics-62',
            subsectorId: 'naics-624',
            serviceId: 'safeharbor-shelter',
            endpointKey: 'safeharbor_shelter',
            label: 'Shelter issues housing placement',
            instruction: "Set staff action to 'Issue housing placement referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_housing_placement_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'safeharbor_shelter', targetCapability: 'housing-access' }
          },
          {
            groupId: 'naics-53',
            subsectorId: 'naics-531',
            serviceId: 'homestead-residential-leasing',
            endpointKey: 'homestead_residential_leasing',
            label: 'Leasing fulfills housing placement',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'homestead_residential_leasing', targetCapability: 'housing-access' }
          },
          {
            groupId: 'naics-53',
            subsectorId: 'naics-531',
            serviceId: 'homestead-residential-leasing',
            endpointKey: 'homestead_residential_leasing',
            label: 'Leasing issues property management handoff',
            instruction: "Set staff action to 'Issue property management referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_property_management_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'homestead_residential_leasing', targetCapability: 'housing-stability' }
          },
          {
            groupId: 'naics-53',
            subsectorId: 'naics-531',
            serviceId: 'cornerstone-property-management',
            endpointKey: 'cornerstone_property_management',
            label: 'Property management fulfills housing-stability handoff',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'cornerstone_property_management', targetCapability: 'housing-stability' }
          },
          {
            groupId: 'naics-53',
            subsectorId: 'naics-531',
            serviceId: 'cornerstone-property-management',
            endpointKey: 'cornerstone_property_management',
            label: 'Property management issues utility setup',
            instruction: "Set staff action to 'Issue utility setup referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_utility_setup_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'cornerstone_property_management', targetCapability: 'utility-service' }
          },
          {
            groupId: 'naics-22',
            subsectorId: 'naics-221',
            serviceId: 'appalachian-electric-distribution',
            endpointKey: 'appalachian_electric_distribution',
            label: 'Utility fulfills setup',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'appalachian_electric_distribution', targetCapability: 'utility-service' }
          },
          {
            groupId: 'naics-22',
            subsectorId: 'naics-221',
            serviceId: 'appalachian-electric-distribution',
            endpointKey: 'appalachian_electric_distribution',
            label: 'Utility issues residency evidence credential',
            instruction: "Set staff action to 'Issue utility residency evidence credential', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_residency_evidence_credential' },
            expectedEvent: { type: 'credential-issued', providerId: 'appalachian_electric_distribution', actionId: 'issue_residency_evidence_credential' }
          }
        ]
      },      {
        id: 'outreach-to-shelter',
        title: 'Find Safe Shelter (Street Outreach Provider + Emergency Shelter)',
        description: 'Model outreach demand handoffs into shelter access.',
        steps: [
          {
            groupId: 'naics-62',
            subsectorId: 'naics-624',
            serviceId: 'salutation-army',
            endpointKey: 'salutation_army',
            label: 'Outreach team issues shelter referral',
            instruction: "Set staff action to 'Issue shelter access referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'issue_shelter_access_referral' },
            expectedEvent: { type: 'referral-issued', providerId: 'salutation_army', targetCapability: 'shelter-access' }
          },
          {
            groupId: 'naics-62',
            subsectorId: 'naics-624',
            serviceId: 'safeharbor-shelter',
            endpointKey: 'safeharbor_shelter',
            label: 'Shelter fulfills outreach referral',
            instruction: "Set staff action to 'Fulfill selected referral', then click Run Staff Action.",
            action: { kind: 'staff', actionId: 'fulfill_selected_referral' },
            expectedEvent: { type: 'referral-fulfilled', providerId: 'safeharbor_shelter', targetCapability: 'shelter-access' }
          }
        ]
      },

    ];
const tutorialCompletionNarrativeById = {
      'clinic-to-pharmacy': 'A clinic handed off medication needs to a pharmacy, and the pharmacy fulfilled that handoff.',
      'ambulance-hospital-home-health': 'Emergency transport, hospital care, and home-health follow-up were coordinated as one connected path.',
      'housing-stabilization': 'Housing access moved from shelter to leasing to utilities, ending with proof that supports long-term stability.',
      'behavioral-stepup-stepdown': 'Outpatient and residential behavioral support were coordinated as step-up and step-down care.',
      'care-insurance-claims': 'Care, insurance review, and claims updates were exchanged without breaking continuity for the person.',
      'childcare-training-employment': 'Family support, training, and job placement were linked into one progression.',
      'legal-rights-disputes': 'Legal and consumer-protection pathways were coordinated through auditable referrals and completion steps.',
      'outreach-to-shelter': 'Street outreach moved a person into emergency shelter through a direct, trackable handoff.',
      'coordinated-entry-to-housing-match': 'Coordinated-entry style housing navigation moved into placement and stabilization steps.',
      'onboard-all-documents': 'A full set of common identity and proof documents was onboarded into trusted credentials.',
      'recover-core-documents': 'Missing core identity documents were re-established into trusted credentials.'
    };

window.SovereignIndividualTutorialData = { tutorialChains, tutorialCompletionNarrativeById };
})();
