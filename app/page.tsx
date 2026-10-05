import { Suspense } from "react";
import { WalletScreen } from "@/components/WalletScreen";
import { ixisUnitLabel } from "@/lib/ixis-asset/mode";
import { FINAL_SALE_NOTICE } from "@/lib/checkout/policy";

export const dynamic = "force-dynamic";

export default function Home() {
  const unitLabel = ixisUnitLabel();
  return (
    <Suspense
      fallback={
        <main>
          <section className="shell solo">
            <p>Loading wallet…</p>
          </section>
        </main>
      }
    >
      <WalletScreen unitLabel={unitLabel} finalSaleNotice={FINAL_SALE_NOTICE} />
    </Suspense>
  );
}
