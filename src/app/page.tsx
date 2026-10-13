"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type OtpItem = {
  uid: number;
  code: string | null;
  from: string;
  subject: string;
  date: string;
  ageSeconds: number;
  preview: string;
};

const REFRESH_MS = 4000;
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "the app";
const TESTER_EMAIL = process.env.NEXT_PUBLIC_TESTER_EMAIL || "";
const TTL = Number(process.env.NEXT_PUBLIC_OTP_TTL_SECONDS || "600");

function mmss(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<OtpItem[]>([]);
  const [error, setError] = useState("");
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  // forces a re-render every second so the countdown ticks smoothly between fetches
  const [, setTick] = useState(0);
  // age of the latest code (in seconds) at the moment we received it, plus the
  // client wall-clock time of that fetch, so we can extrapolate live.
  const ageRef = useRef<{ ageSeconds: number; clientMs: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/otp", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't reach the inbox. Retrying…");
      } else {
        const next: OtpItem[] = data.items || [];
        const top = next.find((i) => i.code);
        if (top) {
          ageRef.current = { ageSeconds: top.ageSeconds, clientMs: Date.now() };
        } else {
          ageRef.current = null;
        }
        setItems(next);
        setError("");
      }
    } catch {
      setError("Couldn't reach the inbox. Retrying…");
    } finally {
      setLoadedOnce(true);
    }
  }, [router]);

  useEffect(() => {
    load();
    function tick() {
      timer.current = setTimeout(async () => {
        await load();
        tick();
      }, REFRESH_MS);
    }
    tick();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  // 1-second clock for the live countdown
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const withCode = items.filter((i) => i.code);
  const latest = withCode[0] ?? null;

  // remaining life of the latest code = TTL minus its age at fetch minus time
  // elapsed on the client since that fetch.
  let remaining = 0;
  if (latest?.code && ageRef.current) {
    const elapsedSinceFetch = (Date.now() - ageRef.current.clientMs) / 1000;
    remaining = Math.round(TTL - ageRef.current.ageSeconds - elapsedSinceFetch);
  }

  const expired = latest?.code ? remaining <= 0 : false;
  const fresh = latest?.code && !expired;

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; user can still read & type it */
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(TESTER_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 1800);
    } catch {
      /* ignore */
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="wrap">
      <div className="header">
        <div className="title">{APP_NAME} login helper</div>
        <button className="link-btn" onClick={logout}>
          Log out
        </button>
      </div>
      <div className="sub">
        This page shows your login code automatically. You do not need to open
        any email.
      </div>

      {/* Step-by-step instructions */}
      <div className="steps">
        <div className="step">
          <span className="step-num">1</span>
          <div className="step-body">
            In {APP_NAME}, enter this email address:
            {TESTER_EMAIL && (
              <div className="email-row">
                <code className="email">{TESTER_EMAIL}</code>
                <button className="btn btn-sm" onClick={copyEmail}>
                  {copiedEmail ? "Copied ✓" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="step">
          <span className="step-num">2</span>
          <div className="step-body">
            Tap  <b>Continue</b> in {APP_NAME}.
          </div>
        </div>
        <div className="step">
          <span className="step-num">3</span>
          <div className="step-body">
            Your code appears below in a few seconds. Tap <b>Copy code</b>, then
            paste it into {APP_NAME}.
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* The code */}
      <div className={`hero ${fresh ? "hero-active" : ""}`}>
        <div className="hero-label">Your login code</div>

        {!loadedOnce ? (
          <div className="state">
            <span className="spinner" /> Checking your inbox…
          </div>
        ) : fresh && latest?.code ? (
          <>
            <div className="code">{latest.code}</div>
            <div className="countdown">
              Expires in {mmss(remaining)} · use it soon
            </div>
            <button
              className="btn btn-primary btn-copy"
              onClick={() => copy(latest.code!)}
            >
              {copied ? "Copied ✓ — now paste it" : "Copy code"}
            </button>
          </>
        ) : expired && latest?.code ? (
          <>
            <div className="code dim">{latest.code}</div>
            <div className="countdown warn">
              This code has expired. Tap <b>Send code</b> again in {APP_NAME} and
              a new one will appear here.
            </div>
          </>
        ) : (
          <div className="state">
            <span className="spinner" />
            <div>
              <div className="state-title">No code yet</div>
              <div className="state-sub">
                Request a code in {APP_NAME}. It will show up here
                automatically. You don&apos;t need to refresh.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="searching">
        <span className="dot" /> Watching your inbox for new codes…
      </div>
    </div>
  );
}
