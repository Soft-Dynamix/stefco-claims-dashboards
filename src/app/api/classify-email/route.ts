import { NextRequest, NextResponse } from 'next/server'
import { classifyEmail, extractClaimData } from '@/lib/ai-helpers'
import { generateFolderPath } from '@/lib/folder-utils'

interface ClassifyRequest {
  subject: string
  body: string
  from: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ClassifyRequest = await request.json()
    const { subject, body: emailBody, from } = body

    if (!subject && !emailBody) {
      return NextResponse.json(
        { error: 'Subject and body are required' },
        { status: 400 }
      )
    }

    // Step 1: Classify the email using real AI
    const classificationResult = await classifyEmail(subject, emailBody, from)

    // Step 2: If classified as NEW_CLAIM, extract structured claim data using AI
    let extractedData: Record<string, string | null> | null = null
    let suggestedPath: string | null = null

    if (classificationResult.classification === 'NEW_CLAIM') {
      const extractionResult = await extractClaimData(subject, emailBody, from)
      const claimData = extractionResult.claimData

      // Map AI-extracted data to the response format the frontend expects,
      // including all the rich fields from AI extraction
      extractedData = {
        claimNumber: claimData.claim_number,
        clientName: claimData.client_name,
        claimType: claimData.claim_type,
        insuranceCompany: claimData.insurance_company,
        contactNumber: claimData.contact_number,
        contactEmail: claimData.contact_email,
        incidentDescription: claimData.incident_description,
        excessAmount: claimData.excess_amount,
        specialInstructions: claimData.special_instructions,
        vehicleMake: claimData.vehicle_make,
        vehicleModel: claimData.vehicle_model,
        vehicleYear: claimData.vehicle_year,
        vehicleRegistration: claimData.vehicle_registration,
      }

      // Step 3: Generate suggested folder path using folder-utils
      const claimNumber = claimData.claim_number || 'STF-PENDING'
      const clientName = claimData.client_name || 'Unknown Client'
      const folderName = claimData.insurance_company
        ? claimData.insurance_company.toUpperCase().replace(/\s+/g, '_')
        : 'UNKNOWN'

      suggestedPath = generateFolderPath(claimNumber, clientName, folderName)
    }

    return NextResponse.json({
      classification: classificationResult.classification,
      confidence: classificationResult.confidence,
      reasoning: classificationResult.reasoning,
      extractedData,
      suggestedPath,
    })
  } catch (error) {
    console.error('Email classification error:', error)
    return NextResponse.json(
      { error: 'Failed to classify email', details: String(error) },
      { status: 500 }
    )
  }
}
