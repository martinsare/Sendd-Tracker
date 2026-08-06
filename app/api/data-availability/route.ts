import { NextResponse } from "next/server";
import { availabilityMetrics } from "@/lib/dataAvailability";

export async function GET() {
  return NextResponse.json({ metrics: availabilityMetrics });
}
