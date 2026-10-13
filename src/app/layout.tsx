import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tester OTP Dashboard",
  description: "Latest login codes for App Store review",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
