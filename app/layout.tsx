import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Apixis Wallet", description: "One balance across every Apixis product." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
