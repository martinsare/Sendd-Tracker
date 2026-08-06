import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listRecentPlenaryExports } from "@/lib/sources/record";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parsed = querySchema.safeParse({ limit: searchParams.get("limit") });
  const limit = parsed.success ? (parsed.data.limit ?? 8) : 8;

  try {
    const result = await listRecentPlenaryExports(limit);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch exports", detail: String((e as Error)?.message ?? e) },
      { status: 502 }
    );
  }
}
