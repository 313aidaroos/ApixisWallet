/**
 * The launch kit's map of the family: which Vercel project (found by its GitHub repo), which Supabase
 * project, and which env vars each company needs. Owner-supplied values come from `.env.launch`;
 * everything else is filled in by the kit. See docs/LAUNCH_KIT.md.
 */

/** Secrets the kit makes itself. hex32 = 64 hex chars (Renoxis), b64-32 = base64 of 32 bytes (Socixis). */
export type SecretFormat = "token" | "hex32" | "b64-32";

export interface Company {
  /** Also the Apixis ID client name and the Apixis world client name. */
  id: string;
  label: string;
  /** GitHub repo names (any case) a Vercel project may be linked to. */
  repos: string[];
  /** Supabase project ref and the env names this site reads for it. */
  supabase?: { ref: string; url: string[]; anon: string[] };
  /** Apixis Wallet client: WALLET_API_KEY + APIXIS_CLIENT_ID + APIXIS_WALLET_API_URL. */
  wallet?: boolean;
  /** Gets its own APIXIS_WORLD_KEY, registered on Apixis.dev. */
  world?: boolean;
  /** Same value everywhere, from the [shared] section of .env.launch. */
  shared?: string[];
  /** This company's own values, from its [section] in .env.launch. */
  own?: string[];
  /** Random secrets the kit generates once (never replaced once set). */
  generate?: Record<string, SecretFormat>;
  /** Fixed values. */
  fixed?: Record<string, string>;
  /** Names that must exist before the company counts as ready. */
  required: string[];
}

const NEXT = { url: ["NEXT_PUBLIC_SUPABASE_URL"], anon: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] };
const BOTH = {
  url: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
  anon: ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
};
export const HUB_REF = "myfclypikkcvfurkbzmj";
export const WALLET_REF = "kzneeksminozmhnqaaun";
export const WALLET_URL = "https://apixis-wallet.vercel.app";

const SITE_BASE = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WALLET_API_KEY"];

export const COMPANIES: Company[] = [
  {
    id: "wallet",
    label: "Apixis Wallet",
    repos: ["ApixisWallet"],
    supabase: { ref: WALLET_REF, ...NEXT },
    own: [
      "STRIPE_RESTRICTED_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_IXIS_SPARK_PRICE_ID",
      "STRIPE_IXIS_STARTER_PRICE_ID",
      "STRIPE_IXIS_STUDIO_PRICE_ID",
      "STRIPE_IXIS_EMPIRE_PRICE_ID",
    ],
    generate: { CRON_SECRET: "token" },
    required: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_RESTRICTED_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_IXIS_SPARK_PRICE_ID",
    ],
  },
  {
    id: "apixis",
    label: "Apixis.dev (hub)",
    repos: ["apixis.dev"],
    supabase: { ref: HUB_REF, url: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"], anon: [] },
    wallet: true,
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY", "OPENAI_API_KEY"],
    own: ["KV_REST_API_URL", "KV_REST_API_TOKEN", "PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"],
    generate: {
      CRON_SECRET: "token",
      CITIZEN_TOKEN_SECRET: "token",
      WORLD_PULSE_SECRET: "token",
      // Launch Console password. LAUNCH_SECRET is never generated: it encrypts stored settings.
      LAUNCH_ADMIN_KEY: "token",
    },
    required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CITIZEN_TOKEN_SECRET", "KV_REST_API_URL", "APIXIS_WORLD_KEYS"],
  },
  {
    id: "renoxis",
    label: "Renoxis",
    repos: ["renoxis.dev", "renoxis"],
    supabase: { ref: "loyjbfqpanskcecvpolt", ...NEXT },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY"],
    own: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    generate: { CONNECTION_ENCRYPTION_KEY: "hex32" },
    fixed: { APP_URL: "https://renoxis.dev" },
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "socixis",
    label: "Socixis",
    repos: ["socixis"],
    supabase: { ref: "zfwipxmhfkpcfyxhfwkf", ...BOTH },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY", "OPENAI_API_KEY", "XAI_API_KEY"],
    own: [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_LOGIN_CONFIG_ID",
      "HEYGEN_API_KEY",
      "DID_API_KEY",
      "RUNWAY_API_KEY",
      "REPLICATE_API_TOKEN",
    ],
    generate: { TOKEN_ENC_KEY: "b64-32", CRON_SECRET: "token" },
    required: [...SITE_BASE, "ANTHROPIC_API_KEY", "TOKEN_ENC_KEY"],
  },
  {
    id: "contraxis",
    label: "Contraxis",
    repos: ["contraxis.dev", "contraxis"],
    supabase: { ref: "bwhhrttzmnhcxxxctmhn", ...NEXT },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "recovra",
    label: "Recovra",
    repos: ["recovra"],
    supabase: { ref: "ewvgpfufzeyzyutjxuoh", ...NEXT },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY", "OPENAI_API_KEY"],
    own: ["NEXT_PUBLIC_LEGAL_ENTITY", "NEXT_PUBLIC_LEGAL_ADDRESS", "NEXT_PUBLIC_LEGAL_EMAIL", "NEXT_PUBLIC_GOVERNING_LAW"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "deduxis",
    label: "Deduxis",
    repos: ["deduxis"],
    supabase: { ref: "uxgtppwqonbznuoyebbb", ...NEXT },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "lyrixis",
    label: "Lyrixis",
    repos: ["lyrixis"],
    supabase: { ref: "mkuvgkjakxkytscfvnkf", ...NEXT },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    own: ["REDIS_URL", "TRANSCRIPTION_API_KEY", "TRANSCRIPTION_PROVIDER", "TRANSCRIPTION_API_BASE_URL", "TRANSCRIPTION_MODEL"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY", "REDIS_URL", "TRANSCRIPTION_API_KEY"],
  },
  {
    id: "rawixis",
    label: "Rawixis",
    repos: ["rawixis.dev", "rawixis"],
    supabase: { ref: "nglaoalnxumyohiwbpcv", ...NEXT },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "qahwahworld",
    label: "Qahwah World",
    repos: ["qahwahworld"],
    supabase: { ref: HUB_REF, ...NEXT },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    // Physical coffee keeps its own Stripe (AGENTS.md D14 exception).
    own: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "halaxis",
    label: "Halaxis",
    repos: ["halaxis.dev", "halaxis"],
    supabase: { ref: "zjlorazckuclrefcndxi", ...NEXT },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    own: ["TAVILY_API_KEY"],
    generate: { CRON_SECRET: "token" },
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "launchixis",
    label: "Launchixis",
    repos: ["launchixis"],
    supabase: { ref: "ebhzfgdavzwemrqxpvvk", ...BOTH },
    wallet: true,
    shared: ["ANTHROPIC_API_KEY"],
    own: ["ADMIN_EMAILS"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "contentbot",
    label: "PersonalContentBot",
    repos: ["personalcontentbot"],
    supabase: { ref: HUB_REF, ...BOTH },
    wallet: true,
    shared: ["ANTHROPIC_API_KEY", "XAI_API_KEY"],
    generate: { CRON_SECRET: "token" },
    // PCB_DURABLE_JOBS=true is added by the kit only after the durable-jobs columns exist in the hub database.
    required: [...SITE_BASE, "ANTHROPIC_API_KEY", "XAI_API_KEY", "CRON_SECRET", "PCB_DURABLE_JOBS"],
  },
  {
    id: "ominix",
    label: "Ominix",
    repos: ["Ominix", "nexxis"],
    supabase: { ref: "iwhvzfplvczqqxmhfkpa", ...NEXT },
    wallet: true,
    world: true,
    generate: { CRON_SECRET: "token" },
    required: [...SITE_BASE],
  },
  {
    id: "wattixis",
    label: "Wattixis",
    repos: ["wattixis"],
    supabase: { ref: "cbmxhwdysfcbxbdqfjvx", ...BOTH },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "geoxis",
    label: "Geoxis",
    repos: ["geoxis"],
    wallet: true,
    world: true,
    required: ["WALLET_API_KEY"],
  },
  {
    id: "nurserytoons",
    label: "NurseryToons",
    repos: ["nurserytoons"],
    supabase: { ref: "ybaphokmcivaclivcosm", ...BOTH },
    wallet: true,
    world: true,
    shared: ["ANTHROPIC_API_KEY"],
    own: ["OWNER_ADMIN_EMAIL"],
    required: [...SITE_BASE, "ANTHROPIC_API_KEY"],
  },
  {
    id: "pinixis",
    label: "Pinixis",
    repos: ["pinixis"],
    supabase: { ref: "jxtzdylmkulhbvpmkwsp", ...NEXT },
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    // Physical builds and listings take cards through Pinixis's own Stripe (AGENTS.md D17, exception to D14).
    own: ["ADMIN_EMAIL", "FACTORY_EMAILS", "QUOTES_EMAIL", "SUPPORT_EMAIL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    required: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "ADMIN_EMAIL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ],
  },
  {
    id: "awad-command",
    label: "awad-command (internal)",
    repos: ["awad-command"],
    supabase: { ref: HUB_REF, ...NEXT },
    shared: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    own: ["ELEVENLABS_API_KEY", "CIXY_VOICE_ID", "ALLOWED_EMAIL"],
    generate: { CRON_SECRET: "token" },
    required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ALLOWED_EMAIL"],
  },
];

/** A name counts as present when it or one of these stand-ins is set. */
export const ALTERNATIVES: Record<string, string[]> = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  SUPABASE_ANON_KEY: ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  SUPABASE_SERVICE_ROLE_KEY: ["SUPABASE_SECRET_KEY"],
  WALLET_API_KEY: ["APIXIS_WALLET_API_KEY"],
  KV_REST_API_URL: ["UPSTASH_REDIS_REST_URL"],
  KV_REST_API_TOKEN: ["UPSTASH_REDIS_REST_TOKEN"],
  // Apixis.dev falls back to these; generating the first name would change a key already in use.
  CITIZEN_TOKEN_SECRET: ["LAUNCH_SECRET"],
  LAUNCH_ADMIN_KEY: ["ADMIN_SECRET"],
};

/** Every Supabase project in the family (leaked-password protection is switched on for each). */
export function supabaseRefs(): string[] {
  return [...new Set(COMPANIES.flatMap((c) => (c.supabase ? [c.supabase.ref] : [])))];
}
