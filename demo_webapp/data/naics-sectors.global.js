(function () {
  const naicsSectors = [
  {
    "id": "naics-22",
    "title": "22 - Utilities",
    "note": "Two-digit NAICS sector for utility service providers in this demo.",
    "subsectors": [
      {
        "id": "naics-221",
        "title": "221 - Utilities",
        "note": "Electric, gas, and water utility services.",
        "services": [
          {
            "id": "appalachian-electric-distribution",
            "title": "Appalachian Electric Distribution (221122 - Electric Power Distribution)",
            "type": "electric-utility-services",
            "endpointKeys": [
              "appalachian_electric_distribution"
            ]
          },
          {
            "id": "blue-river-natural-gas-utility",
            "title": "Blue River Natural Gas Utility (221210 - Natural Gas Distribution)",
            "type": "natural-gas-utility-services",
            "endpointKeys": [
              "blue_river_natural_gas_utility"
            ]
          },
          {
            "id": "clearwater-public-water-utility",
            "title": "Clearwater Public Water Utility (221310 - Water Supply and Irrigation Systems)",
            "type": "water-utility-services",
            "endpointKeys": [
              "clearwater_public_water_utility"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-23",
    "title": "23 - Construction",
    "note": "Two-digit NAICS sector for building system contractors used in housing stabilization workflows.",
    "subsectors": [
      {
        "id": "naics-238",
        "title": "238 - Specialty Trade Contractors",
        "note": "Electrical and plumbing/heating/air contractors for core household systems.",
        "services": [
          {
            "id": "volunteer-electrical-contractors",
            "title": "Volunteer Electrical Contractors (238210 - Electrical Contractors and Other Wiring Installation Contractors)",
            "type": "electrical-contractor-services",
            "endpointKeys": [
              "volunteer_electrical_contractors"
            ]
          },
          {
            "id": "foothills-plumbing-hvac-contractors",
            "title": "Foothills Plumbing, Heating, and Air Contractors (238220 - Plumbing, Heating, and Air-Conditioning Contractors)",
            "type": "plumbing-hvac-contractor-services",
            "endpointKeys": [
              "foothills_plumbing_hvac_contractors"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-44-45",
    "title": "44-45 - Retail Trade",
    "note": "Two-digit NAICS sector for direct consumer retail services.",
    "subsectors": [
      {
        "id": "naics-446",
        "title": "446 - Health and Personal Care Stores",
        "note": "Medication and pharmacy fulfillment services.",
        "services": [
          {
            "id": "mainstreet-community-pharmacy",
            "title": "MainStreet Community Pharmacy (446110 - Pharmacies and Drug Stores)",
            "type": "pharmacy-services",
            "endpointKeys": [
              "mainstreet_community_pharmacy"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-51",
    "title": "51 - Information",
    "note": "Two-digit NAICS sector for telecommunications and connectivity services.",
    "subsectors": [
      {
        "id": "naics-517",
        "title": "517 - Telecommunications",
        "note": "Wireless carrier services supporting household connectivity.",
        "services": [
          {
            "id": "holston-wireless-carrier",
            "title": "Holston Wireless Carrier (517312 - Wireless Telecommunications Carriers (except Satellite))",
            "type": "wireless-telecommunications-services",
            "endpointKeys": [
              "holston_wireless_carrier"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-52",
    "title": "52 - Finance and Insurance",
    "note": "Two-digit NAICS sector for financial services in this demo.",
    "subsectors": [
      {
        "id": "naics-522",
        "title": "522 - Credit Intermediation and Related Activities",
        "note": "Credit access and community banking supports.",
        "services": [
          {
            "id": "commonwealth-credit-union",
            "title": "Commonwealth Credit Union (522130 - Credit Unions)",
            "type": "credit-union-services",
            "endpointKeys": [
              "commonwealth_credit_union"
            ]
          }
        ]
      },
      {
        "id": "naics-523",
        "title": "523 - Securities, Commodity Contracts, and Other Financial Investments and Related Activities",
        "note": "Money management and financial planning supports.",
        "services": [
          {
            "id": "financial-wellness-center",
            "title": "Financial Wellness Center (523930 - Investment Advice)",
            "type": "money-management",
            "endpointKeys": [
              "financial_wellness_center"
            ]
          }
        ]
      },
      {
        "id": "naics-524",
        "title": "524 - Insurance Carriers and Related Activities",
        "note": "Insurance navigation and enrollment supports.",
        "services": [
          {
            "id": "neighborhood-insurance-brokers",
            "title": "Neighborhood Insurance Brokers (524210 - Insurance Agencies and Brokerages)",
            "type": "insurance-brokerage",
            "endpointKeys": [
              "neighborhood_insurance_brokers"
            ]
          },
          {
            "id": "summit-health-insurance-carrier",
            "title": "Summit Health Insurance Carrier (524114 - Direct Health and Medical Insurance Carriers)",
            "type": "health-insurance-carrier-services",
            "endpointKeys": [
              "summit_health_insurance_carrier"
            ]
          },
          {
            "id": "atlas-claims-administration",
            "title": "Atlas Claims Administration (524292 - Third Party Administration of Insurance and Pension Funds)",
            "type": "claims-administration-services",
            "endpointKeys": [
              "atlas_claims_administration"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-53",
    "title": "53 - Real Estate and Rental and Leasing",
    "note": "Two-digit NAICS sector for housing operators and property management.",
    "subsectors": [
      {
        "id": "naics-531",
        "title": "531 - Real Estate",
        "note": "Residential leasing and property management services.",
        "services": [
          {
            "id": "homestead-residential-leasing",
            "title": "Homestead Residential Leasing (531110 - Lessors of Residential Buildings and Dwellings)",
            "type": "residential-leasing-services",
            "endpointKeys": [
              "homestead_residential_leasing"
            ]
          },
          {
            "id": "cornerstone-property-management",
            "title": "Cornerstone Property Management (531311 - Residential Property Managers)",
            "type": "property-management-services",
            "endpointKeys": [
              "cornerstone_property_management"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-54",
    "title": "54 - Professional, Scientific, and Technical Services",
    "note": "Two-digit NAICS sector for legal and tax professional services.",
    "subsectors": [
      {
        "id": "naics-541",
        "title": "541 - Professional, Scientific, and Technical Services",
        "note": "Legal and tax support services.",
        "services": [
          {
            "id": "pioneer-legal-benefits-navigation",
            "title": "Pioneer Legal and Benefits Navigation (541110 - Offices of Lawyers)",
            "type": "legal-and-benefits-navigation",
            "endpointKeys": [
              "pioneer_legal_benefits_navigation"
            ]
          },
          {
            "id": "valley-notary-office",
            "title": "Valley Notary Office (541120 - Offices of Notaries)",
            "type": "notary-services",
            "endpointKeys": [
              "valley_notary_office"
            ]
          },
          {
            "id": "community-legal-aid-collective",
            "title": "Community Legal Aid Collective (541199 - All Other Legal Services)",
            "type": "legal-aid-services",
            "endpointKeys": [
              "community_legal_aid_collective"
            ]
          },
          {
            "id": "community-tax-services",
            "title": "Community Tax Services (541213 - Tax Preparation Services)",
            "type": "tax-services",
            "endpointKeys": [
              "community_tax_services"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-56",
    "title": "56 - Administrative and Support and Waste Management and Remediation Services",
    "note": "Two-digit NAICS sector for employment and support workflows.",
    "subsectors": [
      {
        "id": "naics-561",
        "title": "561 - Administrative and Support Services",
        "note": "Employment and workforce support services.",
        "services": [
          {
            "id": "ascent-employment-placement-agency",
            "title": "Ascent Employment Placement Agency (561311 - Employment Placement Agencies)",
            "type": "employment-placement",
            "endpointKeys": [
              "ascent_employment_placement_agency"
            ]
          },
          {
            "id": "rapid-response-temporary-help",
            "title": "Rapid Response Temporary Help (561320 - Temporary Help Services)",
            "type": "temporary-help-services",
            "endpointKeys": [
              "rapid_response_temporary_help"
            ]
          },
          {
            "id": "cedar-document-preparation-center",
            "title": "Cedar Document Preparation Center (561410 - Document Preparation Services)",
            "type": "document-preparation-services",
            "endpointKeys": [
              "cedar_document_preparation_center"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-61",
    "title": "61 - Educational Services",
    "note": "Two-digit NAICS sector for education and training workflows.",
    "subsectors": [
      {
        "id": "naics-611",
        "title": "611 - Educational Services",
        "note": "Education and training services.",
        "services": [
          {
            "id": "brightpath-educational-support-center",
            "title": "BrightPath Educational Support Center (611710 - Educational Support Services)",
            "type": "educational-support-services",
            "endpointKeys": [
              "brightpath_educational_support_center"
            ]
          },
          {
            "id": "highland-workforce-training-institute",
            "title": "Highland Workforce Training Institute (611430 - Professional and Management Development Training)",
            "type": "workforce-training-services",
            "endpointKeys": [
              "highland_workforce_training_institute"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-62",
    "title": "62 - Health Care and Social Assistance",
    "note": "Two-digit NAICS sector for clinical care, hospitals, and social assistance.",
    "subsectors": [
      {
        "id": "naics-621",
        "title": "621 - Ambulatory Health Care Services",
        "note": "Outpatient clinical and diagnostic care.",
        "services": [
          {
            "id": "hospital-clinic",
            "title": "Nolichucky Family Clinic (621111 - Offices of Physicians)",
            "type": "primary-care",
            "endpointKeys": [
              "nolichucky_family_clinic",
              "riverstone_radiology_center",
              "summitview_emergency_department",
              "blank"
            ]
          },
          {
            "id": "riverbend-dental-clinic",
            "title": "Riverbend Dental Clinic (621210 - Offices of Dentists)",
            "type": "dental-care-services",
            "endpointKeys": [
              "riverbend_dental_clinic"
            ]
          },
          {
            "id": "radiology-center",
            "title": "Riverstone Radiology Center (621512 - Diagnostic Imaging Centers)",
            "type": "imaging-services",
            "endpointKeys": [
              "riverstone_radiology_center",
              "nolichucky_family_clinic",
              "summitview_emergency_department",
              "blank"
            ]
          },
          {
            "id": "bluepeak-medical-laboratory",
            "title": "BluePeak Medical Laboratory (621511 - Medical Laboratories)",
            "type": "medical-laboratory-services",
            "endpointKeys": [
              "bluepeak_medical_laboratory"
            ]
          },
          {
            "id": "ridgeview-behavioral-health-center",
            "title": "Ridgeview Behavioral Health Center (621420 - Outpatient Mental Health and Substance Abuse Centers)",
            "type": "outpatient-behavioral-health",
            "endpointKeys": [
              "ridgeview_behavioral_health_center"
            ]
          },
          {
            "id": "caringhands-home-health",
            "title": "CaringHands Home Health (621610 - Home Health Care Services)",
            "type": "home-health-care",
            "endpointKeys": [
              "caringhands_home_health"
            ]
          },
          {
            "id": "tri-county-ambulance",
            "title": "Tri-County Ambulance (621911 - Ambulance Services)",
            "type": "ambulance-services",
            "endpointKeys": [
              "tri_county_ambulance"
            ]
          }
        ]
      },
      {
        "id": "naics-622",
        "title": "622 - Hospitals",
        "note": "Emergency and hospital-based care.",
        "services": [
          {
            "id": "emergency-department",
            "title": "Summitview Emergency Department (622110 - General Medical and Surgical Hospitals)",
            "type": "acute-emergency-care",
            "endpointKeys": [
              "summitview_emergency_department",
              "nolichucky_family_clinic",
              "riverstone_radiology_center",
              "blank"
            ]
          }
        ]
      },
      {
        "id": "naics-623",
        "title": "623 - Nursing and Residential Care Facilities",
        "note": "Residential behavioral health recovery and long-term treatment.",
        "services": [
          {
            "id": "horizon-residential-recovery-center",
            "title": "Horizon Residential Recovery Center (623220 - Residential Mental Health and Substance Abuse Facilities)",
            "type": "residential-recovery-services",
            "endpointKeys": [
              "horizon_residential_recovery_center"
            ]
          }
        ]
      },
      {
        "id": "naics-624",
        "title": "624 - Social Assistance",
        "note": "Relief, child care, shelter, housing, and other family support services.",
        "services": [
          {
            "id": "safeharbor-shelter",
            "title": "SafeHarbor Shelter (624221 - Temporary Shelters)",
            "type": "emergency-shelter",
            "endpointKeys": [
              "safeharbor_shelter"
            ]
          },
          {
            "id": "youthpath-child-services",
            "title": "YouthPath Child and Youth Services (624110 - Child and Youth Services)",
            "type": "child-youth-services",
            "endpointKeys": [
              "youthpath_child_services"
            ]
          },
          {
            "id": "salutation-army",
            "title": "Salutation Army (624190 - Other Individual and Family Services)",
            "type": "community-assistance",
            "endpointKeys": [
              "salutation_army"
            ]
          },
          {
            "id": "community-food-pantry",
            "title": "Community Food Pantry (624210 - Community Food Services)",
            "type": "food-assistance",
            "endpointKeys": [
              "community_food_pantry"
            ]
          },
          {
            "id": "fairmannor-house",
            "title": "FairMannor House (624229 - Other Community Housing Services)",
            "type": "homelessness-prevention",
            "endpointKeys": [
              "fairmannor_house"
            ]
          },
          {
            "id": "bridgeway-family-services",
            "title": "Bridgeway Family Services (624190 - Other Individual and Family Services)",
            "type": "family-stabilization",
            "endpointKeys": [
              "bridgeway_family_services"
            ]
          },
          {
            "id": "family-mediation-center",
            "title": "Family Mediation Center (624190 - Other Individual and Family Services)",
            "type": "family-mediation",
            "endpointKeys": [
              "family_mediation_center"
            ]
          },
          {
            "id": "community-legal-family-support",
            "title": "Community Legal and Family Support Services (624190 - Other Individual and Family Services)",
            "type": "legal-family-support",
            "endpointKeys": [
              "community_legal_family_support"
            ]
          },
          {
            "id": "foothills-disability-support-services",
            "title": "Foothills Disability Support Services (624120 - Services for the Elderly and Persons with Disabilities)",
            "type": "disability-support-services",
            "endpointKeys": [
              "foothills_disability_support_services"
            ]
          },
          {
            "id": "pathway-vocational-rehabilitation",
            "title": "Pathway Vocational Rehabilitation (624310 - Vocational Rehabilitation Services)",
            "type": "vocational-rehabilitation",
            "endpointKeys": [
              "pathway_vocational_rehabilitation"
            ]
          },
          {
            "id": "sunrise-child-day-center",
            "title": "Sunrise Child Day Center (624410 - Child Day Care Services)",
            "type": "child-day-care-services",
            "endpointKeys": [
              "sunrise_child_day_center"
            ]
          },
          {
            "id": "beacon-emergency-relief-services",
            "title": "Beacon Emergency Relief Services (624230 - Emergency and Other Relief Services)",
            "type": "emergency-relief-services",
            "endpointKeys": [
              "beacon_emergency_relief_services"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "naics-81",
    "title": "81 - Other Services (except Public Administration)",
    "note": "Two-digit NAICS sector for civic advocacy and consumer support organizations.",
    "subsectors": [
      {
        "id": "naics-813",
        "title": "813 - Religious, Grantmaking, Civic, Professional, and Similar Organizations",
        "note": "Advocacy and consumer protection services.",
        "services": [
          {
            "id": "tenant-rights-advocacy-network",
            "title": "Tenant Rights Advocacy Network (813319 - Other Social Advocacy Organizations)",
            "type": "legal-advocacy",
            "endpointKeys": [
              "tenant_rights_advocacy_network"
            ]
          },
          {
            "id": "consumer-regulation-support",
            "title": "Consumer Regulation Support Office (813319 - Other Social Advocacy Organizations)",
            "type": "consumer-regulation",
            "endpointKeys": [
              "consumer_regulation_support"
            ]
          },
          {
            "id": "dignity-human-rights-organization",
            "title": "Dignity Human Rights Organization (813311 - Human Rights Organizations)",
            "type": "human-rights-advocacy",
            "endpointKeys": [
              "dignity_human_rights_organization"
            ]
          }
        ]
      }
    ]
  }
];
  if (typeof window !== 'undefined') {
    window.SovereignNaicsSectors = naicsSectors;
  }
})();
