import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutSuccess } from "@/components/CheckoutSuccess";
import { ixisUnitLabel } from "@/lib/ixis-asset/mode";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment received · Apixis Wallet",
};

export default function CompletePage() {
  const unitLabel = ixisUnitLabel();
  return (
    <Suspense fallback={<main><section className="shell solo"><p>Checking payment…</p></section></main>}>
      <CheckoutSuccess unitLabel={unitLabel} />
    </Suspense>
  );
}
