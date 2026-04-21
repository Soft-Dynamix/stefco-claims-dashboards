import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (status && status !== "all") {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { claimNumber: { contains: search } },
        { clientName: { contains: search } },
        { vehicleRegistration: { contains: search } },
      ];
    }

    const [claims, total] = await Promise.all([
      db.claim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          insuranceCompany: {
            select: { id: true, name: true, folderName: true },
          },
        },
      }),
      db.claim.count({ where }),
    ]);

    return NextResponse.json({
      claims,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Claims GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const claim = await db.claim.create({
      data: {
        claimNumber: body.claimNumber,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        claimType: body.claimType,
        incidentDate: body.incidentDate ? new Date(body.incidentDate) : null,
        incidentDescription: body.incidentDescription,
        vehicleRegistration: body.vehicleRegistration,
        vehicleMake: body.vehicleMake,
        vehicleModel: body.vehicleModel,
        propertyAddress: body.propertyAddress,
        excessAmount: body.excessAmount ? parseFloat(body.excessAmount) : null,
        insuranceCompanyId: body.insuranceCompanyId,
        status: body.status || "NEW",
        processedBy: "MANUAL",
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "claim_created",
        entityType: "claim",
        entityId: claim.id,
        details: JSON.stringify({ claimNumber: claim.claimNumber }),
        status: "SUCCESS",
        processedBy: "MANUAL",
        claimId: claim.id,
      },
    });

    return NextResponse.json(claim);
  } catch (error) {
    console.error("Claims POST error:", error);
    return NextResponse.json(
      { error: "Failed to create claim" },
      { status: 500 }
    );
  }
}
