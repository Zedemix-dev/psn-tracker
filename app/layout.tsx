import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// The variable TTF is shipped in the repo (also read by the Plat Wall PNG export), so the build needs no network.
const sora = localFont({
  src: "../public/fonts/Sora-Variable.ttf",
  weight: "300 700",
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PSN Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body>{children}</body>
    </html>
  );
}
