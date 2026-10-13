/** @type {import('next').NextConfig} */
const nextConfig = {
  // imapflow + mailparser are server-only; keep them external so they aren't bundled.
  serverExternalPackages: ["imapflow", "mailparser"],
};

module.exports = nextConfig;
