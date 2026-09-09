import { NextRequest, NextResponse } from "next/server";
import { logServerSideError } from "@/lib/services/errorLog";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const endpoint = body.endpoint ?? "client-app";
    const message = body.message ?? "Client Error";
    const stack = body.stack;
    const metadata = body.metadata ?? {};

    const res = await logServerSideError({
      endpoint,
      error: new Error(message),
      metadata: { ...metadata, clientStack: stack },
    });

    return NextResponse.json({ ok: true, errorRef: res.errorRef });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: "Failed to log client error", detail: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}

