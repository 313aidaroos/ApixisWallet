# Launch kit — add every key with one command

You type each key **once** in one file on your Mac. The kit puts it into every Vercel project that
needs it, makes all the passwords/secrets itself, sets up the databases and redeploys.

## Do this

```bash
cd ApixisWallet
git pull && npm install
cp .env.launch.example .env.launch      # then open .env.launch and fill in what you have
npm run launch:check                    # shows every company: ready, or exactly what is missing
npm run launch -- --dry-run             # optional: shows what it would set (names only)
npm run launch                          # does it
npm run launch:check                    # confirm: "N of 19 companies ready"
```

Run it again any time you get a new key — it only adds what is missing.

## What the kit does (and never does)

| Does | Never |
|---|---|
| Finds each company's Vercel project from its GitHub repo | Replaces a value that is already set |
| Adds the keys you typed, to every project that uses them | Prints a key or secret on screen |
| Makes secrets in the right format (cron secrets, Renoxis/Socixis encryption keys, Apixis.dev login secret) | Re-generates a secret that is already in use |
| Fetches each project's Supabase URL + keys (needs `SUPABASE_ACCESS_TOKEN`) | Mixes projects: if a site's Supabase URL points elsewhere it stops and tells you |
| Creates Wallet keys for sites that have none (Ominix, Wattixis today) and registers them | Gives a site a second Wallet key (that breaks sign-in) |
| Gives every site its Apixis world key and registers the hashes on Apixis.dev | Touches AwadBot or anything that trades |
| Runs the hub SQL (security fixes + ContentBot durable jobs), then turns on `PCB_DURABLE_JOBS` | Sends email, charges cards or flips `require_sso` |
| Turns on leaked-password protection on every Supabase project (paid plan only) | |
| Redeploys only the projects it changed | |

`.env.launch` is in `.gitignore`. Keep it on your Mac; delete it after launch if you like (Vercel has
everything). The Vercel and Supabase tokens can be revoked afterwards.

## If it says…

- **"Vercel refused the token"** → new token at Vercel → Account Settings → Tokens. Projects in a team:
  also set `VERCEL_TEAM_ID`.
- **"no Vercel project linked to GitHub repo X"** → that site's Vercel project isn't connected to its repo
  (Vercel → project → Settings → Git), or add `x=<project name>` under `[vercel]`.
- **"several Vercel projects use repo X"** → add `x=<the right project>` under `[vercel]`
  (e.g. Contraxis: delete `temporary-turbo-sienna-p6yqsjd` in Vercel, or name the right one).
- **"already has a Wallet key in the database but not in Vercel"** → that key was lost. Tell Claude to
  replace it (old one is switched off, new one issued).
- **"leaked-password protection: needs the Supabase Pro plan"** → only matters if you upgrade.

Code: `scripts/launch/` (map of companies: `companies.ts`). Tests: `test/launch-kit.test.ts`.
