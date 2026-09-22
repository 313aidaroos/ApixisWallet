import type { Metadata } from "next";
import { Special_Elite } from "next/font/google";
import "./globals.css";

const specialElite = Special_Elite({ weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Apixis Wallet",
  description: "Apixis Family command wallet",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={specialElite.className}>{children}</body>
    </html>
  );
}
