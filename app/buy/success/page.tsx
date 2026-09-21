import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutSuccess } from "@/components/CheckoutSuccess";

export const metadata: Metadata = {
  title: "Payment received · Apixis Wallet",
};

export default function SuccessPage() {
  return (
    <Suspense fallback={<main><section className="shell solo"><p>Checking payment…</p></section></main>}>
      <CheckoutSuccess />
    </Suspense>
  );
}
