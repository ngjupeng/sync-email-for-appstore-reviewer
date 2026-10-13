import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD not configured" },
      { status: 500 }
    );
  }
  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
