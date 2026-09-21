import { Suspense } from "react";
import { WalletScreen } from "@/components/WalletScreen";

export default function BuyPage() {
  return (
    <Suspense fallback={<main><section className="shell solo"><p>Opening buy…</p></section></main>}>
      <WalletScreen lockTab="buy" />
    </Suspense>
  );
}
