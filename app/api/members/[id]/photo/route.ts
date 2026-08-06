import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function seneddBigPicUrl(uid: number) {
  const last3 = String(uid % 1000).padStart(3, "0");
  const dirs = `${last3[2]}/${last3[1]}/${last3[0]}`;
  const info = String(uid).padStart(8, "0");
  return `https://business.senedd.wales/UserData/${dirs}/Info${info}/bigpic.jpg`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { rows } = await query<{ senedduid: number | null; imageurl: string | null }>(
    `SELECT senedd_uid as senedduid, image_url as imageurl FROM members WHERE id = $1`,
    [id]
  );

  const row = rows[0];
  if (!row) return new NextResponse(null, { status: 404 });

  const upstreamUrl =
    row.senedduid != null ? seneddBigPicUrl(row.senedduid) : row.imageurl;
  if (!upstreamUrl) return new NextResponse(null, { status: 404 });

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok || !upstream.body)
      return new NextResponse(null, { status: 404 });

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const bytes = await upstream.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
