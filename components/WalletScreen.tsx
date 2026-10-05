"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  LayoutGrid,
  List,
  Megaphone,
  ShoppingBag,
  TrendingUp,
  WalletCards,
  Orbit,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
  Download,
} from "lucide-react";
import {
  pointPacks,
  redeemCatalog,
  shopCatalog,
  shopCategories,
  type ShopCategory,
} from "@/lib/catalog";
import { appSlug, resolveDestination } from "@/lib/checkout/destinations";
import { returnHost } from "@/lib/checkout/return-url";
import { bulletins } from "@/lib/news";
import { CompaniesDirectory } from "@/components/CompaniesDirectory";
import { GoldCoinRain, useReducedMotion } from "@/components/WalletMotion";
import {
  WalletChart,
  transactionAmount,
  visibleTransactions,
} from "@/components/WalletChart";
import {
  fetchBalance,
  fetchHistory,
  redeemProduct,
  WalletClientError,
  type Balance,
  type HistoryItem,
} from "@/lib/wallet-client";

type Tab =
  | "companies"
  | "home"
  | "buy"
  | "redeem"
  | "shop"
  | "market"
  | "news"
  | "activity";
type Product = { key: string; name: string; xp: number };
const tabs = [
  { id: "home", name: "HQ", icon: LayoutGrid },
  { id: "companies", name: "Apixis Companies", icon: Orbit },
  { id: "buy", name: "Buy", icon: WalletCards },
  { id: "redeem", name: "Redeem", icon: Coins },
  { id: "shop", name: "Shop", icon: ShoppingBag },
  { id: "market", name: "Tape", icon: TrendingUp },
  { id: "news", name: "News", icon: Megaphone },
  { id: "activity", name: "Log", icon: List },
] as const;
const headings: Record<Tab, [string, string, string]> = {
  home: [
    "WALLET OVERVIEW",
    "Welcome to your next move.",
    "One balance. Every Apixis possibility.",
  ],
  companies: [
    "THE APIXIS FAMILY",
    "Apixis Companies",
    "The Ixis ecosystem • 15 companies, one platform • Explore and visit each company",
  ],
  buy: [
    "POWER YOUR NEXT MOVE",
    "Buy a little possibility.",
    "One top-up. Every participating Apixis app.",
  ],
  redeem: [
    "TURN CREDIT INTO POSSIBILITY",
    "Make your Ixis matter.",
    "Unlock a workspace, a creative tool, or your next step.",
  ],
  shop: [
    "MADE FOR YOUR WORLD",
    "A little more you.",
    "Useful files and templates from the Apixis family.",
  ],
  market: [
    "THE IXIS SIGNAL",
    "Every movement. In view.",
    "Explore the Ixis rate and your wallet activity over time.",
  ],
  news: [
    "TRANSMISSIONS FROM APIXIS",
    "The next thing starts here.",
    "Updates from across the family, in one place.",
  ],
  activity: [
    "YOUR PERSONAL LEDGER",
    "Every Ixis, accounted for.",
    "Your purchases, redemptions, and bonus credits.",
  ],
};
const kinds: Record<string, string> = {
  purchase: "Purchase",
  bonus: "Bonus",
  spend: "Redeem",
  refund: "Refund",
  adjustment: "Adjustment",
};
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmt = (n: number) => n.toLocaleString("en-US");
function mergeHistory(previous: HistoryItem[], incoming: HistoryItem[]) {
  return [
    ...new Map(
      [...previous, ...incoming].map((item) => [item.id, item]),
    ).values(),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function LedgerRows({
  items,
  stream = false,
  unit,
}: {
  items: HistoryItem[];
  stream?: boolean;
  unit: string;
}) {
  return items.map((item) => {
    const amount = transactionAmount(item);
    return (
      <div className={stream ? "ix-stream-row" : "ix-log-row"} key={item.id}>
        <span className={`ix-flow-icon ${amount < 0 ? "out" : ""}`}>
          {amount < 0 ? <ArrowUpRight /> : <ArrowDownLeft />}
        </span>
        <div className="ix-receipt-copy">
          <div className="ix-log-name">{item.description}</div>
          <div className="ix-log-meta">
            {kinds[item.kind] ?? item.kind}
            {item.app ? ` · ${item.app}` : ""}
          </div>
          <time className="ix-log-meta" dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {!stream && <div className="ix-receipt-id">TX {item.id}</div>}
        </div>
        <span className={`ix-log-amount ${amount < 0 ? "out" : ""}`}>
          {amount > 0 ? "+" : ""}
          {fmt(amount)}
          <small>{unit}</small>
        </span>
      </div>
    );
  });
}

function RedeemDialog({
  product,
  unit,
  busy,
  onClose,
  onConfirm,
}: {
  product: Product;
  unit: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="ix-confirm"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="ix-dialog-head">
        <div>
          <p className="ix-eyebrow">REDEEM IXIS</p>
          <h2>Confirm your redemption</h2>
        </div>
        <button
          className="ix-icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cancel redemption"
        >
          <X />
        </button>
      </div>
      <p>{product.name}</p>
      <div className="ix-detail">
        <span>Total</span>
        <strong>
          {fmt(product.xp)} {unit}
        </strong>
      </div>
      <p className="ix-note">This spends Ixis from your Wallet.</p>
      <div className="ix-confirm-actions">
        <button className="ix-button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          className="ix-button ix-primary"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Redeeming…" : "Confirm redemption"}
        </button>
      </div>
    </dialog>
  );
}

export function WalletScreen({
  lockTab,
  unitLabel = "Ixis",
  finalSaleNotice,
}: {
  lockTab?: Tab;
  unitLabel?: string;
  finalSaleNotice: string;
}) {
  const unit = unitLabel === "Ixis Coin" ? "Ixis Coin" : "Ixis";
  const params = useSearchParams();
  const router = useRouter();
  const signInHere = () =>
    router.push(
      `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
    );
  const queryTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    tabs.some((item) => item.id === queryTab)
      ? (queryTab as Tab)
      : (lockTab ?? "home"),
  );
  const returnUrl = params.get("return_url") ?? params.get("returnUrl") ?? "";
  const product =
    params.get("product") ??
    params.get("app") ??
    params.get("destination") ??
    "";
  const destination = resolveDestination(product),
    allowedReturnHost = returnUrl ? returnHost(returnUrl) : null;
  const [balance, setBalance] = useState<Balance | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<
    "loading" | "ready" | "signedout" | "error"
  >("loading");
  const [updatedAt, setUpdatedAt] = useState(0);
  const [notice, setNotice] = useState(
    params.get("checkout") === "cancelled"
      ? "Checkout cancelled. Choose a pack whenever you are ready."
      : "",
  );
  const [motionEnabled, setMotionEnabled] = useState(true);
  const reducedMotion = useReducedMotion(),
    motion = motionEnabled && !reducedMotion;
  const [feedPaused, setFeedPaused] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [shopFilter, setShopFilter] = useState<"all" | ShopCategory>("all");
  const [redeemFilter, setRedeemFilter] = useState("All");
  const [showAllRedeem, setShowAllRedeem] = useState(false);
  const [logFilter, setLogFilter] = useState("All");
  const [buying, setBuying] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const refreshPromise = useRef<Promise<void> | null>(null),
    purchaseLock = useRef(false),
    redeemLock = useRef(false),
    olderLock = useRef(false);
  const redeemKeys = useRef(new Map<string, string>());
  const historyEpoch = useRef(0);

  const refresh = useCallback(() => {
    if (refreshPromise.current) return refreshPromise.current;
    historyEpoch.current += 1;
    const request = (async () => {
      try {
        const [current, receipts] = await Promise.all([
          fetchBalance(),
          fetchHistory({ limit: 100 }),
        ]);
        setBalance(current);
        setHistory((previous) => {
          // A session may change in another tab. Retain older pages only when the
          // refreshed ledger overlaps this same wallet's globally unique receipts.
          const ids = new Set(receipts.transactions.map((item) => item.id));
          return previous.some((item) => ids.has(item.id))
            ? mergeHistory(previous, receipts.transactions)
            : receipts.transactions;
        });
        setTotal(receipts.total);
        setStatus("ready");
        setUpdatedAt(Date.now());
      } catch (error) {
        if (error instanceof WalletClientError && error.needsSignIn) {
          setBalance(null);
          setHistory([]);
          setTotal(0);
          setStatus("signedout");
          redeemKeys.current.clear();
        } else setStatus("error");
      }
    })();
    refreshPromise.current = request;
    void request.finally(() => {
      refreshPromise.current = null;
    });
    return request;
  }, []);
  useEffect(() => {
    // Initial fetch and visibility/focus refresh use the existing authenticated Wallet APIs.
    void refresh();
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refresh]);
  useEffect(() => {
    if (feedPaused || status === "signedout") return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh, feedPaused, status]);
  const loadOlder = async () => {
    if (olderLock.current || history.length >= total) return;
    olderLock.current = true;
    setLoadingOlder(true);
    const epoch = historyEpoch.current;
    try {
      const page = await fetchHistory({ limit: 100, offset: history.length });
      if (epoch === historyEpoch.current) {
        setHistory((previous) => mergeHistory(previous, page.transactions));
        setTotal(page.total);
      }
    } catch {
      setNotice("Older history could not be loaded. Please try again.");
    } finally {
      olderLock.current = false;
      setLoadingOlder(false);
    }
  };

  const navigate = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    // Keep the sibling-app return URL and product intact when changing tabs.
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const buy = async (id: string) => {
    if (purchaseLock.current) return;
    purchaseLock.current = true;
    setBuying(id);
    setNotice("Opening secure checkout…");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packId: id,
          ...(returnUrl ? { return_url: returnUrl } : {}),
          ...(product ? { product } : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        signInHere();
        return;
      }
      if (!response.ok) {
        setNotice(
          typeof data?.error === "string"
            ? data.error
            : "Checkout is unavailable. Please try again.",
        );
        return;
      }
      if (typeof data?.url === "string") window.location.assign(data.url);
      else
        setNotice("Checkout did not return a payment link. Please try again.");
    } catch {
      setNotice("Checkout could not be opened. Please try again.");
    } finally {
      purchaseLock.current = false;
      setBuying(null);
    }
  };
  const requestRedeem = (item: Product) => {
    if (status === "signedout") {
      signInHere();
      return;
    }
    if (status !== "ready" || !balance) {
      setNotice("Refresh your wallet before redeeming.");
      return;
    }
    if (balance.available < item.xp) {
      setNotice(`You need ${fmt(item.xp - balance.available)} more ${unit}.`);
      navigate("buy");
      return;
    }
    setPendingProduct(item);
  };
  const redeem = async () => {
    if (!pendingProduct || redeemLock.current) return;
    redeemLock.current = true;
    setRedeeming(true);
    const item = pendingProduct;
    const key = redeemKeys.current.get(item.key) ?? crypto.randomUUID();
    redeemKeys.current.set(item.key, key);
    try {
      const result = await redeemProduct(item.key, key);
      if (result.ok) {
        redeemKeys.current.delete(item.key);
        setNotice(
          `${item.name} redeemed for ${fmt(item.xp)} ${unit}. Receipt ${result.receiptId}.`,
        );
      } else if (result.reason === "signin") {
        signInHere();
        return;
      } else {
        setNotice(result.message);
        if (result.reason === "insufficient") {
          redeemKeys.current.delete(item.key);
          navigate("buy");
        }
      }
    } catch {
      setNotice(
        "We could not confirm this redemption. Refresh your ledger; retrying this product will use the same transaction reference.",
      );
    } finally {
      redeemLock.current = false;
      setRedeeming(false);
      setPendingProduct(null);
      await refresh();
    }
  };
  const exportHistory = () => {
    const csv = [
      "Transaction ID,Date,Type,Company,Description,Ixis",
      ...visibleTransactions(history).map((item) =>
        [
          item.id,
          item.createdAt,
          item.kind,
          item.app ?? "",
          item.description,
          transactionAmount(item),
        ]
          .map(
            (value) =>
              `"${String(value)
                .replace(/^[=+@\-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "apixis-wallet-loaded-history.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const connected = balance !== null,
    available = balance?.available ?? 0;
  const receipts = visibleTransactions(history);
  const scopedRedeem =
    destination && destination.slug !== "wallet" && !showAllRedeem
      ? redeemCatalog.filter((item) => appSlug(item.app) === destination.slug)
      : redeemCatalog;
  const redeemItems = (
    scopedRedeem.length ? scopedRedeem : redeemCatalog
  ).filter((item) => redeemFilter === "All" || item.app === redeemFilter);
  const shopItems = shopCatalog.filter(
    (item) => shopFilter === "all" || item.category === shopFilter,
  );
  const [eyebrow, title, subtitle] = headings[tab];
  const empty = (
    <p className="ix-empty">
      {status === "loading"
        ? "Loading your wallet…"
        : status === "signedout"
          ? "Sign in to see your balance and transactions."
          : status === "error"
            ? "Wallet connection unavailable. Please try refreshing."
            : "No transactions yet. Your activity will appear here."}
    </p>
  );
  const stream = (
    <section className="ix-stream ix-panel">
      <div className="ix-section-title">
        <h2>Transaction stream</h2>
        <span className="ix-stream-label">
          {status === "ready" && !feedPaused ? "AUTO UPDATE" : "YOUR WALLET"}
        </span>
      </div>
      <p className="ix-stream-caption">
        Your transactions · refreshes every 15 seconds
      </p>
      <div className="ix-stream-list">
        {receipts.length ? (
          <LedgerRows items={receipts.slice(0, 5)} stream unit={unit} />
        ) : (
          empty
        )}
      </div>
      <div className="ix-stream-bottom">
        <span>
          {updatedAt
            ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Waiting for wallet connection"}
        </span>
        <button
          className="ix-pause"
          aria-pressed={feedPaused}
          onClick={() => setFeedPaused((value) => !value)}
        >
          {feedPaused ? <Play /> : <Pause />}
          {feedPaused ? "Resume" : "Pause"}
        </button>
      </div>
    </section>
  );
  const chart = (
    <WalletChart
      history={history}
      total={total}
      updatedAt={updatedAt}
      connected={connected}
      loadOlder={() => void loadOlder()}
      loadingOlder={loadingOlder}
    />
  );

  return (
    <div id="ix-universe" data-page={tab} data-motion={motion ? "on" : "off"}>
      <GoldCoinRain motion={motion} />
      <div className="ix-shell">
        <aside className="ix-side">
          <button
            className="ix-brand"
            onClick={() => navigate("home")}
            aria-label="Apixis Wallet home"
          >
            <Image
              className="ix-apixis-logo"
              src="/brand/apixis-family-logo.png"
              alt="Apixis Family Company"
              width={1774}
              height={887}
              sizes="180px"
              priority
            />
            <small>WALLET</small>
          </button>
          <nav className="ix-nav" aria-label="Main navigation">
            <div className="ix-nav-title">YOUR CONTROL CENTER</div>
            {tabs.map((item) => (
              <button
                key={item.id}
                aria-current={tab === item.id ? "page" : undefined}
                className={tab === item.id ? "ix-selected" : ""}
                onClick={() => navigate(item.id)}
              >
                <item.icon aria-hidden="true" />
                {item.name}
              </button>
            ))}
          </nav>
          <div className="ix-side-bottom">
            <div className="ix-side-message">
              <strong>Your universe, connected.</strong>
              <p>
                One identity. One balance.
                <br />
                Every Apixis possibility.
              </p>
              <a className="ix-text-button" href="https://www.apixis.dev">
                Explore Apixis ↗
              </a>
            </div>
            <div className="ix-user">
              <span className="ix-avatar">
                <WalletCards />
              </span>
              <div>
                <strong>Apixis ID</strong>
                <small>
                  {status === "ready"
                    ? "Wallet connected"
                    : "Your shared identity"}
                </small>
              </div>
            </div>
          </div>
        </aside>
        <main className="ix-main">
          <header className="ix-top">
            <div className="ix-breadcrumb">
              Apixis Wallet <span>/</span>
              <b>{tabs.find((item) => item.id === tab)?.name}</b>
            </div>
            <div className="ix-top-actions">
              <span className="ix-demo">100 {unit.toUpperCase()} = $1</span>
              {status === "signedout" && (
                <button className="ix-button ix-primary" onClick={signInHere}>
                  Sign in
                </button>
              )}
              <button
                className="ix-icon-button"
                onClick={() => void refresh()}
                aria-label="Refresh wallet"
              >
                <RefreshCw />
              </button>
              <button
                className="ix-icon-button"
                disabled={reducedMotion}
                aria-label={motion ? "Pause animations" : "Resume animations"}
                aria-pressed={!motion}
                onClick={() => setMotionEnabled((value) => !value)}
              >
                {motion ? <Pause /> : <Play />}
              </button>
            </div>
          </header>
          <div className="ix-content">
            <div className="ix-heading">
              <div>
                <p className="ix-eyebrow">{eyebrow}</p>
                <h1>{title}</h1>
                <p className="ix-subtitle">{subtitle}</p>
              </div>
              {tab === "activity" && (
                <button
                  className="ix-button"
                  disabled={!receipts.length}
                  onClick={exportHistory}
                >
                  <Download />
                  Export loaded
                </button>
              )}
            </div>
            {notice && (
              <div className="ix-notice" role="status">
                <span>{notice}</span>
                <button
                  className="ix-icon-button"
                  onClick={() => setNotice("")}
                  aria-label="Dismiss message"
                >
                  <X />
                </button>
              </div>
            )}
            {status === "error" && (
              <div className="ix-notice" role="status">
                <span>
                  {balance
                    ? "Connection interrupted. Showing your last retrieved balance and transactions."
                    : "Your wallet could not be loaded."}
                </span>
                <button
                  className="ix-text-button"
                  onClick={() => void refresh()}
                >
                  Try again
                </button>
              </div>
            )}
            {tab === "companies" && <CompaniesDirectory motion={motion} />}
            {tab === "home" && (
              <>
                <section className="cyber-hero" aria-label="Wallet overview">
                  <div className="cyber-copy">
                    <div className="ix-eyebrow">THE CURRENCY OF YOUR WORLD</div>
                    <h2>
                      Big ideas.
                      <br />
                      <span>Ixis energy.</span>
                    </h2>
                    <p>
                      Fuel your next creation.
                      <br />
                      One wallet for the whole family.
                    </p>
                    <div className="cyber-rate">
                      <i className="ix-led" aria-hidden="true" />
                      100 IXIS = $1.00
                    </div>
                  </div>
                  <div className="cyber-coin-stage" aria-hidden="true">
                    <div className="cyber-orbit" />
                    <div className="cyber-orbit second" />
                    <div className="cyber-big-coin">
                      <div className="cyber-coin-type">
                        <small>APIXIS FAMILY</small>
                        <strong>IXIS</strong>
                        <small>ONE CONNECTED WORLD</small>
                      </div>
                    </div>
                    <div className="cyber-chip">IXIS / DIGITAL CREDIT</div>
                  </div>
                  <div className="cyber-balance">
                    <div className="cyber-balance-label">Available balance</div>
                    <div className="cyber-balance-value">
                      {connected ? fmt(available) : "—"}
                      <small>{unit.toUpperCase()}</small>
                    </div>
                    <div className="cyber-balance-eq">
                      {connected
                        ? `${money(available / 100)} in platform credit`
                        : status === "signedout"
                          ? "Sign in to see your balance"
                          : "Waiting for wallet connection"}
                    </div>
                    <div className="cyber-balance-actions">
                      <button
                        className="ix-button ix-primary"
                        onClick={() => navigate("buy")}
                      >
                        <Plus />
                        Buy Ixis
                      </button>
                      <button
                        className="ix-button"
                        onClick={() => navigate("redeem")}
                      >
                        Redeem <ArrowUpRight />
                      </button>
                    </div>
                    <div className="cyber-balance-note">
                      Your purchased Ixis never expire
                    </div>
                  </div>
                </section>
                <div className="cyber-metrics">
                  {[
                    {
                      label: "Purchased",
                      value: balance?.paid,
                      color: "#7ff7e1",
                    },
                    {
                      label: "Bonus credits",
                      value: balance?.bonus,
                      color: "#d0a4ff",
                    },
                    {
                      label: "On hold",
                      value: balance?.reserved,
                      color: "#ffce89",
                    },
                  ].map((metric) => (
                    <div
                      className="cyber-metric"
                      style={{ "--metric": metric.color } as CSSProperties}
                      key={metric.label}
                    >
                      <small>{metric.label}</small>
                      <strong>
                        {metric.value === undefined ? "—" : fmt(metric.value)}
                        <span>{unit.toUpperCase()}</span>
                      </strong>
                    </div>
                  ))}
                  <div
                    className="cyber-metric"
                    style={{ "--metric": "#86b6ff" } as CSSProperties}
                  >
                    <small>One connected family</small>
                    <strong>
                      15<span>COMPANIES</span>
                    </strong>
                  </div>
                </div>
                <div className="ix-market-grid">
                  {chart}
                  {stream}
                </div>
                <section className="ix-section">
                  <div className="ix-section-title">
                    <h2>Enter the Apixis universe.</h2>
                    <button
                      className="ix-text-button"
                      onClick={() => navigate("companies")}
                    >
                      All companies →
                    </button>
                  </div>
                  <CompaniesDirectory featured motion={motion} />
                </section>
              </>
            )}
            {tab === "buy" && (
              <>
                {(returnUrl || product) && (
                  <p className="ix-notice">
                    {allowedReturnHost
                      ? `After payment you return to ${allowedReturnHost}. `
                      : returnUrl
                        ? "Wallet will verify your return destination at checkout. "
                        : ""}
                    {destination ? `From ${destination.label}.` : ""}
                  </p>
                )}
                <section className="ix-buy-hero ix-panel">
                  <p className="ix-eyebrow">100 IXIS = $1</p>
                  <h2>
                    Small coin.
                    <br />
                    Big universe.
                  </h2>
                  <p>
                    Your purchased Ixis never expire. Use them across the Apixis
                    family.
                  </p>
                  <span className="ix-coin ix-hero-coin" aria-hidden="true">
                    IXIS
                  </span>
                </section>
                <div className="ix-pack-grid">
                  {pointPacks.map((pack, index) => (
                    <article
                      key={pack.id}
                      className={`ix-pack ix-panel ${index === 2 ? "featured" : ""}`}
                    >
                      <p className="ix-pack-label">{pack.name.toUpperCase()}</p>
                      <h2 className="ix-pack-amount">{fmt(pack.xp)}</h2>
                      <p className="ix-pack-price">
                        {unit} · {money(pack.price)}
                      </p>
                      <button
                        className={`ix-button ${index === 2 ? "ix-primary" : ""}`}
                        disabled={buying !== null}
                        onClick={() => void buy(pack.id)}
                      >
                        {buying === pack.id
                          ? "Opening…"
                          : `Choose ${pack.name}`}
                      </button>
                    </article>
                  ))}
                </div>
                <p className="ix-note">
                  <ShieldCheck />
                  Secure checkout with Stripe. {finalSaleNotice}
                </p>
              </>
            )}
            {tab === "redeem" && (
              <>
                {destination && destination.slug !== "wallet" && (
                  <p className="ix-note">
                    {showAllRedeem
                      ? "Showing all companies."
                      : `Products for ${destination.label}.`}{" "}
                    <button
                      className="ix-text-button"
                      onClick={() => {
                        setShowAllRedeem((value) => !value);
                        setRedeemFilter("All");
                      }}
                    >
                      {showAllRedeem
                        ? `Only ${destination.label}`
                        : "All products"}
                    </button>
                  </p>
                )}
                <label className="ix-catalog-select">
                  Company{" "}
                  <select
                    value={redeemFilter}
                    onChange={(event) => setRedeemFilter(event.target.value)}
                  >
                    <option>All</option>
                    {Array.from(
                      new Set(
                        (scopedRedeem.length
                          ? scopedRedeem
                          : redeemCatalog
                        ).map((item) => item.app),
                      ),
                    ).map((app) => (
                      <option key={app}>{app}</option>
                    ))}
                  </select>
                </label>
                <div className="ix-products">
                  {redeemItems.map((item) => (
                    <article
                      className="ix-product ix-panel"
                      key={item.key}
                      style={{ "--company": item.color } as CSSProperties}
                    >
                      <span className="ix-company-icon">
                        <Coins />
                      </span>
                      <p className="ix-eyebrow" style={{ color: item.color }}>
                        {item.app}
                      </p>
                      <h3>{item.name}</h3>
                      <p>{item.includes}</p>
                      <div className="ix-price">
                        {fmt(item.xp)}{" "}
                        <small>
                          {unit}
                          {"days" in item ? ` · ${item.days} days` : ""}
                        </small>
                      </div>
                      <button
                        className="ix-button"
                        disabled={redeeming || status === "loading"}
                        onClick={() => requestRedeem(item)}
                      >
                        Redeem <ArrowUpRight />
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "shop" && (
              <>
                <div className="ix-filters">
                  <button
                    className={`ix-filter ${shopFilter === "all" ? "ix-selected" : ""}`}
                    onClick={() => setShopFilter("all")}
                    aria-pressed={shopFilter === "all"}
                  >
                    All items
                  </button>
                  {shopCategories.map((category) => (
                    <button
                      key={category.id}
                      className={`ix-filter ${shopFilter === category.id ? "ix-selected" : ""}`}
                      aria-pressed={shopFilter === category.id}
                      onClick={() => setShopFilter(category.id)}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
                <div className="ix-products">
                  {shopItems.map((item) => (
                    <article
                      className="ix-product ix-panel"
                      key={item.key}
                      style={{ "--company": item.color } as CSSProperties}
                    >
                      <div className="ix-product-art">
                        <span className="ix-file-art">▤</span>
                      </div>
                      <p className="ix-eyebrow" style={{ color: item.color }}>
                        {item.app}
                      </p>
                      <h3>{item.name}</h3>
                      <p>{item.blurb}</p>
                      <div className="ix-price">
                        {fmt(item.xp)}{" "}
                        <small>
                          {unit} · {money(item.xp / 100)}
                        </small>
                      </div>
                      <button
                        className="ix-button"
                        disabled={redeeming || status === "loading"}
                        onClick={() => requestRedeem(item)}
                      >
                        Buy with {unit} <ArrowUpRight />
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "market" && (
              <>
                {chart}
                <div className="ix-tape-bottom">
                  {stream}
                  <section className="ix-explainer ix-panel">
                    <div className="ix-section-title">
                      <h2>The Ixis rate</h2>
                      <span className="ix-coin">IX</span>
                    </div>
                    <p>
                      Ixis is fixed platform credit. One Ixis equals $0.01, so
                      its price change is 0%. Activity shows credits and
                      redemptions in your own wallet.
                    </p>
                    <div className="ix-detail">
                      <span>Rate</span>
                      <span>100 Ixis = $1</span>
                    </div>
                    <div className="ix-detail">
                      <span>Data source</span>
                      <span>Your Wallet ledger</span>
                    </div>
                    <p>
                      Use the time controls to explore your recorded activity.
                      Load older history when a period extends beyond the
                      records shown.
                    </p>
                  </section>
                </div>
              </>
            )}
            {tab === "news" && (
              <div className="ix-news-grid">
                {bulletins.map((item, index) => (
                  <article
                    className={`${index === 0 ? "ix-news-main" : "ix-news-small"} ix-panel`}
                    key={item.id}
                  >
                    <p className="ix-eyebrow">
                      {item.tag} · {item.source}
                    </p>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                    <time className="ix-news-date">{item.at}</time>
                    {index === 0 && (
                      <button
                        className="ix-button"
                        onClick={() => navigate("companies")}
                      >
                        Meet the family <ArrowUpRight />
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            {tab === "activity" && (
              <>
                <div className="ix-filters">
                  {[
                    "All",
                    "purchase",
                    "spend",
                    "bonus",
                    "refund",
                    "adjustment",
                  ].map((kind) => (
                    <button
                      key={kind}
                      className={`ix-filter ${logFilter === kind ? "ix-selected" : ""}`}
                      aria-pressed={logFilter === kind}
                      onClick={() => setLogFilter(kind)}
                    >
                      {kinds[kind] ?? kind}
                    </button>
                  ))}
                </div>
                <section className="ix-log ix-panel">
                  {receipts.filter(
                    (item) => logFilter === "All" || item.kind === logFilter,
                  ).length ? (
                    <LedgerRows
                      items={receipts.filter(
                        (item) =>
                          logFilter === "All" || item.kind === logFilter,
                      )}
                      unit={unit}
                    />
                  ) : (
                    empty
                  )}
                </section>
                {history.length < total && (
                  <button
                    className="ix-button ix-load-more"
                    onClick={() => void loadOlder()}
                    disabled={loadingOlder}
                  >
                    {loadingOlder
                      ? "Loading…"
                      : `Load older history (${history.length} of ${total} records)`}
                  </button>
                )}
              </>
            )}
            <footer className="ix-footer">
              <span>APIXIS FAMILY COMPANY · 100 {unit} = $1</span>
              <span>ONE IDENTITY. ONE WALLET.</span>
            </footer>
          </div>
        </main>
      </div>
      {pendingProduct && (
        <RedeemDialog
          product={pendingProduct}
          unit={unit}
          busy={redeeming}
          onClose={() => setPendingProduct(null)}
          onConfirm={() => void redeem()}
        />
      )}
    </div>
  );
}
