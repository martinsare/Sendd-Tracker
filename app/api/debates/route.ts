import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchSeneddDebates } from "@/lib/sources/twfy";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().optional().default(""),
  personId: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  num: z.coerce.number().optional().default(50),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parsed = querySchema.safeParse({
    q: searchParams.get("q") || "",
    personId: searchParams.get("personId") || undefined,
    page: searchParams.get("page") || 1,
    num: searchParams.get("num") || 50,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { q, personId, page, num } = parsed.data;

  try {
    const debates = await fetchSeneddDebates({
      search: q || undefined,
      personId,
      page,
      num,
    });

    return NextResponse.json({
      query: q,
      total_results: debates.length,
      debates,
      sourceUrl: "https://www.theyworkforyou.com/api/getDebates?type=senedd",
      fromCache: true,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch TheyWorkForYou debates", detail: String((err as Error)?.message ?? err) },
      { status: 502 },
    );
  }
}
