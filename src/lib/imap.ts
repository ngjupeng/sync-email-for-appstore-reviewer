import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type OtpItem = {
  uid: number;
  code: string | null;
  from: string;
  subject: string;
  date: string; // ISO
  ageSeconds: number;
  preview: string;
};

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function buildRegex(): RegExp {
  const raw = env("OTP_REGEX", "\\b(\\d{4,8})\\b");
  try {
    return new RegExp(raw);
  } catch {
    return /\b(\d{4,8})\b/;
  }
}

function extractCode(text: string, re: RegExp): string | null {
  const m = text.match(re);
  if (!m) return null;
  // Prefer first capture group, else whole match.
  return (m[1] ?? m[0]) || null;
}

// Connects to the inbox, scans the most recent messages, and returns parsed OTP items
// (newest first), filtered by sender/subject/time window from env.
export async function fetchOtps(): Promise<OtpItem[]> {
  const client = new ImapFlow({
    host: env("IMAP_HOST", "imap.gmail.com"),
    port: Number(env("IMAP_PORT", "993")),
    secure: true,
    auth: {
      user: env("IMAP_USER").trim(),
      // Gmail shows app passwords with spaces (e.g. "abcd efgh ijkl mnop"); strip them.
      pass: env("IMAP_PASSWORD").replace(/\s+/g, ""),
    },
    logger: false,
  });

  const fromFilter = env("OTP_FROM").toLowerCase().trim();
  const subjectFilter = env("OTP_SUBJECT").toLowerCase().trim();
  const windowMinutes = Number(env("OTP_WINDOW_MINUTES", "15"));
  const scanCount = Number(env("OTP_SCAN_COUNT", "15"));
  const re = buildRegex();
  const now = Date.now();
  const cutoff = now - windowMinutes * 60_000;

  const items: OtpItem[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      const total = typeof mailbox === "object" ? mailbox.exists : 0;
      if (!total) return [];

      const start = Math.max(1, total - scanCount + 1);
      const range = `${start}:*`;

      for await (const msg of client.fetch(
        range,
        { uid: true, envelope: true, source: true },
        { uid: false }
      )) {
        const env_ = msg.envelope;
        const date = env_?.date ?? new Date(0);
        const ts = date.getTime();
        if (ts < cutoff) continue;

        const fromAddr =
          env_?.from?.map((a) => a.address ?? "").join(", ") ?? "";
        const subject = env_?.subject ?? "";

        if (fromFilter && !fromAddr.toLowerCase().includes(fromFilter)) continue;
        if (subjectFilter && !subject.toLowerCase().includes(subjectFilter))
          continue;

        let body = "";
        if (msg.source) {
          const parsed = await simpleParser(msg.source);
          body = (parsed.text || parsed.html || "").toString();
        }

        const code = extractCode(`${subject}\n${body}`, re);
        const preview = body.replace(/\s+/g, " ").trim().slice(0, 140);

        items.push({
          uid: msg.uid,
          code,
          from: fromAddr,
          subject,
          date: date.toISOString(),
          ageSeconds: Math.max(0, Math.round((now - ts) / 1000)),
          preview,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  // Newest first.
  items.sort((a, b) => b.date.localeCompare(a.date));
  return items;
}
