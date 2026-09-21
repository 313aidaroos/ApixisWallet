import { Suspense } from "react";
import { WalletScreen } from "@/components/WalletScreen";

export default function Home() {
  return (
    <Suspense fallback={<main><section className="shell solo"><p>Loading wallet…</p></section></main>}>
      <WalletScreen />
    </Suspense>
  );
}
