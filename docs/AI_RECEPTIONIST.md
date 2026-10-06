# AI Receptionist: family add-on (every bot reads this before touching anything phone-related)

**Approved by Awad 2026-10-06.** Lead: Claude (backend). Pilot site: Contraxis.
This file is the single source of truth for the AI Receptionist. If any other note disagrees, this file wins.
Family rules (D1–D17) in `AGENTS.md` still apply. Decision row **D18** in `AGENTS.md` §0c points here.

## 1. What it is

An AI that answers a business's phone when the owner can't. A business that buys it gets an AI phone
number; they forward missed or after-hours calls to it from their own phone. The AI takes the caller's
details and sends the owner a summary by text, email, and inside the family site they bought it on.

## 2. Awad's decisions (2026-10-06): do not change without asking him

| # | Decision | What it means in code |
|---|---|---|
| R1 | **Every customer-facing family site offers the AI Receptionist** as a buyable add-on. | Each site gets the same add-on (§6). Sites listed in §8. |
| R2 | **Price: $100/month = 10,000 Ixis**, renewing every 30 days like every seat (D2). | One Wallet SKU for the whole family: `apixis.receptionist.monthly`, app `Family`, `xp: 10000`, `days: 30`, in `lib/catalog.ts` only. |
| R3 | **Built once, shared by every site.** No site builds its own (D10). | The engine lives in **Apixis.dev**, next to the shared feed and `/api/agent/provision`. |
| R4 | **One receptionist per business** (Awad's go, 2026-10-06). A person with several businesses or Socixis brands buys one per business. | Engine accounts are keyed on (person, site, brand). Sites with several businesses per person send `X-Apixis-Brand` (Socixis: `business_profiles.id`); each brand has its own number, minutes and $100/mo. |

## 3. Defaults Claude set (Awad may change these)

- **Included minutes: 300 per 30-day period.** Past the cap the AI stops answering; the owner gets a "missed call" text with the caller's number. Protects the family from per-minute costs above the $100.
- **Version 1 does:** answer, give the recording notice, collect name, callback number, address or ZIP, what they need and how urgent; answer simple questions from the owner's settings (hours, services, area); flag emergencies; send the summary.
- **Version 1 does not:** give firm prices, book appointments, take payments, or make promises for the owner. Calendar booking is the planned version 2.

## 4. Rules for every bot, agent and developer

1. **Do not build a receptionist, voice agent, call-answering or phone-number feature in your own repo.** Use the engine. If the engine is missing something, ask the lead; don't fork it.
2. **Do not add, rename or re-price a receptionist SKU anywhere.** It is `apixis.receptionist.monthly` in this Wallet's `lib/catalog.ts`, nowhere else.
3. **Sites never call the voice provider or the phone provider and never hold their keys.** Only Apixis.dev does.
4. **Every call opens with the recording notice**, on every site, in every state: Illinois requires everyone on a call to consent to recording, and we apply that everywhere. Default line: *"Hi, you've reached {business}. I'm their AI assistant, and this call may be recorded so I can pass your message along."*
5. **Safety line:** if a caller describes danger (gas smell, fire, someone hurt), the AI tells them to hang up and call 911, then flags the call as urgent. It never gives medical, legal or safety advice.
6. **Money and identity follow the family rules:** owner = Apixis ID `sub`; payment = Wallet reserve → provision → capture; a captured hold means charged, keep access.
7. **Logging:** every change goes in that repo's `AI_CHANGELOG.md`; family status changes go in `docs/FAMILY_STATUS.md` here (D15).

## 5. How it fits together

```
Caller ─► owner's phone ─(no answer / after hours)─► AI number (phone provider)
                                                         │
                                               voice AI (voice provider)
                                                         │ call ends: transcript + summary
                                                         ▼
                                   Apixis.dev /api/receptionist  (the engine)
                              saves the call · texts + emails the owner · enforces minutes
                                                         │ signed callback
                                                         ▼
                              the family site it was bought on (e.g. Contraxis → new lead)
```

- **Engine:** Apixis.dev `api/receptionist/*`, Apixis.dev Supabase (schema `apixis`, tables `receptionist_*`).
- **Engine-only env (Apixis.dev Vercel):** `VOICE_PROVIDER` (`vapi` or `retell`), the provider's API key and webhook secret, the phone provider's keys (Twilio). Awad's developer creates these accounts and sets the keys.
- **Site → engine auth:** the same as the shared feed (`Apixis.dev docs/FEED_API.md` §1a): `Authorization: Bearer <APIXIS_WORLD_KEY>`, `X-Apixis-Client: <site>`, `X-Apixis-Sub`, `X-Apixis-Email`, plus optional `X-Apixis-Brand` (R4). No new key per site. Full contract: Apixis.dev `docs/RECEPTIONIST_API.md`.
- **Payment:** the engine reserves `apixis.receptionist.monthly` with Apixis.dev's own Wallet key (the key needs the `family` app scope), provisions the number, then captures. Sites never charge for it themselves, so a site with no SKUs of its own can still offer it.
- **Planned endpoints (v1):**
  - `GET /api/receptionist/status` → `{ active, renews_at, phone_number, minutes_used, minutes_included }`
  - `POST /api/receptionist/subscribe` → buy or renew (10,000 Ixis)
  - `PUT /api/receptionist/settings` → business name, trade/type, hours, services, area, emergency rules, notify phone and email, script preset
  - `GET /api/receptionist/calls` → recent calls with summaries
  - `POST /api/receptionist/voice-webhook` → voice provider → engine (signature checked)
  - Engine → site callback `POST <site>/api/receptionist/call` (signed) for sites that turn calls into their own records. Optional per site.
- **Script presets:** `contractor` (Contraxis), `restaurant` (Socixis, qahwahworld), `general` (everyone else). A site can ask the lead for its own preset.

## 6. The add-on every site gets (same three pieces)

1. **"AI Receptionist" card** on the signed-in account or dashboard page: status, "Get it: $100/mo" or "Manage".
2. **Setup page:** the settings form, plus forwarding instructions for the owner's phone.
3. **Calls page:** recent calls from `GET /api/receptionist/calls`.

The client helper will ship as `sdk/apixis-receptionist.ts` in Apixis.dev. Sites copy it byte-for-byte, never fork it (D10). Awad owns how the pieces look on each site (D6).

## 7. Rollout

| Step | What | Status (2026-10-06) |
|---|---|---|
| 1 | This spec, D18, and a pointer in every site's `docs/APIXIS_FAMILY.md` | Done |
| 2 | Wallet SKU `apixis.receptionist.monthly` + `family` scope on Apixis.dev's key | Built: ApixisWallet PR #59, **held** (merging makes it sellable) |
| 3 | Engine in Apixis.dev (one per business, R4) | Built: Apixis.dev PR #85, held, 16 tests pass |
| 4 | Contraxis pilot (card, setup, calls become phone leads) | Built: Contraxis PR #60, held, CI green |
| 4b | Socixis (one per brand, prefilled from Brand Kit + Website brief, calls → Tasks + Customers) | Built on Awad's request: Socixis PR #81, held |
| 5 | Awad reviews · developer sets up voice + phone accounts · one real contractor tests | Waiting on 2–4 |
| 6 | Add-on on every other site in §8 | After step 5 |

Nothing goes live until Awad reviews step 5.

## 8. Sites

| Site | Preset | Note |
|---|---|---|
| Contraxis.dev | contractor | Pilot, PR #60. Calls become phone leads for the pro. |
| Socixis | restaurant (food brands) / general | Built, PR #81. One receptionist per brand (R4). |
| qahwahworld | restaurant | |
| Apixis.dev | general | Also hosts the engine. |
| Renoxis.dev | general | |
| Rawixis.dev | general | |
| Halaxis.dev | general | Halaxis's own payments are off; the receptionist is charged by the engine, so the site still needs no SKUs. |
| Wattixis | general | |
| Lyrixis | general | |
| Deduxis | general | |
| Recovra | general | |
| Geoxis | general | |
| Launchixis | general | |
| Ominix | general | |
| NurseryToons | general | |
| Pinixis | general | **Open for Awad:** Ixis is off on Pinixis (D17). Allow Ixis for this one add-on, or charge by card through Pinixis's Stripe? Notes only until he decides. |
| thenightexchange | general | Not a Wallet or Apixis ID client yet; gets the add-on after Apixis ID sign-in lands. |

Not offered (internal tools): AwadBot, PersonalContentBot, awad-command, AFCCommand, AidaroosHolding, github-actions. Awad can add any of them.

## 9. Open items for Awad

- Pinixis payment method (§8).
- Confirm the 300-minute cap (§3).
- Developer: create the voice-provider and phone-provider accounts and put the keys in Apixis.dev's Vercel env.
