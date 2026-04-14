import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * POST /api/test-pipeline
 *
 * Easy inline testing of the email processing pipeline.
 * Pre-built test scenarios + custom email support.
 */

const testPipelineSchema = z.object({
  scenario: z.enum([
    'english_claim',
    'afrikaans_claim',
    'non_claim',
    'motor_claim_detailed',
    'building_claim',
    'low_confidence',
    'custom',
  ]),
  custom: z.object({
    from: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    attachments: z.array(z.object({
      filename: z.string(),
      contentType: z.string().optional(),
      size: z.number().optional(),
    })).optional(),
  }).optional(),
})

const TEST_SCENARIOS = {
  english_claim: {
    name: 'English Motor Claim (Santam)',
    description: 'Clear English claim notification from Santam with full details',
    from: 'claims@santam.co.za',
    subject: 'New assessment - Claim No: SAN-2026-0847 - J van der Merwe',
    body: `Dear Stefco Consultants,

Please find below the new assessment appointment details:

Claim No: SAN-2026-0847
Policy Number: POL-552198
Insured: Mr Johan van der Merwe
Claim Type: Motor Vehicle Accident

Incident Details:
The insured was involved in a motor vehicle accident on 15 March 2026 at the intersection of R55 and N14 in Centurion, Gauteng. The insured's vehicle was stationary at a traffic light when it was rear-ended by another vehicle.

Vehicle Details:
- Make: Toyota
- Model: Hilux 2.8 GD-6 Double Cab
- Year: 2024
- Registration: GP 789-012

Excess Amount: R5,500.00
Contact Number: +27 82 345 6789
Contact Email: jvandermerwe@gmail.com

Please arrange an assessment at your earliest convenience.

Kind regards,
Santam Claims Department
Tel: +27 21 947 2000`,
    attachments: [
      { filename: 'assessment_report.pdf', contentType: 'application/pdf', size: 2457600 },
      { filename: 'photo_damage_front.jpg', contentType: 'image/jpeg', size: 3145728 },
    ],
    expectedClassification: 'NEW_CLAIM',
    expectedConfidence: 95,
    expectedCompany: 'Santam',
  },
  afrikaans_claim: {
    name: 'Afrikaans Motor Claim (Hollard)',
    description: 'Afrikaans NUWE EIS notification from Hollard Insurance',
    from: 'eise@hollard.co.za',
    subject: 'NUWE EIS - Referensie: HLD-2026-0034 - M Joubert',
    body: `Geagte Stefco Konsultante,

Hierdie is om u in kennis te stel van 'n nuwe eis wat ontvang is:

Referensie: HLD-2026-0034
Polisnommer: HLD-POL-77421
Versekerde: Me. Maria Joubert
Eis Tipe: Motor Voertuig Ongeval

Voorval Beskrywing:
Die versekerde se voertuig is beskadig tydens 'n haelstorm op 20 April 2026 in Pretoria-Wes. Die voorruit en dak is erg beskadig deur groot haelstene.

Voertuig Besonderhede:
- Maak: Volkswagen
- Model: Polo Vivo 1.4 Trendline
- Jaar: 2023
- Registrasie: CA 456-789

Oortollige Bedrag: R3,200.00
Kontaknommer: 012 345 6789
Kontak E-pos: maria.joubert@outlook.com

Spesiale Instruksies:
Die versekerde versoek 'n dringende assessering aangesien die voertuig nie rybaar is nie.

Met vriendelike groete,
Hollard Versekering Eis Afdeling`,
    attachments: [
      { filename: 'hail_damage_report.pdf', contentType: 'application/pdf', size: 1843200 },
    ],
    expectedClassification: 'NEW_CLAIM',
    expectedConfidence: 92,
    expectedCompany: 'Hollard',
  },
  non_claim: {
    name: 'Non-Claim (Marketing)',
    description: 'Marketing newsletter that should be IGNORED',
    from: 'newsletter@insurance-times.co.za',
    subject: 'Insurance Industry Weekly Newsletter - April 2026 Edition',
    body: `Insurance Industry Weekly

TOP STORIES THIS WEEK:

1. New FSCA regulations for motor insurance claims processing take effect Q3 2026
2. Hollard reports 12% increase in weather-related claims in Q1
3. Santam launches new AI-powered assessment tool

INDUSTRY EVENTS:
- Insurance Conference South Africa 2026 - Register Now
- FIA Annual General Meeting - May 15, 2026

To unsubscribe from this newsletter, click here.
This is an automated message, please do not reply.`,
    attachments: [],
    expectedClassification: 'IGNORE',
    expectedConfidence: 90,
    expectedCompany: null,
  },
  motor_claim_detailed: {
    name: 'Detailed Motor Claim (Old Mutual)',
    description: 'Comprehensive motor claim with vehicle and incident details from Old Mutual',
    from: 'assessments@oldmutual.co.za',
    subject: 'New Appointment of Loss Adjuster - OMI-2026-1192 - P Botha',
    body: `Stefco Consultants (Pty) Ltd

APPOINTMENT OF LOSS ADJUSTER

We hereby appoint Stefco Consultants to assess the following claim:

Claim Reference: OMI-2026-1192
Policy Number: OMI-MOT-2024-445512
Date of Loss: 2 May 2026
Type of Loss: Motor Vehicle - Collision

INSURED DETAILS:
Name: Mr Pieter Botha
ID Number: 8503015098083
Contact Number: +27 83 212 3456
Email: p.botha@telkomsa.net
Physical Address: 14 Voortrekker Street, Bloemfontein, Free State, 9301

INCIDENT DESCRIPTION:
The insured was travelling eastbound on the N1 highway near Bloemfontein when a truck changed lanes abruptly, causing the insured to swerve and collide with the centre median barrier. The front bumper, right fender, and radiator were severely damaged. The vehicle was towed from the scene by Bloemfontein Towing Services.

VEHICLE DETAILS:
Make: Ford
Model: Ranger Wildtrak 3.2 XLT
Year: 2025
Registration: FS 234-567
VIN: WF0XXXXXXGJ12345
Mileage: 23,450 km

FINANCIAL DETAILS:
Estimated Repair Cost: R145,000.00
Excess/Deductible: R7,500.00
Pre-assessment: Required

SPECIAL INSTRUCTIONS:
1. Please contact the insured within 24 hours to arrange assessment
2. The vehicle is currently at Auto Panel Beaters, 45 Nelson Mandela Drive, Bloemfontein
3. Two quotes are required for the repair
4. Please verify if airbags deployed

Kindly confirm receipt of this instruction.

Old Mutual Insure
Claims Processing Centre
Email: claims@oldmutual.co.za`,
    attachments: [
      { filename: 'appointment_letter.pdf', contentType: 'application/pdf', size: 524288 },
      { filename: 'photo_1_front_bumper.jpg', contentType: 'image/jpeg', size: 4194304 },
      { filename: 'photo_2_right_fender.jpg', contentType: 'image/jpeg', size: 3670016 },
      { filename: 'photo_3_radiator.jpg', contentType: 'image/jpeg', size: 2867200 },
      { filename: 'towing_invoice.pdf', contentType: 'application/pdf', size: 102400 },
    ],
    expectedClassification: 'NEW_CLAIM',
    expectedConfidence: 98,
    expectedCompany: 'Old Mutual Insure',
  },
  building_claim: {
    name: 'Building Insurance Claim (Echelon)',
    description: 'Building structural damage claim from Echelon Insurance',
    from: 'notifications@echelon.co.za',
    subject: 'RE: New Assessment Required - ECHELON-2026-0089',
    body: `Dear Stefco Assessment Team,

Please attend to the following building insurance claim:

Claim Number: ECHELON-2026-0089
Policy: ECH-BLD-2023-88421
Insured: Mrs Aletta van Wyk
Property Address: 23 Protea Avenue, Durbanville, Cape Town, 7550

INCIDENT:
Burst geyser on the first floor of the property on 10 May 2026, causing significant water damage to ceilings, walls, and laminate flooring in 3 rooms. Water was flowing for approximately 4 hours before the main water supply was shut off.

DAMAGE DESCRIPTION:
- Master bedroom ceiling: Partial collapse, water staining
- Passage: Ceiling sagging, water damage to walls
- Study: Laminate flooring warped and lifting
- Kitchen: Minor water staining on lower wall sections

Excess Amount: R4,000.00
Insured Contact: +27 21 976 5432 (A van Wyk)
Insured Email: avwyk@mweb.co.za

The insured has been temporarily accommodated at a guest house.

Regards
Echelon Insurance Short-Term Claims`,
    attachments: [
      { filename: 'geyser_damage_report.pdf', contentType: 'application/pdf', size: 3670016 },
      { filename: 'photo_lounge_ceiling.jpg', contentType: 'image/jpeg', size: 2411724 },
    ],
    expectedClassification: 'NEW_CLAIM',
    expectedConfidence: 95,
    expectedCompany: 'Echelon',
  },
  low_confidence: {
    name: 'Low Confidence (Vague)',
    description: 'Vague email that may or may not be a claim - should require manual review',
    from: 'info@somecompany.co.za',
    subject: 'Follow up regarding our previous correspondence',
    body: `Hi,

Just following up on our previous email. We need some information regarding the file we sent over last week. Can someone please get back to us when they have a moment?

Thanks,
John`,
    attachments: [],
    expectedClassification: 'IGNORE',
    expectedConfidence: 60,
    expectedCompany: null,
  },
} as const

export type TestScenario = keyof typeof TEST_SCENARIOS

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = testPipelineSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { scenario, custom } = result.data

    // Get test data
    let testData: {
      name: string
      description: string
      from: string
      subject: string
      body: string
      attachments: Array<{ filename: string; contentType?: string; size?: number }>
      expectedClassification: string
      expectedConfidence: number
      expectedCompany: string | null
    }

    if (scenario === 'custom' && custom) {
      testData = {
        name: 'Custom Email',
        description: 'User-provided custom email for testing',
        from: custom.from || 'test@example.com',
        subject: custom.subject || 'Test Subject',
        body: custom.body || 'Test body',
        attachments: custom.attachments || [],
        expectedClassification: 'UNKNOWN',
        expectedConfidence: 0,
        expectedCompany: null,
      }
    } else {
      const s = TEST_SCENARIOS[scenario]
      testData = {
        name: s.name,
        description: s.description,
        from: s.from,
        subject: s.subject,
        body: s.body,
        attachments: s.attachments,
        expectedClassification: s.expectedClassification,
        expectedConfidence: s.expectedConfidence,
        expectedCompany: s.expectedCompany,
      }
    }

    // Return test data for frontend processing
    return NextResponse.json({
      scenario,
      testData,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate test scenario', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return list of available scenarios
  const scenarios = Object.entries(TEST_SCENARIOS).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
    expectedClassification: value.expectedClassification,
    expectedConfidence: value.expectedConfidence,
    attachmentCount: value.attachments.length,
  }))

  return NextResponse.json({ scenarios })
}
