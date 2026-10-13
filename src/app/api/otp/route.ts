import { NextResponse } from "next/server";
import { fetchOtps } from "@/lib/imap";

// IMAP needs the Node runtime (TCP sockets). Never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const items = await fetchOtps();
    return NextResponse.json({ items, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
