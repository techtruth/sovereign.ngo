(function () {
  const configMap = {
        nolichucky_family_clinic: {
          selfActions: [
            { id: 'check_in_walk_in', label: 'Check In (or Walk In)' },
            { id: 'arrive_any', label: 'Arrive, with or without an appointment' },
            { id: 'request_treatment', label: 'Request treatment' }
          ],
          staffActions: [
            { id: 'record_clinical_visit', label: 'Record clinical visit' },
            { id: 'issue_imaging_referral', label: 'Issue imaging referral (any qualified provider)' },
            { id: 'record_follow_up_plan', label: 'Record follow-up plan' }
          ]
        },
        riverbend_dental_clinic: {
          selfActions: [
            { id: 'request_dental_care_support', label: 'Request dental care support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete dental intake' },
            { id: 'record_case_update', label: 'Record dental care update' }
          ]
        },
        riverstone_radiology_center: {
          selfActions: [
            { id: 'check_in_walk_in', label: 'Check In (or Walk In)' },
            { id: 'arrive_any', label: 'Arrive, with or without an appointment' },
            { id: 'request_xray', label: 'Request X-Ray' },
            { id: 'request_ultrasound', label: 'Request Ultrasound' }
          ],
          staffActions: [
            { id: 'fulfill_selected_referral', label: 'Fulfill selected referral' },
            { id: 'record_imaging_results', label: 'Record imaging results' }
          ]
        },
        summitview_emergency_department: {
          selfActions: [
            { id: 'check_in_walk_in', label: 'Check In (or Walk In)' },
            { id: 'arrive_any', label: 'Arrive, with or without an appointment' },
            { id: 'request_emergency_care', label: 'Request emergency care' }
          ],
          staffActions: [
            { id: 'request_shared_record_access', label: 'Request shared record access' },
            { id: 'record_emergency_treatment', label: 'Record emergency treatment summary' }
          ],
          allowEmergencyOverride: true
        },
        fairmannor_house: {
          selfActions: [
            { id: 'request_prevention_intake', label: 'Request homelessness prevention intake' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete service intake' },
            { id: 'record_case_update', label: 'Record case update' }
          ]
        },
        safeharbor_shelter: {
          selfActions: [
            { id: 'request_shelter_bed', label: 'Request emergency shelter support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete shelter intake' },
            { id: 'record_case_update', label: 'Record shelter case update' }
          ]
        },
        community_food_pantry: {
          selfActions: [
            { id: 'request_food_assistance', label: 'Request food pantry support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete food pantry intake' },
            { id: 'record_case_update', label: 'Record food pantry support update' }
          ]
        },
        bridgeway_family_services: {
          selfActions: [
            { id: 'request_family_support', label: 'Request family services support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete family intake' },
            { id: 'record_case_update', label: 'Record family support update' }
          ]
        },
        family_mediation_center: {
          selfActions: [
            { id: 'request_family_mediation', label: 'Request family mediation support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete mediation intake' },
            { id: 'record_case_update', label: 'Record mediation support update' }
          ]
        },
        salutation_army: {
          selfActions: [
            { id: 'request_community_assistance', label: 'Request community assistance' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete assistance intake' },
            { id: 'record_case_update', label: 'Record assistance update' }
          ]
        },
        pioneer_legal_benefits_navigation: {
          selfActions: [
            { id: 'request_legal_navigation', label: 'Request legal and benefits navigation' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete legal-benefits intake' },
            { id: 'record_case_update', label: 'Record legal-benefits update' }
          ]
        },
        tenant_rights_advocacy_network: {
          selfActions: [
            { id: 'request_tenant_rights_support', label: 'Request tenant rights legal advocacy' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete tenant rights intake' },
            { id: 'record_case_update', label: 'Record tenant rights legal update' }
          ]
        },
        community_legal_family_support: {
          selfActions: [
            { id: 'request_legal_family_support', label: 'Request legal and family support services' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete legal-family support intake' },
            { id: 'record_case_update', label: 'Record legal-family support update' }
          ]
        },
        financial_wellness_center: {
          selfActions: [
            { id: 'request_money_management', label: 'Request money management support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete money management intake' },
            { id: 'record_case_update', label: 'Record money management support update' }
          ]
        },
        community_tax_services: {
          selfActions: [
            { id: 'request_tax_support', label: 'Request tax preparation support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete tax services intake' },
            { id: 'record_case_update', label: 'Record tax services update' }
          ]
        },
        consumer_regulation_support: {
          selfActions: [
            { id: 'request_consumer_regulation_support', label: 'Request consumer regulation support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete consumer protection intake' },
            { id: 'record_case_update', label: 'Record consumer protection update' }
          ]
        },
        commonwealth_credit_union: {
          selfActions: [
            { id: 'request_credit_union_intake', label: 'Request credit union services' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete credit union intake' },
            { id: 'record_case_update', label: 'Record credit union support update' }
          ]
        },
        neighborhood_insurance_brokers: {
          selfActions: [
            { id: 'request_insurance_navigation', label: 'Request insurance navigation support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete insurance intake' },
            { id: 'record_case_update', label: 'Record insurance support update' }
          ]
        },
        valley_notary_office: {
          selfActions: [
            { id: 'request_notary_appointment', label: 'Request notary appointment' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete notary intake' },
            { id: 'record_case_update', label: 'Record notarization update' }
          ]
        },
        community_legal_aid_collective: {
          selfActions: [
            { id: 'request_legal_aid_intake', label: 'Request legal aid support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete legal aid intake' },
            { id: 'record_case_update', label: 'Record legal aid case update' }
          ]
        },
        ascent_employment_placement_agency: {
          selfActions: [
            { id: 'request_job_placement_support', label: 'Request job placement support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete placement intake' },
            { id: 'record_case_update', label: 'Record placement support update' }
          ]
        },
        rapid_response_temporary_help: {
          selfActions: [
            { id: 'request_temp_work_support', label: 'Request temporary work support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete temporary help intake' },
            { id: 'record_case_update', label: 'Record temporary help update' }
          ]
        },
        cedar_document_preparation_center: {
          selfActions: [
            { id: 'request_document_preparation_support', label: 'Request document preparation support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete document prep intake' },
            { id: 'record_case_update', label: 'Record document prep update' }
          ]
        },
        brightpath_educational_support_center: {
          selfActions: [
            { id: 'request_education_support', label: 'Request educational support services' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete educational support intake' },
            { id: 'record_case_update', label: 'Record educational support update' }
          ]
        },
        ridgeview_behavioral_health_center: {
          selfActions: [
            { id: 'request_behavioral_health_intake', label: 'Request behavioral health intake' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete behavioral health intake' },
            { id: 'record_case_update', label: 'Record behavioral health care update' }
          ]
        },
        bluepeak_medical_laboratory: {
          selfActions: [
            { id: 'request_lab_testing_support', label: 'Request medical laboratory testing' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete laboratory intake' },
            { id: 'record_case_update', label: 'Record laboratory service update' }
          ]
        },
        caringhands_home_health: {
          selfActions: [
            { id: 'request_home_health_support', label: 'Request home health services' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete home health intake' },
            { id: 'record_case_update', label: 'Record home health care update' }
          ]
        },
        tri_county_ambulance: {
          selfActions: [
            { id: 'request_emergency_transport', label: 'Request emergency transport' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete transport intake' },
            { id: 'record_case_update', label: 'Record transport service update' }
          ],
          allowEmergencyOverride: true
        },
        foothills_disability_support_services: {
          selfActions: [
            { id: 'request_disability_support', label: 'Request disability support services' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete disability support intake' },
            { id: 'record_case_update', label: 'Record disability support update' }
          ]
        },
        pathway_vocational_rehabilitation: {
          selfActions: [
            { id: 'request_vocational_rehab_support', label: 'Request vocational rehabilitation support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete vocational rehab intake' },
            { id: 'record_case_update', label: 'Record vocational rehab update' }
          ]
        },
        dignity_human_rights_organization: {
          selfActions: [
            { id: 'request_human_rights_support', label: 'Request human rights advocacy support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete advocacy intake' },
            { id: 'record_case_update', label: 'Record advocacy case update' }
          ]
        },
        appalachian_electric_distribution: {
          selfActions: [
            { id: 'request_utility_service_support', label: 'Request electric utility service support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete utility service intake' },
            { id: 'record_case_update', label: 'Record electric utility service update' }
          ]
        },
        holston_wireless_carrier: {
          selfActions: [
            { id: 'request_wireless_service_support', label: 'Request wireless service support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete wireless service intake' },
            { id: 'record_case_update', label: 'Record wireless service update' }
          ]
        },
        blue_river_natural_gas_utility: {
          selfActions: [
            { id: 'request_utility_service_support', label: 'Request natural gas utility service support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete utility service intake' },
            { id: 'record_case_update', label: 'Record natural gas service update' }
          ]
        },
        clearwater_public_water_utility: {
          selfActions: [
            { id: 'request_utility_service_support', label: 'Request public water utility service support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete utility service intake' },
            { id: 'record_case_update', label: 'Record water utility service update' }
          ]
        },
        volunteer_electrical_contractors: {
          selfActions: [
            { id: 'request_electrical_service_support', label: 'Request electrical contractor support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete electrical service intake' },
            { id: 'record_case_update', label: 'Record electrical service update' }
          ]
        },
        foothills_plumbing_hvac_contractors: {
          selfActions: [
            { id: 'request_plumbing_hvac_service_support', label: 'Request plumbing, heating, and air support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete plumbing/HVAC service intake' },
            { id: 'record_case_update', label: 'Record plumbing/HVAC service update' }
          ]
        },
        mainstreet_community_pharmacy: {
          selfActions: [
            { id: 'request_prescription_support', label: 'Request prescription medication support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete pharmacy intake' },
            { id: 'record_case_update', label: 'Record medication fulfillment update' }
          ]
        },
        homestead_residential_leasing: {
          selfActions: [
            { id: 'request_housing_lease_support', label: 'Request residential leasing support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete leasing intake' },
            { id: 'record_case_update', label: 'Record lease status update' }
          ]
        },
        cornerstone_property_management: {
          selfActions: [
            { id: 'request_property_management_support', label: 'Request residential property management support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete property management intake' },
            { id: 'record_case_update', label: 'Record property support update' }
          ]
        },
        summit_health_insurance_carrier: {
          selfActions: [
            { id: 'request_health_insurance_support', label: 'Request health insurance enrollment support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete insurance enrollment intake' },
            { id: 'record_case_update', label: 'Record coverage and claims update' }
          ]
        },
        atlas_claims_administration: {
          selfActions: [
            { id: 'request_claims_assistance', label: 'Request insurance claims assistance' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete claims administration intake' },
            { id: 'record_case_update', label: 'Record claims processing update' }
          ]
        },
        sunrise_child_day_center: {
          selfActions: [
            { id: 'request_child_care_support', label: 'Request child day care support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete child care intake' },
            { id: 'record_case_update', label: 'Record child care support update' }
          ]
        },
        youthpath_child_services: {
          selfActions: [
            { id: 'request_child_youth_support', label: 'Request child and youth services support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete child and youth services intake' },
            { id: 'record_case_update', label: 'Record child and youth services update' }
          ]
        },
        beacon_emergency_relief_services: {
          selfActions: [
            { id: 'request_emergency_relief_support', label: 'Request emergency relief support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete emergency relief intake' },
            { id: 'record_case_update', label: 'Record emergency relief update' }
          ]
        },
        horizon_residential_recovery_center: {
          selfActions: [
            { id: 'request_residential_recovery_support', label: 'Request residential recovery support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete residential recovery intake' },
            { id: 'record_case_update', label: 'Record residential recovery treatment update' }
          ]
        },
        highland_workforce_training_institute: {
          selfActions: [
            { id: 'request_workforce_training_support', label: 'Request workforce training support' }
          ],
          staffActions: [
            { id: 'complete_service_intake', label: 'Complete workforce training intake' },
            { id: 'record_case_update', label: 'Record workforce training progress update' }
          ]
        }
      };
  const pathwayActionExtensions = {
        nolichucky_family_clinic: [
          { id: 'issue_insurance_eligibility_referral', label: 'Issue insurance eligibility referral' },
          { id: 'issue_pharmacy_referral', label: 'Issue pharmacy fulfillment referral' }
        ],
        summitview_emergency_department: [
          { id: 'issue_insurance_eligibility_referral', label: 'Issue insurance eligibility referral' },
          { id: 'issue_pharmacy_referral', label: 'Issue pharmacy fulfillment referral' },
          { id: 'issue_home_health_referral', label: 'Issue home health follow-up referral' }
        ],
        tri_county_ambulance: [
          { id: 'issue_emergency_handoff_referral', label: 'Issue emergency handoff referral to hospital' }
        ],
        summit_health_insurance_carrier: [
          { id: 'issue_claims_admin_referral', label: 'Issue claims administration referral' }
        ],
        atlas_claims_administration: [
          { id: 'issue_claims_status_referral', label: 'Issue claims status referral back to care provider' }
        ],
        ridgeview_behavioral_health_center: [
          { id: 'issue_residential_recovery_referral', label: 'Issue residential recovery referral' }
        ],
        horizon_residential_recovery_center: [
          { id: 'issue_outpatient_behavioral_referral', label: 'Issue outpatient behavioral follow-up referral' }
        ],
        safeharbor_shelter: [
          { id: 'issue_housing_placement_referral', label: 'Issue housing placement referral' }
        ],
        salutation_army: [
          { id: 'issue_shelter_access_referral', label: 'Issue shelter access referral' }
        ],
        beacon_emergency_relief_services: [
          { id: 'issue_shelter_access_referral', label: 'Issue shelter access referral' }
        ],
        fairmannor_house: [
          { id: 'issue_housing_placement_referral', label: 'Issue housing placement referral' }
        ],
        homestead_residential_leasing: [
          { id: 'issue_property_management_referral', label: 'Issue property management referral' }
        ],
        cornerstone_property_management: [
          { id: 'issue_utility_setup_referral', label: 'Issue utility setup referral' }
        ],
        sunrise_child_day_center: [
          { id: 'issue_workforce_training_referral', label: 'Issue workforce training referral' }
        ],
        highland_workforce_training_institute: [
          { id: 'issue_employment_placement_referral', label: 'Issue employment placement referral' }
        ],
        community_legal_aid_collective: [
          { id: 'issue_insurance_dispute_referral', label: 'Issue insurance dispute referral' },
          { id: 'issue_consumer_protection_referral', label: 'Issue consumer protection referral' }
        ],
        valley_notary_office: [
          { id: 'issue_insurance_dispute_referral', label: 'Issue insurance dispute referral' },
          { id: 'issue_consumer_protection_referral', label: 'Issue consumer protection referral' }
        ],
        dignity_human_rights_organization: [
          { id: 'issue_insurance_dispute_referral', label: 'Issue insurance dispute referral' },
          { id: 'issue_consumer_protection_referral', label: 'Issue consumer protection referral' }
        ],
        appalachian_electric_distribution: [
          { id: 'issue_residency_evidence_credential', label: 'Issue utility residency evidence credential' }
        ],
        blue_river_natural_gas_utility: [
          { id: 'issue_residency_evidence_credential', label: 'Issue utility residency evidence credential' }
        ],
        clearwater_public_water_utility: [
          { id: 'issue_residency_evidence_credential', label: 'Issue utility residency evidence credential' }
        ]
      };
  const referralActionCatalog = {
        issue_imaging_referral: {
          targetCapability: 'imaging',
          summary: 'Imaging referral for X-ray or ultrasound fulfillment',
          referralPurpose: 'diagnostic-imaging',
          fulfillableBy: 'any-qualified-imaging-provider',
          credentialType: 'ImagingReferralCredential',
          eventLabel: 'imaging'
        },
        issue_insurance_eligibility_referral: {
          targetCapability: 'insurance-enrollment',
          summary: 'Insurance eligibility referral for coverage and prior authorization review',
          referralPurpose: 'insurance-eligibility',
          fulfillableBy: 'insurance-carrier',
          credentialType: 'InsuranceEligibilityReferralCredential',
          eventLabel: 'insurance eligibility'
        },
        issue_claims_admin_referral: {
          targetCapability: 'claims-processing',
          summary: 'Claims administration referral for submission and adjudication',
          referralPurpose: 'claims-administration',
          fulfillableBy: 'claims-administration-provider',
          credentialType: 'ClaimsAdministrationReferralCredential',
          eventLabel: 'claims administration'
        },
        issue_claims_status_referral: {
          targetCapability: 'medical-records',
          summary: 'Claims status return referral to originating care provider',
          referralPurpose: 'claims-status-return',
          fulfillableBy: 'originating-care-provider',
          credentialType: 'ClaimsStatusReturnReferralCredential',
          eventLabel: 'claims status return'
        },
        issue_pharmacy_referral: {
          targetCapability: 'pharmacy-services',
          summary: 'Prescription fulfillment referral to pharmacy',
          referralPurpose: 'prescription-fulfillment',
          fulfillableBy: 'pharmacy-provider',
          credentialType: 'PrescriptionReferralCredential',
          eventLabel: 'pharmacy'
        },
        issue_home_health_referral: {
          targetCapability: 'home-health',
          summary: 'Home health referral for post-discharge continuity',
          referralPurpose: 'home-health-follow-up',
          fulfillableBy: 'home-health-provider',
          credentialType: 'HomeHealthReferralCredential',
          eventLabel: 'home health'
        },
        issue_emergency_handoff_referral: {
          targetCapability: 'emergency-care',
          summary: 'Emergency handoff referral from ambulance to hospital ED',
          referralPurpose: 'emergency-handoff',
          fulfillableBy: 'emergency-department',
          credentialType: 'EmergencyHandoffReferralCredential',
          eventLabel: 'emergency handoff'
        },
        issue_residential_recovery_referral: {
          targetCapability: 'residential-treatment',
          summary: 'Behavioral health escalation referral to residential recovery',
          referralPurpose: 'residential-recovery-escalation',
          fulfillableBy: 'residential-recovery-provider',
          credentialType: 'ResidentialRecoveryReferralCredential',
          eventLabel: 'residential recovery'
        },
        issue_outpatient_behavioral_referral: {
          targetCapability: 'behavioral-health',
          summary: 'Residential step-down referral to outpatient behavioral health',
          referralPurpose: 'outpatient-behavioral-step-down',
          fulfillableBy: 'outpatient-behavioral-provider',
          credentialType: 'OutpatientBehavioralReferralCredential',
          eventLabel: 'outpatient behavioral follow-up'
        },
        issue_housing_placement_referral: {
          targetCapability: 'housing-access',
          summary: 'Housing placement referral to leasing provider',
          referralPurpose: 'housing-placement',
          fulfillableBy: 'housing-leasing-provider',
          credentialType: 'HousingPlacementReferralCredential',
          eventLabel: 'housing placement'
        },
        issue_shelter_access_referral: {
          targetCapability: 'shelter-access',
          summary: 'Outreach handoff referral for emergency shelter access',
          referralPurpose: 'outreach-to-shelter-access',
          fulfillableBy: 'emergency-shelter-provider',
          credentialType: 'ShelterAccessReferralCredential',
          eventLabel: 'shelter access'
        },
        issue_property_management_referral: {
          targetCapability: 'housing-stability',
          summary: 'Property management referral for move-in and stabilization support',
          referralPurpose: 'property-management-handoff',
          fulfillableBy: 'property-management-provider',
          credentialType: 'PropertyManagementReferralCredential',
          eventLabel: 'property management'
        },
        issue_utility_setup_referral: {
          targetCapability: 'utility-service',
          summary: 'Utility setup referral for residential service activation',
          referralPurpose: 'utility-setup',
          fulfillableBy: 'utility-provider',
          credentialType: 'UtilitySetupReferralCredential',
          eventLabel: 'utility setup'
        },
        issue_workforce_training_referral: {
          targetCapability: 'workforce-training',
          summary: 'Workforce training referral for job readiness services',
          referralPurpose: 'workforce-training-enrollment',
          fulfillableBy: 'workforce-training-provider',
          credentialType: 'WorkforceTrainingReferralCredential',
          eventLabel: 'workforce training'
        },
        issue_employment_placement_referral: {
          targetCapability: 'employment-support',
          summary: 'Employment placement referral for job matching and placement',
          referralPurpose: 'employment-placement',
          fulfillableBy: 'employment-placement-provider',
          credentialType: 'EmploymentPlacementReferralCredential',
          eventLabel: 'employment placement'
        },
        issue_consumer_protection_referral: {
          targetCapability: 'consumer-protection',
          summary: 'Consumer protection referral for complaint and rights advocacy',
          referralPurpose: 'consumer-protection-case',
          fulfillableBy: 'consumer-protection-provider',
          credentialType: 'ConsumerProtectionReferralCredential',
          eventLabel: 'consumer protection'
        },
        issue_insurance_dispute_referral: {
          targetCapability: 'claims-processing',
          summary: 'Insurance dispute referral for claim review and appeal support',
          referralPurpose: 'insurance-dispute',
          fulfillableBy: 'claims-administration-provider',
          credentialType: 'InsuranceDisputeReferralCredential',
          eventLabel: 'insurance dispute'
        }
      };
  const directCredentialActionCatalog = {
        issue_residency_evidence_credential: {
          summary: 'Issued utility residency evidence credential for downstream proof-of-residency verification',
          category: 'credential_issuance',
          credentialType: 'UtilityResidencyEvidenceCredential'
        }
      };
  const fulfillmentOutcomeByCapability = {
        imaging: {
          category: 'imaging_result',
          summary: 'Imaging referral fulfilled and results recorded',
          credentialType: 'ImagingResultCredential'
        },
        'insurance-enrollment': {
          category: 'insurance_eligibility',
          summary: 'Insurance eligibility referral fulfilled and coverage status recorded',
          credentialType: 'InsuranceEligibilityCredential'
        },
        'claims-processing': {
          category: 'claims_processing',
          summary: 'Claims administration referral fulfilled and claim status recorded',
          credentialType: 'ClaimsProcessingCredential'
        },
        'medical-records': {
          category: 'claims_status_return',
          summary: 'Claims status referral returned to care provider record',
          credentialType: 'ClaimsStatusCredential'
        },
        'pharmacy-services': {
          category: 'prescription_fulfillment',
          summary: 'Pharmacy referral fulfilled and medication support recorded',
          credentialType: 'PrescriptionFulfillmentCredential'
        },
        'home-health': {
          category: 'home_health_referral',
          summary: 'Home health referral fulfilled and care continuity recorded',
          credentialType: 'HomeHealthServiceCredential'
        },
        'emergency-care': {
          category: 'emergency_handoff',
          summary: 'Emergency handoff referral fulfilled at receiving provider',
          credentialType: 'EmergencyHandoffCredential'
        },
        'behavioral-health': {
          category: 'behavioral_followup',
          summary: 'Outpatient behavioral follow-up referral fulfilled',
          credentialType: 'BehavioralHealthFollowupCredential'
        },
        'residential-treatment': {
          category: 'residential_recovery',
          summary: 'Residential recovery referral fulfilled and admission recorded',
          credentialType: 'ResidentialRecoveryCredential'
        },
        'housing-access': {
          category: 'housing_access',
          summary: 'Housing placement referral fulfilled and placement status recorded',
          credentialType: 'HousingPlacementCredential'
        },
        'housing-stability': {
          category: 'housing_stability',
          summary: 'Property management referral fulfilled and stabilization support recorded',
          credentialType: 'HousingStabilityCredential'
        },
        'utility-service': {
          category: 'utility_activation',
          summary: 'Utility setup referral fulfilled and service activation recorded',
          credentialType: 'UtilityServiceActivationCredential'
        },
        'workforce-training': {
          category: 'workforce_training',
          summary: 'Workforce training referral fulfilled and enrollment recorded',
          credentialType: 'WorkforceTrainingCredential'
        },
        'employment-support': {
          category: 'employment_placement',
          summary: 'Employment placement referral fulfilled and placement activity recorded',
          credentialType: 'EmploymentPlacementCredential'
        },
        'consumer-protection': {
          category: 'consumer_protection',
          summary: 'Consumer protection referral fulfilled and case activity recorded',
          credentialType: 'ConsumerProtectionCaseCredential'
        }
      };
  const selfActionRequirementProfiles = {
        safety_first: {
          summary: 'Safety-first request: this service can start even if documents are not ready yet.',
          groups: []
        },
        identity_only: {
          summary: 'This request requires a valid identity credential.',
          groups: ['government_id']
        },
        identity_and_residency: {
          summary: 'This request requires identity and residency proof credentials.',
          groups: ['government_id', 'proof_of_residency']
        },
        identity_and_social_security: {
          summary: 'This request requires identity and social security credentials.',
          groups: ['government_id', 'social_security']
        },
        identity_residency_social_security: {
          summary: 'This request requires identity, residency proof, and social security credentials.',
          groups: ['government_id', 'proof_of_residency', 'social_security']
        }
      };
  const selfActionRequirementProfileById = {
        arrive_any: 'identity_only',
        check_in_walk_in: 'identity_only',
        request_treatment: 'identity_only',
        request_xray: 'identity_only',
        request_ultrasound: 'identity_only',
        request_lab_testing_support: 'identity_only',
        request_prescription_support: 'identity_only',
        request_home_health_support: 'identity_only',
        request_behavioral_health_intake: 'identity_only',
        request_residential_recovery_support: 'identity_only',
        request_disability_support: 'identity_only',
        request_vocational_rehab_support: 'identity_only',
        request_child_care_support: 'identity_only',
        request_workforce_training_support: 'identity_only',
        request_job_placement_support: 'identity_only',
        request_temp_work_support: 'identity_only',
        request_document_preparation_support: 'identity_only',
        request_education_support: 'identity_only',
        request_family_support: 'identity_only',
        request_family_mediation: 'identity_only',
        request_child_youth_support: 'identity_only',
        request_community_assistance: 'identity_only',
        request_legal_navigation: 'identity_only',
        request_tenant_rights_support: 'identity_only',
        request_legal_family_support: 'identity_only',
        request_legal_aid_intake: 'identity_only',
        request_money_management: 'identity_only',
        request_tax_support: 'identity_only',
        request_consumer_regulation_support: 'identity_only',
        request_human_rights_support: 'identity_only',
        request_notary_appointment: 'identity_only',
        request_insurance_navigation: 'identity_only',
        request_dental_care_support: 'identity_only',
        request_utility_service_support: 'identity_and_residency',
        request_wireless_service_support: 'identity_and_residency',
        request_electrical_service_support: 'identity_and_residency',
        request_plumbing_hvac_service_support: 'identity_and_residency',
        request_housing_lease_support: 'identity_and_residency',
        request_property_management_support: 'identity_and_residency',
        request_health_insurance_support: 'identity_and_social_security',
        request_claims_assistance: 'identity_and_social_security',
        request_credit_union_intake: 'identity_residency_social_security',
        request_emergency_care: 'safety_first',
        request_emergency_transport: 'safety_first',
        request_shelter_bed: 'safety_first',
        request_food_assistance: 'safety_first',
        request_emergency_relief_support: 'safety_first',
        request_prevention_intake: 'safety_first',
        request_help: 'safety_first'
      };

  if (typeof window !== "undefined") {
    window.SovereignProviderBehavior = Object.freeze({
      configMap,
      pathwayActionExtensions,
      referralActionCatalog,
      directCredentialActionCatalog,
      fulfillmentOutcomeByCapability,
      selfActionRequirementProfiles,
      selfActionRequirementProfileById
    });
  }
})();
