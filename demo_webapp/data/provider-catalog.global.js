(function () {
  const providerCatalog = [
    {
      id: 'nolichucky_family_clinic',
      did: 'did:web:demo.sovereign.ngo:provider:nolichucky_family_clinic',
      label: 'Nolichucky Family Clinic (621111 - Offices of Physicians)',
      type: 'primary-care',
      taxonomies: {
        naics: '621111 - Offices of Physicians',
        airs211: 'Health Care - Primary Care Services'
      },
      capabilities: ['primary-care', 'medical-records', 'referral-source']
    },
    {
      id: 'riverbend_dental_clinic',
      did: 'did:web:demo.sovereign.ngo:provider:riverbend_dental_clinic',
      label: 'Riverbend Dental Clinic (621210 - Offices of Dentists)',
      type: 'dental-care-services',
      taxonomies: {
        naics: '621210 - Offices of Dentists',
        airs211: 'Health Care - Dental Care'
      },
      capabilities: ['dental-care', 'medical-records', 'referral-fulfillment']
    },
    {
      id: 'riverstone_radiology_center',
      did: 'did:web:demo.sovereign.ngo:provider:riverstone_radiology_center',
      label: 'Riverstone Radiology Center (621512 - Diagnostic Imaging Centers)',
      type: 'imaging-services',
      taxonomies: {
        naics: '621512 - Diagnostic Imaging Centers',
        airs211: 'Health Care - Diagnostic Imaging Services'
      },
      capabilities: ['imaging', 'xray', 'ultrasound', 'referral-fulfillment']
    },
    {
      id: 'summitview_emergency_department',
      did: 'did:web:demo.sovereign.ngo:provider:summitview_emergency_department',
      label: 'Summitview Emergency Department (622110 - General Medical and Surgical Hospitals)',
      type: 'acute-emergency-care',
      taxonomies: {
        naics: '622110 - General Medical and Surgical Hospitals',
        airs211: 'Health Care - Emergency Medical Services'
      },
      capabilities: ['emergency-care', 'medical-records']
    },
    {
      id: 'fairmannor_house',
      did: 'did:web:demo.sovereign.ngo:provider:fairmannor_house',
      label: 'FairMannor House (624229 - Other Community Housing Services)',
      type: 'homelessness-prevention',
      taxonomies: {
        naics: '624229 - Other Community Housing Services',
        airs211: 'Individual and Family Life - Housing Stability Services',
        hudHmis: 'Homelessness Prevention'
      },
      capabilities: ['prevention-intake', 'housing-coordination']
    },
    {
      id: 'safeharbor_shelter',
      did: 'did:web:demo.sovereign.ngo:provider:safeharbor_shelter',
      label: 'SafeHarbor Shelter (624221 - Temporary Shelters)',
      type: 'emergency-shelter',
      taxonomies: {
        naics: '624221 - Temporary Shelters',
        airs211: 'Basic Needs - Emergency Shelter',
        hudHmis: 'Emergency Shelter'
      },
      capabilities: ['shelter-access', 'housing-coordination']
    },
    {
      id: 'community_food_pantry',
      did: 'did:web:demo.sovereign.ngo:provider:community_food_pantry',
      label: 'Community Food Pantry (624210 - Community Food Services)',
      type: 'food-assistance',
      taxonomies: {
        naics: '624210 - Community Food Services',
        airs211: 'Basic Needs - Food Pantries'
      },
      capabilities: ['food-assistance', 'community-assistance']
    },
    {
      id: 'bridgeway_family_services',
      did: 'did:web:demo.sovereign.ngo:provider:bridgeway_family_services',
      label: 'Bridgeway Family Services (624190 - Other Individual and Family Services)',
      type: 'family-stabilization',
      taxonomies: {
        naics: '624190 - Other Individual and Family Services',
        airs211: 'Individual and Family Life - Family Support Services',
        hudHmis: 'Coordinated Entry / Services Only'
      },
      capabilities: ['family-support', 'stabilization']
    },
    {
      id: 'family_mediation_center',
      did: 'did:web:demo.sovereign.ngo:provider:family_mediation_center',
      label: 'Family Mediation Center (624190 - Other Individual and Family Services)',
      type: 'family-mediation',
      taxonomies: {
        naics: '624190 - Other Individual and Family Services',
        airs211: 'Individual and Family Life - Family Counseling'
      },
      capabilities: ['family-support', 'mediation', 'stabilization']
    },
    {
      id: 'salutation_army',
      did: 'did:web:demo.sovereign.ngo:provider:salutation_army',
      label: 'Salutation Army (624190 - Other Individual and Family Services)',
      type: 'community-assistance',
      taxonomies: {
        naics: '624190 - Other Individual and Family Services',
        airs211: 'Basic Needs - Outreach and Material Assistance',
        hudHmis: 'Street Outreach / Services Only'
      },
      capabilities: ['community-assistance', 'outreach']
    },
    {
      id: 'pioneer_legal_benefits_navigation',
      did: 'did:web:demo.sovereign.ngo:provider:pioneer_legal_benefits_navigation',
      label: 'Pioneer Legal and Benefits Navigation (541110 - Offices of Lawyers)',
      type: 'legal-and-benefits-navigation',
      taxonomies: {
        naics: '541110 - Offices of Lawyers',
        airs211: 'Criminal Justice and Legal Services - Legal Representation and Legal Counseling'
      },
      capabilities: ['benefits-navigation', 'legal-aid']
    },
    {
      id: 'tenant_rights_advocacy_network',
      did: 'did:web:demo.sovereign.ngo:provider:tenant_rights_advocacy_network',
      label: 'Tenant Rights Advocacy Network (813319 - Other Social Advocacy Organizations)',
      type: 'legal-advocacy',
      taxonomies: {
        naics: '813319 - Other Social Advocacy Organizations',
        airs211: 'Criminal Justice and Legal Services - Legal Advocacy and Tenant Rights Support'
      },
      capabilities: ['legal-aid', 'benefits-navigation', 'housing-coordination']
    },
    {
      id: 'community_legal_family_support',
      did: 'did:web:demo.sovereign.ngo:provider:community_legal_family_support',
      label: 'Community Legal and Family Support Services (624190 - Other Individual and Family Services)',
      type: 'legal-family-support',
      taxonomies: {
        naics: '624190 - Other Individual and Family Services',
        airs211: 'Criminal Justice and Legal Services - Legal Navigation and Family Support'
      },
      capabilities: ['legal-aid', 'benefits-navigation', 'family-support']
    },
    {
      id: 'financial_wellness_center',
      did: 'did:web:demo.sovereign.ngo:provider:financial_wellness_center',
      label: 'Financial Wellness Center (523930 - Investment Advice)',
      type: 'money-management',
      taxonomies: {
        naics: '523930 - Investment Advice',
        airs211: 'Consumer Services - Money Management'
      },
      capabilities: ['financial-counseling', 'benefits-navigation']
    },
    {
      id: 'community_tax_services',
      did: 'did:web:demo.sovereign.ngo:provider:community_tax_services',
      label: 'Community Tax Services (541213 - Tax Preparation Services)',
      type: 'tax-services',
      taxonomies: {
        naics: '541213 - Tax Preparation Services',
        airs211: 'Consumer Services - Tax Organizations and Services'
      },
      capabilities: ['document-assistance', 'benefits-navigation']
    },
    {
      id: 'consumer_regulation_support',
      did: 'did:web:demo.sovereign.ngo:provider:consumer_regulation_support',
      label: 'Consumer Regulation Support Office (813319 - Other Social Advocacy Organizations)',
      type: 'consumer-regulation',
      taxonomies: {
        naics: '813319 - Other Social Advocacy Organizations',
        airs211: 'Consumer Services - Consumer Regulation and Consumer Protection'
      },
      capabilities: ['community-assistance', 'legal-aid', 'benefits-navigation', 'consumer-protection']
    },
    {
      id: 'commonwealth_credit_union',
      did: 'did:web:demo.sovereign.ngo:provider:commonwealth_credit_union',
      label: 'Commonwealth Credit Union (522130 - Credit Unions)',
      type: 'credit-union-services',
      taxonomies: {
        naics: '522130 - Credit Unions',
        airs211: 'Income Support and Employment - Credit Unions and Financial Access'
      },
      capabilities: ['financial-counseling', 'benefits-navigation', 'community-assistance']
    },
    {
      id: 'neighborhood_insurance_brokers',
      did: 'did:web:demo.sovereign.ngo:provider:neighborhood_insurance_brokers',
      label: 'Neighborhood Insurance Brokers (524210 - Insurance Agencies and Brokerages)',
      type: 'insurance-brokerage',
      taxonomies: {
        naics: '524210 - Insurance Agencies and Brokerages',
        airs211: 'Income Support and Employment - Insurance Counseling and Access'
      },
      capabilities: ['benefits-navigation', 'document-assistance', 'community-assistance']
    },
    {
      id: 'valley_notary_office',
      did: 'did:web:demo.sovereign.ngo:provider:valley_notary_office',
      label: 'Valley Notary Office (541120 - Offices of Notaries)',
      type: 'notary-services',
      taxonomies: {
        naics: '541120 - Offices of Notaries',
        airs211: 'Criminal Justice and Legal Services - Notary and Document Certification'
      },
      capabilities: ['document-assistance', 'legal-aid']
    },
    {
      id: 'community_legal_aid_collective',
      did: 'did:web:demo.sovereign.ngo:provider:community_legal_aid_collective',
      label: 'Community Legal Aid Collective (541199 - All Other Legal Services)',
      type: 'legal-aid-services',
      taxonomies: {
        naics: '541199 - All Other Legal Services',
        airs211: 'Criminal Justice and Legal Services - Legal Aid and Representation'
      },
      capabilities: ['legal-aid', 'benefits-navigation']
    },
    {
      id: 'ascent_employment_placement_agency',
      did: 'did:web:demo.sovereign.ngo:provider:ascent_employment_placement_agency',
      label: 'Ascent Employment Placement Agency (561311 - Employment Placement Agencies)',
      type: 'employment-placement',
      taxonomies: {
        naics: '561311 - Employment Placement Agencies',
        airs211: 'Employment - Employment Agencies'
      },
      capabilities: ['employment-support', 'benefits-navigation']
    },
    {
      id: 'rapid_response_temporary_help',
      did: 'did:web:demo.sovereign.ngo:provider:rapid_response_temporary_help',
      label: 'Rapid Response Temporary Help (561320 - Temporary Help Services)',
      type: 'temporary-help-services',
      taxonomies: {
        naics: '561320 - Temporary Help Services',
        airs211: 'Employment - Temporary Employment'
      },
      capabilities: ['employment-support', 'community-assistance']
    },
    {
      id: 'cedar_document_preparation_center',
      did: 'did:web:demo.sovereign.ngo:provider:cedar_document_preparation_center',
      label: 'Cedar Document Preparation Center (561410 - Document Preparation Services)',
      type: 'document-preparation-services',
      taxonomies: {
        naics: '561410 - Document Preparation Services',
        airs211: 'Consumer Services - Document Preparation and Filing'
      },
      capabilities: ['document-assistance', 'benefits-navigation', 'consumer-protection']
    },
    {
      id: 'brightpath_educational_support_center',
      did: 'did:web:demo.sovereign.ngo:provider:brightpath_educational_support_center',
      label: 'BrightPath Educational Support Center (611710 - Educational Support Services)',
      type: 'educational-support-services',
      taxonomies: {
        naics: '611710 - Educational Support Services',
        airs211: 'Education - Educational Support Services'
      },
      capabilities: ['education-support', 'document-assistance']
    },
    {
      id: 'ridgeview_behavioral_health_center',
      did: 'did:web:demo.sovereign.ngo:provider:ridgeview_behavioral_health_center',
      label: 'Ridgeview Behavioral Health Center (621420 - Outpatient Mental Health and Substance Abuse Centers)',
      type: 'outpatient-behavioral-health',
      taxonomies: {
        naics: '621420 - Outpatient Mental Health and Substance Abuse Centers',
        airs211: 'Mental Health and Substance Use Services - Outpatient Treatment'
      },
      capabilities: ['behavioral-health', 'mental-health-support', 'care-continuity']
    },
    {
      id: 'bluepeak_medical_laboratory',
      did: 'did:web:demo.sovereign.ngo:provider:bluepeak_medical_laboratory',
      label: 'BluePeak Medical Laboratory (621511 - Medical Laboratories)',
      type: 'medical-laboratory-services',
      taxonomies: {
        naics: '621511 - Medical Laboratories',
        airs211: 'Health Care - Medical Laboratory Services'
      },
      capabilities: ['medical-labs', 'diagnostics', 'referral-fulfillment']
    },
    {
      id: 'caringhands_home_health',
      did: 'did:web:demo.sovereign.ngo:provider:caringhands_home_health',
      label: 'CaringHands Home Health (621610 - Home Health Care Services)',
      type: 'home-health-care',
      taxonomies: {
        naics: '621610 - Home Health Care Services',
        airs211: 'Health Care - Home Health Care'
      },
      capabilities: ['home-health', 'care-continuity', 'medical-records']
    },
    {
      id: 'tri_county_ambulance',
      did: 'did:web:demo.sovereign.ngo:provider:tri_county_ambulance',
      label: 'Tri-County Ambulance (621911 - Ambulance Services)',
      type: 'ambulance-services',
      taxonomies: {
        naics: '621911 - Ambulance Services',
        airs211: 'Health Care - Ambulance and Emergency Transport'
      },
      capabilities: ['emergency-transport', 'emergency-care', 'care-continuity']
    },
    {
      id: 'foothills_disability_support_services',
      did: 'did:web:demo.sovereign.ngo:provider:foothills_disability_support_services',
      label: 'Foothills Disability Support Services (624120 - Services for the Elderly and Persons with Disabilities)',
      type: 'disability-support-services',
      taxonomies: {
        naics: '624120 - Services for the Elderly and Persons with Disabilities',
        airs211: 'Individual and Family Life - Disability-Related Supports'
      },
      capabilities: ['disability-support', 'community-assistance', 'case-management']
    },
    {
      id: 'pathway_vocational_rehabilitation',
      did: 'did:web:demo.sovereign.ngo:provider:pathway_vocational_rehabilitation',
      label: 'Pathway Vocational Rehabilitation (624310 - Vocational Rehabilitation Services)',
      type: 'vocational-rehabilitation',
      taxonomies: {
        naics: '624310 - Vocational Rehabilitation Services',
        airs211: 'Employment - Vocational Rehabilitation'
      },
      capabilities: ['vocational-rehab', 'employment-support', 'benefits-navigation']
    },
    {
      id: 'dignity_human_rights_organization',
      did: 'did:web:demo.sovereign.ngo:provider:dignity_human_rights_organization',
      label: 'Dignity Human Rights Organization (813311 - Human Rights Organizations)',
      type: 'human-rights-advocacy',
      taxonomies: {
        naics: '813311 - Human Rights Organizations',
        airs211: 'Criminal Justice and Legal Services - Human Rights Advocacy'
      },
      capabilities: ['human-rights-advocacy', 'legal-aid', 'community-assistance']
    },
    {
      id: 'appalachian_electric_distribution',
      did: 'did:web:demo.sovereign.ngo:provider:appalachian_electric_distribution',
      label: 'Appalachian Electric Distribution (221122 - Electric Power Distribution)',
      type: 'electric-utility-services',
      taxonomies: {
        naics: '221122 - Electric Power Distribution',
        airs211: 'Basic Needs - Utility Service Support'
      },
      capabilities: ['utility-service', 'document-assistance', 'community-assistance']
    },
    {
      id: 'holston_wireless_carrier',
      did: 'did:web:demo.sovereign.ngo:provider:holston_wireless_carrier',
      label: 'Holston Wireless Carrier (517312 - Wireless Telecommunications Carriers (except Satellite))',
      type: 'wireless-telecommunications-services',
      taxonomies: {
        naics: '517312 - Wireless Telecommunications Carriers (except Satellite)',
        airs211: 'Consumer Services - Telecommunications Services'
      },
      capabilities: ['telecommunications-service', 'document-assistance', 'community-assistance']
    },
    {
      id: 'blue_river_natural_gas_utility',
      did: 'did:web:demo.sovereign.ngo:provider:blue_river_natural_gas_utility',
      label: 'Blue River Natural Gas Utility (221210 - Natural Gas Distribution)',
      type: 'natural-gas-utility-services',
      taxonomies: {
        naics: '221210 - Natural Gas Distribution',
        airs211: 'Basic Needs - Utility Service Support'
      },
      capabilities: ['utility-service', 'community-assistance']
    },
    {
      id: 'volunteer_electrical_contractors',
      did: 'did:web:demo.sovereign.ngo:provider:volunteer_electrical_contractors',
      label: 'Volunteer Electrical Contractors (238210 - Electrical Contractors and Other Wiring Installation Contractors)',
      type: 'electrical-contractor-services',
      taxonomies: {
        naics: '238210 - Electrical Contractors and Other Wiring Installation Contractors',
        airs211: 'Housing and Shelter - Home Repair and Maintenance'
      },
      capabilities: ['home-repair', 'housing-stability', 'utility-service']
    },
    {
      id: 'foothills_plumbing_hvac_contractors',
      did: 'did:web:demo.sovereign.ngo:provider:foothills_plumbing_hvac_contractors',
      label: 'Foothills Plumbing, Heating, and Air Contractors (238220 - Plumbing, Heating, and Air-Conditioning Contractors)',
      type: 'plumbing-hvac-contractor-services',
      taxonomies: {
        naics: '238220 - Plumbing, Heating, and Air-Conditioning Contractors',
        airs211: 'Housing and Shelter - Home Repair and Maintenance'
      },
      capabilities: ['home-repair', 'housing-stability', 'utility-service']
    },
    {
      id: 'clearwater_public_water_utility',
      did: 'did:web:demo.sovereign.ngo:provider:clearwater_public_water_utility',
      label: 'Clearwater Public Water Utility (221310 - Water Supply and Irrigation Systems)',
      type: 'water-utility-services',
      taxonomies: {
        naics: '221310 - Water Supply and Irrigation Systems',
        airs211: 'Basic Needs - Utility Service Support'
      },
      capabilities: ['utility-service', 'community-assistance']
    },
    {
      id: 'mainstreet_community_pharmacy',
      did: 'did:web:demo.sovereign.ngo:provider:mainstreet_community_pharmacy',
      label: 'MainStreet Community Pharmacy (446110 - Pharmacies and Drug Stores)',
      type: 'pharmacy-services',
      taxonomies: {
        naics: '446110 - Pharmacies and Drug Stores',
        airs211: 'Health Care - Prescription Medication Services'
      },
      capabilities: ['pharmacy-services', 'medication-dispensing', 'care-continuity']
    },
    {
      id: 'homestead_residential_leasing',
      did: 'did:web:demo.sovereign.ngo:provider:homestead_residential_leasing',
      label: 'Homestead Residential Leasing (531110 - Lessors of Residential Buildings and Dwellings)',
      type: 'residential-leasing-services',
      taxonomies: {
        naics: '531110 - Lessors of Residential Buildings and Dwellings',
        airs211: 'Individual and Family Life - Housing Access Services'
      },
      capabilities: ['housing-access', 'housing-coordination']
    },
    {
      id: 'cornerstone_property_management',
      did: 'did:web:demo.sovereign.ngo:provider:cornerstone_property_management',
      label: 'Cornerstone Property Management (531311 - Residential Property Managers)',
      type: 'property-management-services',
      taxonomies: {
        naics: '531311 - Residential Property Managers',
        airs211: 'Individual and Family Life - Housing Stability Services'
      },
      capabilities: ['housing-stability', 'housing-coordination']
    },
    {
      id: 'summit_health_insurance_carrier',
      did: 'did:web:demo.sovereign.ngo:provider:summit_health_insurance_carrier',
      label: 'Summit Health Insurance Carrier (524114 - Direct Health and Medical Insurance Carriers)',
      type: 'health-insurance-carrier-services',
      taxonomies: {
        naics: '524114 - Direct Health and Medical Insurance Carriers',
        airs211: 'Income Support and Employment - Health Insurance Coverage'
      },
      capabilities: ['insurance-enrollment', 'benefits-navigation']
    },
    {
      id: 'atlas_claims_administration',
      did: 'did:web:demo.sovereign.ngo:provider:atlas_claims_administration',
      label: 'Atlas Claims Administration (524292 - Third Party Administration of Insurance and Pension Funds)',
      type: 'claims-administration-services',
      taxonomies: {
        naics: '524292 - Third Party Administration of Insurance and Pension Funds',
        airs211: 'Consumer Services - Insurance Claims and Benefit Administration'
      },
      capabilities: ['claims-processing', 'benefits-navigation', 'document-assistance']
    },
    {
      id: 'sunrise_child_day_center',
      did: 'did:web:demo.sovereign.ngo:provider:sunrise_child_day_center',
      label: 'Sunrise Child Day Center (624410 - Child Day Care Services)',
      type: 'child-day-care-services',
      taxonomies: {
        naics: '624410 - Child Day Care Services',
        airs211: 'Individual and Family Life - Child Care Services'
      },
      capabilities: ['child-care', 'family-support']
    },
    {
      id: 'youthpath_child_services',
      did: 'did:web:demo.sovereign.ngo:provider:youthpath_child_services',
      label: 'YouthPath Child and Youth Services (624110 - Child and Youth Services)',
      type: 'child-youth-services',
      taxonomies: {
        naics: '624110 - Child and Youth Services',
        airs211: 'Individual and Family Life - Child and Youth Services'
      },
      capabilities: ['child-youth-support', 'family-support', 'case-management']
    },
    {
      id: 'beacon_emergency_relief_services',
      did: 'did:web:demo.sovereign.ngo:provider:beacon_emergency_relief_services',
      label: 'Beacon Emergency Relief Services (624230 - Emergency and Other Relief Services)',
      type: 'emergency-relief-services',
      taxonomies: {
        naics: '624230 - Emergency and Other Relief Services',
        airs211: 'Basic Needs - Emergency Relief Services'
      },
      capabilities: ['emergency-relief', 'community-assistance']
    },
    {
      id: 'horizon_residential_recovery_center',
      did: 'did:web:demo.sovereign.ngo:provider:horizon_residential_recovery_center',
      label: 'Horizon Residential Recovery Center (623220 - Residential Mental Health and Substance Abuse Facilities)',
      type: 'residential-recovery-services',
      taxonomies: {
        naics: '623220 - Residential Mental Health and Substance Abuse Facilities',
        airs211: 'Mental Health and Substance Use Services - Residential Treatment Services'
      },
      capabilities: ['residential-treatment', 'behavioral-health', 'care-continuity']
    },
    {
      id: 'highland_workforce_training_institute',
      did: 'did:web:demo.sovereign.ngo:provider:highland_workforce_training_institute',
      label: 'Highland Workforce Training Institute (611430 - Professional and Management Development Training)',
      type: 'workforce-training-services',
      taxonomies: {
        naics: '611430 - Professional and Management Development Training',
        airs211: 'Employment - Job Training and Workforce Development'
      },
      capabilities: ['workforce-training', 'employment-support', 'education-support']
    }
  ];

  if (typeof window !== "undefined") {
    window.SovereignProviderCatalog = Object.freeze(providerCatalog.map((entry) => Object.freeze({
      ...entry,
      taxonomies: entry && entry.taxonomies && typeof entry.taxonomies === "object"
        ? Object.freeze({ ...entry.taxonomies })
        : undefined,
      capabilities: Array.isArray(entry && entry.capabilities)
        ? Object.freeze(entry.capabilities.slice())
        : Object.freeze([])
    })));
  }
})();
