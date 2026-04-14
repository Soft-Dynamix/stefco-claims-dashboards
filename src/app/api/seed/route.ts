import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateFolderPath } from '@/lib/folder-utils'

/**
 * POST /api/seed
 *
 * Seeds the database with insurance companies matching spec Table 3,
 * and realistic South African claims with proper folder paths.
 *
 * Insurance Companies (Spec Table 3):
 * - Echelon (echelonpci.co.za) → ECHELON
 * - Old Mutual Insure (ominsure.co.za) → OMI
 * - Legacy Underwriting (legacyunderwriting.co.za) → LEGACY
 * - PSG (@psg.co.za) → PSG
 * - Santam (santam.co.za) → SANTAM
 * - Mooirivier (mooirivier.com) → MOOIRIVIER (FTP - Phase 2)
 * - Hollard (hollard.co.za) → HOLLARD
 * - Outsurance (outsurance.co.za) → OUTSURE
 */

const insuranceCompanies = [
  {
    name: 'Echelon',
    folderName: 'ECHELON',
    senderDomains: JSON.stringify(['echelonpci.co.za', '@echelonpci.co.za']),
    isActive: true,
  },
  {
    name: 'Old Mutual Insure',
    folderName: 'OMI',
    senderDomains: JSON.stringify(['ominsure.co.za', '@ominsure.co.za']),
    isActive: true,
  },
  {
    name: 'Legacy Underwriting',
    folderName: 'LEGACY',
    senderDomains: JSON.stringify(['legacyunderwriting.co.za', '@legacyunderwriting.co.za']),
    isActive: true,
  },
  {
    name: 'PSG',
    folderName: 'PSG',
    senderDomains: JSON.stringify(['psg.co.za', '@psg.co.za']),
    isActive: true,
  },
  {
    name: 'Santam',
    folderName: 'SANTAM',
    senderDomains: JSON.stringify(['santam.co.za', '@santam.co.za']),
    isActive: true,
  },
  {
    name: 'Mooirivier',
    folderName: 'MOOIRIVIER',
    senderDomains: JSON.stringify(['mooirivier.com', '@mooirivier.com']),
    isActive: false, // FTP - Phase 2
  },
  {
    name: 'Hollard',
    folderName: 'HOLLARD',
    senderDomains: JSON.stringify(['hollard.co.za', '@hollard.co.za']),
    isActive: true,
  },
  {
    name: 'Outsurance',
    folderName: 'OUTSURE',
    senderDomains: JSON.stringify(['outsurance.co.za', '@outsurance.co.za']),
    isActive: true,
  },
]

const statuses = ['NEW', 'PROCESSING', 'COMPLETED', 'MANUAL_REVIEW', 'FAILED', 'PENDING_REVIEW']
const claimTypes = ['Motor', 'Building', 'Marine', 'Agricultural', 'Household', 'Liability']
const stages = ['RECEIVED', 'CLASSIFIED', 'EXTRACTED', 'FOLDER_CREATED', 'DOCUMENTS_SAVED', 'PRINTED', 'LOGGED', 'RESPONDED']

// Realistic South African names
const firstNames = [
  'Johannes', 'Pieter', 'Willem', 'Hendrik', 'Johan', 'Jan', 'Francois', 'Daniel',
  'Maria', 'Anna', 'Elizabeth', 'Susanna', 'Aletta', 'Catherina', 'Petronella', 'Magdalena',
  'Sipho', 'Thabo', 'Nkosi', 'Bongani', 'Andile', 'Kagiso', 'Lerato', 'Thandiwe',
]
const lastNames = [
  'van der Merwe', 'Joubert', 'Nel', 'Botha', 'van Wyk', 'Steyn', 'du Plessis',
  'Müller', 'Coetzee', 'Venter', 'van Niekerk', 'Pretorius', 'Fourie', 'Le Roux',
  'Mokoena', 'Ngcobo', 'Dlamini', 'Mkhize', 'Ndaba', 'Molefe',
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(daysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - randomInt(0, daysAgo))
  d.setHours(randomInt(6, 22), randomInt(0, 59), randomInt(0, 59))
  return d
}

const vehicleMakes = ['Toyota', 'Volkswagen', 'Ford', 'BMW', 'Mercedes-Benz', 'Hyundai', 'Kia', 'Nissan', 'Isuzu', 'Mazda']
const vehicleModels = ['Hilux', 'Polo', 'Ranger', '3 Series', 'C-Class', 'Tucson', 'Sportage', 'NP200', 'D-Max', 'CX-5']

const incidentDescriptions: Record<string, string[]> = {
  Motor: [
    'Rear-end collision at traffic light. Vehicle sustained damage to bumper, boot lid and rear lights. Third party admitted liability.',
    'Vehicle was stationary when hit by a runaway trailer on the N1 highway. Extensive damage to left side panels and doors.',
    'Hail storm damage. Multiple dents on roof, bonnet and boot. Windscreen cracked. Vehicle was parked at the time.',
    'Theft of vehicle - vehicle stolen from residential driveway during the night. SAPS case opened.',
    'Single vehicle accident. Driver lost control on wet road surface, collided with barrier. Airbags deployed. Driver sustained minor injuries.',
  ],
  Building: [
    'Storm damage to commercial building roof. Strong winds tore off sections of corrugated iron roofing. Water ingress into offices.',
    'Burst geyser in residential property causing extensive water damage to ceilings, walls and fitted carpets on upper and lower floors.',
    'Lightning strike to building causing electrical damage. Surge protection failed, multiple electrical appliances and circuits damaged.',
    'Subsidence causing cracking to foundation and load-bearing walls. Structural engineer report attached. Recommended underpinning.',
  ],
  Marine: [
    'Cargo damage during transit from Durban to Cape Town. Containers shifted in heavy seas causing damage to electronic goods.',
    'Vessel grounded at port approach. Hull damage below waterline. Salvage operations underway. Cargo offloading delayed.',
    'Water damage to cargo in warehouse storage at port. Roof leaking due to maintenance issues. Insurance claim for damaged goods.',
  ],
  Agricultural: [
    'Crop damage due to severe drought conditions in Western Cape. Estimated 60% yield loss on wheat and canola crops.',
    'Livestock losses due to veld fire that swept through farm during windy conditions. 45 sheep and 3 cattle lost.',
    'Orchard damage from hail storm. Extensive damage to deciduous fruit trees. Estimated 40% of current season crop affected.',
    'Fence and infrastructure damage from flash flooding. Road washaways and dam wall breach on property.',
  ],
  Household: [
    'Burglary at residential property. Forced entry through back door. Jewellery, electronics and cash stolen. Alarm system was activated.',
    'Geyser burst causing water damage to ceilings, walls and flooring in two bathrooms and passage area.',
    'Fire damage to kitchen area. Electrical fault caused fire in oven. Smoke damage throughout ground floor.',
    'Storm damage: falling tree branch caused damage to carport roof and patio area. Garden furniture destroyed.',
  ],
  Liability: [
    'Third party injury on client premises. Customer slipped on wet floor in retail store. Fractured wrist. Medical expenses claimed.',
    'Professional negligence claim. Client alleging incorrect advice led to financial loss. Legal proceedings initiated.',
    'Public liability claim: delivery vehicle damaged customer property during offloading operations. Repair costs claimed.',
  ],
}

const specialInstructionsList = [
  'Please contact insured directly to arrange assessment.',
  'Policyholder requests urgent processing due to rental vehicle costs.',
  'Excess has been waived by insurer - please confirm before proceeding.',
  'Insured has previous claims on same policy - check claims history.',
  'Third party details still outstanding - follow up with insurer.',
  'Vehicle currently at approved repairer. Authorisation required.',
  'Loss adjuster has been appointed by insurer. Reference: LA-2026-0452.',
  null,
  null,
  null,
]

export async function POST() {
  try {
    // Clear existing data for clean seed
    await db.printQueueItem.deleteMany()
    await db.auditLog.deleteMany()
    await db.claim.deleteMany()
    await db.insuranceCompany.deleteMany()
    await db.systemConfig.deleteMany()

    // Create insurance companies matching spec Table 3
    const companies = []
    for (const company of insuranceCompanies) {
      const c = await db.insuranceCompany.create({
        data: {
          name: company.name,
          folderName: company.folderName,
          senderDomains: company.senderDomains,
          isActive: company.isActive,
        },
      })
      companies.push(c)
    }

    // Create claims with realistic SA data
    const claimCount = 75
    const activeCompanies = companies.filter((c) => c.isActive)

    for (let i = 0; i < claimCount; i++) {
      const status = randomFrom(statuses)
      const claimType = randomFrom(claimTypes)
      const firstName = randomFrom(firstNames)
      const lastName = randomFrom(lastNames)
      const company = randomFrom(activeCompanies)
      const stageIndex = status === 'NEW' ? 0 : status === 'COMPLETED' ? 7 : randomInt(1, 6)
      const confidence = status === 'NEW' ? randomInt(0, 40) : status === 'COMPLETED' ? randomInt(80, 99) : randomInt(50, 95)
      const createdAt = randomDate(45)

      const claimNumber = `STF-${String(1000 + i).padStart(5, '0')}`
      const descriptions = incidentDescriptions[claimType] || incidentDescriptions.Motor
      const description = randomFrom(descriptions)

      // Generate folder path using the spec naming convention
      const folderPath = generateFolderPath(claimNumber, `${firstName} ${lastName}`, company.folderName, createdAt)

      const claimData: Record<string, unknown> = {
        claimNumber,
        clientName: `${firstName} ${lastName}`,
        insuranceCompanyId: company.id,
        claimType,
        status,
        senderEmail: `claims@${company.folderName.toLowerCase()}.co.za`,
        emailSubject: `New ${claimType.toLowerCase()} claim assessment - ${lastName}`,
        contactNumber: `+27${randomInt(60, 79)}${String(randomInt(1000000, 9999999))}`,
        contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/ /g, '.')}@email.co.za`,
        incidentDescription: description,
        excessAmount: `R${randomInt(1, 15) * 500}`,
        specialInstructions: randomFrom(specialInstructionsList),
        folderPath,
        confidenceScore: confidence,
        aiClassification: 'NEW_CLAIM',
        aiClassificationConfidence: confidence,
        processingStage: stages[stageIndex],
        attachmentsCount: randomInt(0, 8),
        documentsPrinted: status === 'COMPLETED' ? Math.random() > 0.3 : false,
        createdAt,
      }

      if (claimType === 'Motor') {
        claimData.vehicleMake = randomFrom(vehicleMakes)
        claimData.vehicleModel = randomFrom(vehicleModels)
        claimData.vehicleYear = String(randomInt(2016, 2025))
        claimData.vehicleRegistration = `${randomFrom(['CA', 'GP', 'KZN', 'MP', 'FS', 'EC', 'NW', 'L'])} ${randomInt(100000, 999999)}-${randomFrom(['GP', 'WC', 'KZN', 'MP', 'FS', 'EC', 'NW', 'L'])}`
      } else if (claimType === 'Building') {
        claimData.propertyAddress = `${randomInt(1, 500)} ${randomFrom(['Main', 'Oak', 'Pine', 'Cedar', 'Elm', 'Maple', 'Voortrekker', 'Kerk', 'Loop', 'Bloem'])} ${randomFrom(['Street', 'Road', 'Avenue', 'Drive', 'Lane'])}, ${randomFrom(['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Bloemfontein', 'Port Elizabeth', 'Stellenbosch', 'Centurion'])}`
      }

      if (status === 'COMPLETED') {
        claimData.processedAt = new Date(createdAt.getTime() + randomInt(3600000, 172800000))
      }

      await db.claim.create({ data: claimData as never })
    }

    // Create audit logs
    const allClaims = await db.claim.findMany({ select: { id: true, claimNumber: true } })
    const actions = [
      'EMAIL_RECEIVED',
      'AI_CLASSIFICATION',
      'DATA_EXTRACTION',
      'INSURANCE_MAPPING',
      'FOLDER_CREATED',
      'DOCUMENT_SAVED',
      'PRINT_QUEUED',
      'AUTO_REPLY_SENT',
      'email_received',
      'ai_classification',
      'data_extraction',
      'insurance_mapping',
      'folder_path_generated',
    ]
    // Only generate SUCCESS and WARNING statuses for seed data.
    // Avoid random ERROR statuses on entries that describe successful operations,
    // as these show up as red error notifications in the notification dropdown.
    const logStatuses = ['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'WARNING']

    for (const claim of allClaims.slice(0, 30)) {
      const numLogs = randomInt(1, 4)
      for (let j = 0; j < numLogs; j++) {
        const action = randomFrom(actions)
        const logStatus = randomFrom(logStatuses)
        const detailsMap: Record<string, string> = {
          EMAIL_RECEIVED: `Email received and queued for processing for claim ${claim.claimNumber}`,
          AI_CLASSIFICATION: `AI classified email as NEW_CLAIM with ${randomInt(70, 99)}% confidence`,
          DATA_EXTRACTION: `Extracted claim data from email body. Confidence: ${randomInt(60, 99)}%`,
          INSURANCE_MAPPING: `Matched sender domain to insurance company folder`,
          FOLDER_CREATED: `Created folder structure for claim ${claim.claimNumber}`,
          DOCUMENT_SAVED: `Saved ${randomInt(1, 6)} attachment(s) to claim folder`,
          PRINT_QUEUED: `Queued ${randomInt(1, 4)} document(s) for printing`,
          AUTO_REPLY_SENT: `Auto-acknowledgement email sent to sender`,
          email_received: `Email received from insurance company. Subject: New claim assessment`,
          ai_classification: `Classification: NEW_CLAIM. Reason: Contains assessment appointment details`,
          data_extraction: `Extracted claim number, client name, incident description, excess amount`,
          insurance_mapping: `Sender domain matched to company folder successfully`,
          folder_path_generated: `Generated folder path: Z:\\2026\\${randomFrom(['January', 'February', 'March', 'April'])}\\${randomFrom(['SANTAM', 'HOLLARD', 'OUTSURE', 'ECHELON', 'PSG'])}\\${claim.claimNumber}`,
        }

        await db.auditLog.create({
          data: {
            claimId: claim.id,
            action,
            details: detailsMap[action] || `Processed ${action} for claim ${claim.claimNumber}`,
            status: logStatus,
            processedBy: Math.random() > 0.2 ? 'AUTO' : 'MANUAL',
            createdAt: randomDate(10),
          },
        })
      }
    }

    // Create print queue items
    const printStatuses = ['QUEUED', 'PRINTING', 'COMPLETED', 'FAILED']
    for (let i = 0; i < 20; i++) {
      const printStatus = randomFrom(printStatuses)
      const claim = randomFrom(allClaims)
      const claimRecord = await db.claim.findUnique({
        where: { id: claim.id },
        select: { claimNumber: true, folderPath: true },
      })
      const createdAt = randomDate(7)

      const fileTypes = [
        'assessment_report.pdf',
        'photos_damage.zip',
        'quote_repair.pdf',
        'id_document.pdf',
        'police_report.pdf',
        'insurance_schedule.pdf',
        'driver_licence.pdf',
        'invoice.pdf',
      ]

      await db.printQueueItem.create({
        data: {
          claimId: claim.id,
          fileName: randomFrom(fileTypes),
          filePath: claimRecord?.folderPath ? `${claimRecord.folderPath}\\Attachments\\${randomFrom(fileTypes)}` : null,
          pages: randomInt(1, 15),
          printStatus,
          printedAt: printStatus === 'COMPLETED' ? new Date(createdAt.getTime() + randomInt(1800000, 7200000)) : null,
          error: printStatus === 'FAILED' ? 'Printer offline - retry pending' : null,
          createdAt,
        },
      })
    }

    // Create default system config (spec §3.2)
    const defaultConfigs = [
      { key: 'ai_provider', value: 'gemini' },
      { key: 'ai_model', value: 'gemini-2.5-flash-preview-05-20' },
      { key: 'auto_reply_enabled', value: 'true' },
      { key: 'print_queue_enabled', value: 'true' },
      { key: 'confidence_threshold', value: '70' },
      { key: 'business_hours_start', value: '07:00' },
      { key: 'business_hours_end', value: '19:00' },
      { key: 'business_days', value: '1,2,3,4,5' }, // Mon-Fri
      { key: 'timezone', value: 'Africa/Johannesburg' },
      { key: 'claim_prefix', value: 'STF' },
      { key: 'folder_root', value: 'Z:\\' },
      { key: 'company_email', value: 'claims@stefco.co.za' },
      { key: 'company_phone', value: '+27 21 555 0100' },
      { key: 'duplicate_handling', value: 'version_suffix' },
    ]

    for (const config of defaultConfigs) {
      await db.systemConfig.create({ data: config })
    }

    const activeCompanyCount = companies.filter((c) => c.isActive).length

    return NextResponse.json({
      success: true,
      message: `Seeded ${companies.length} insurance companies (${activeCompanyCount} active), ${claimCount} claims with folder paths, audit logs, and print queue items.`,
      insuranceCompanies: companies.map((c) => ({
        name: c.name,
        folderName: c.folderName,
        isActive: c.isActive,
      })),
      systemConfig: defaultConfigs.map((c) => c.key),
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Failed to seed database: ' + String(error) },
      { status: 500 }
    )
  }
}
