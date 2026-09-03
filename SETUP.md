# Setting up PlantShare

You need three free accounts: **GitHub** (you have one), **Supabase**, and a
**Google Cloud** project for the sign-in button. No credit card, nothing to
install, and every step can be done from a browser — including a phone browser,
though a laptop makes the copying and pasting less painful.

Budget about 30 minutes for the first time through. When you are done, the app
lives at `https://<your-github-username>.github.io/PlantShare-Solo/` and anyone
you invite just opens that link.

---

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a **New project**.
2. Give it a name (`plantshare`), set a database password (save it somewhere —
   you will not need it for this app, but losing it is annoying later), and pick
   the region closest to you.
3. Wait for it to finish provisioning, about two minutes.

From the project dashboard, open **Project Settings → Data API** and note:

| What | Where it goes |
|---|---|
| **Project URL** — `https://abcdefgh.supabase.co` | `VITE_SUPABASE_URL` |
| **Project API key** (`anon` / publishable) | `VITE_SUPABASE_ANON_KEY` |
| **Project ref** — the `abcdefgh` part of the URL | `SUPABASE_PROJECT_REF` |

The `anon` key is designed to be public. It ends up in the browser bundle, which
is fine: every table is protected by row-level security, so the key alone grants
nothing. The **`service_role` key is different — never put that in the app.**

## 2. Create the database tables

1. In Supabase, open **SQL Editor → New query**.
2. Copy the entire contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   into the editor and click **Run**.
3. It should report success. Open **Table Editor** and confirm you can see
   `profiles`, `spaces`, `space_members`, `plants`, `watering_events`,
   `push_subscriptions` and `notification_log`.

## 3. Turn on Google sign-in

This is the fiddliest step, and it is the one that pays off later: nobody you
invite has to create a password or install anything.

**In Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):

1. Create a new project (name it `PlantShare`).
2. Go to **APIs & Services → OAuth consent screen**. Choose **External**, fill
   in an app name, your email as both support and developer contact, and save.
   You can leave it in "Testing" mode, but then only accounts you add under
   **Test users** can sign in — so click **Publish app** when you are ready to
   invite people. (No Google verification review is needed for basic sign-in.)
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - **Authorized redirect URIs** — add exactly this, with your project ref:
     ```
     https://<PROJECT_REF>.supabase.co/auth/v1/callback
     ```
4. Copy the **Client ID** and **Client secret**.

**Back in Supabase:**

5. **Authentication → Sign In / Providers → Google**: enable it, paste the client
   ID and secret, save.
6. **Authentication → URL Configuration**:
   - **Site URL**: `https://<your-github-username>.github.io/PlantShare-Solo/`
   - **Redirect URLs**: add the same URL. If you also want to run the app
     locally, add `http://localhost:5173/` on its own line.

> The trailing slash matters. If sign-in bounces you back to a blank page, a
> mismatch here is almost always why.

## 4. Generate the notification keys

Push notifications are signed with a key pair that is unique to your app (this
is VAPID — it is how a push service knows the notification really came from
you). Generate one:

- **With Node installed:** clone the repo and run `npm run vapid`.
- **Without installing anything:** in GitHub, open the **Actions** tab → run any
  workflow → or simply use a Codespace and run the same command there.

You get two strings. The public one goes into the app; the private one stays on
the server. **Generating new keys later invalidates everyone's notifications**,
so keep them.

## 5. Configure the Edge Functions

In Supabase, go to **Edge Functions → Secrets** (or **Project Settings →
Edge Functions**) and add four secrets:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key from step 4 |
| `VAPID_PRIVATE_KEY` | the private key from step 4 |
| `VAPID_SUBJECT` | `mailto:your-email@example.com` |
| `CRON_SECRET` | any long random string you make up |

`CRON_SECRET` is what stops a stranger from triggering your reminder job. Make
it long and paste it somewhere — step 7 needs it again.

## 6. Set up GitHub

**Repository variables** — Settings → Secrets and variables → Actions →
**Variables** tab → New repository variable:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `VITE_VAPID_PUBLIC_KEY` | the VAPID **public** key |

**Repository secrets** — the **Secrets** tab of the same page:

| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | the `abcdefgh` part of your project URL |

**Enable Pages** — Settings → Pages → **Source: GitHub Actions**.

Now push to `main` (or open the **Actions** tab and run **Build and deploy**
manually). Two workflows run: one builds the app and publishes it to Pages, the
other deploys the Edge Functions to Supabase.

> The deploy workflow watches the `main` branch. If you are working on another
> branch, either merge to `main` or add your branch to the `branches:` list in
> `.github/workflows/deploy.yml`.

## 7. Schedule the daily check

1. Open [`supabase/cron.sql`](supabase/cron.sql).
2. Replace `<PROJECT_REF>` and `<CRON_SECRET>` with your values.
3. Paste it into the Supabase **SQL Editor** and run it.

This tells Postgres to poke the reminder function every 15 minutes. The function
looks at whose reminder time has just passed and messages only those people —
each person gets at most one notification a day, guaranteed by the database, not
by hoping the schedule behaves.

Verify it registered:

```sql
select jobname, schedule, active from cron.job;
```

## 8. Try it on the phone

1. Open `https://<your-github-username>.github.io/PlantShare-Solo/` in Chrome on
   Android.
2. Sign in with Google.
3. Create a space, add a plant.
4. Chrome menu (⋮) → **Add to Home screen**. Do this before turning on
   notifications — an installed app gets more reliable delivery.
5. Open the installed app → **Settings** → **Turn on reminders** → allow the
   permission prompt.
6. Tap **Send a test notification**. It should arrive within a few seconds.

If the test arrives, everything is wired up. Set your reminder time and you are
done.

## 9. Invite the others

Space tab → **Share invite**. They open the link, sign in with Google, enter the
six-character code, and they are in. Each person sets their own reminder time in
their own Settings.

---

## When something does not work

**The app shows "PlantShare needs configuring".**
The build had no Supabase details. Check the three repository **variables** are
in the Variables tab (not Secrets — the build cannot read secrets into the
bundle), then re-run the deploy workflow.

**Sign-in redirects to a blank page or "requested path is invalid".**
The Site URL and Redirect URLs in Supabase must match your Pages URL exactly,
trailing slash included. Check the redirect URI in Google Cloud is the Supabase
`.../auth/v1/callback` address, not your app's address.

**Sign-in says the app is blocked or unverified.**
Your OAuth consent screen is still in Testing mode. Either add the person under
**Test users**, or click **Publish app**.

**The test notification says "no subscriptions".**
Turn reminders on first, on that device. Each device subscribes separately —
turning them on your phone does nothing for your laptop.

**The test notification fails with a rejection.**
The `VAPID_PUBLIC_KEY` in the Supabase secrets and the `VITE_VAPID_PUBLIC_KEY`
in the GitHub variables must be the same string. If you regenerated the keys,
everyone has to turn reminders off and on again.

**Nothing arrives at the scheduled time.**
Check the job is running and what it returned:

```sql
select status, return_message, start_time
from cron.job_run_details
order by start_time desc limit 10;
```

Then call the function yourself with `?dry=1` — it reports who it *would*
notify, without sending anything or marking the day as done:

```bash
curl -i "https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders?dry=1" \
  -H "x-cron-secret: <CRON_SECRET>"
```

A `403` means the secret does not match. An empty `report` means nobody's
reminder time falls in the current 60-minute window — which is the expected
answer most of the time.

**Notifications stop arriving after a while.**
Android's battery optimiser can throttle a browser's background work. Settings →
Apps → Chrome → Battery → **Unrestricted** helps. This is also why installing to
the home screen is worth doing.

**Free-tier Supabase projects pause after a week of inactivity.**
The cron job counts as activity, so a live app stays awake on its own. A project
you set up and then ignore for a week may need waking from the dashboard.
