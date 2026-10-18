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

const siteUrl = "https://wallet.apixis.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Apixis Wallet",
  description: "Apixis Family command wallet",
  applicationName: "Apixis Wallet",
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Apixis Wallet",
    description: "Apixis Family command wallet",
    url: siteUrl,
    siteName: "Apixis Wallet",
    type: "website",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Apixis Family Company",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apixis Wallet",
    description: "Apixis Family command wallet",
    images: ["/brand/og-image.png"],
  },
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
