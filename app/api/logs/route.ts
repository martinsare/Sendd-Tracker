import { NextRequest, NextResponse } from "next/server";
import { fetchAllErrorLogs, clearErrorLogs } from "@/lib/services/errorLog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") ?? "100");
    const logs = await fetchAllErrorLogs(limit);
    return NextResponse.json({ ok: true, count: logs.length, logs });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch logs", detail: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const res = await clearErrorLogs();
    return NextResponse.json({ ok: true, cleared: res.count });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: "Failed to clear logs", detail: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}

