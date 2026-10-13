import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "otp_session";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

// Create a signed session token valid for 12h.
export async function createSession(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

// Returns true if the token is a valid, unexpired session. Edge-runtime safe (jose).
export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret(), { algorithms: [ALG] });
    return true;
  } catch {
    return false;
  }
}
