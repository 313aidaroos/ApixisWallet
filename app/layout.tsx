import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk, Libre_Caslon_Display } from "next/font/google";
import "./globals.css";
import "./wallet.css";
import "./wallet-integration.css";
import "./wallet-cyber.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
  fallback: [
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});
const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space",
});
const serif = Libre_Caslon_Display({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-caslon",
});

export const metadata: Metadata = {
  title: "Apixis Wallet",
  description: "Apixis Family command wallet",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${sans.className} ${sans.variable} ${display.variable} ${serif.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
