import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriAudit",
  description:
    "AI audit workspace with a searchable, verifiable execution trail backed by CooL evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
