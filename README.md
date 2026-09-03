# PlantShare

A shared watering list for the plants in a house. One person waters the basil,
everyone else can see it is done.

It is a web app — a PWA — that installs to the Android home screen and behaves
like any other app: an icon, its own window, and a notification every evening
when something needs water. There is no APK to pass around; you invite someone
by sending them a link.

## What it does

- **Plants** have a name and a watering period in days. Add them by hand.
- **Spaces** hold a plant list and the people who share it. Join with a
  six-character code. One person can belong to several spaces.
- **One notification a day**, at a time each person picks for themselves. It
  arrives whether or not anyone has opened the app recently.
- **Tapping the notification** opens the list of what needs water tonight.
- **Marking a plant watered** restarts its countdown from that day. Anyone in
  the space can do it.
- **The same-evening rule.** A plant someone already watered stays on the list
  for the rest of that evening, marked done and with their name on it, so a
  second person opening the app can see it was handled. The next day it is gone
  from the list entirely, until it is due again.
- **Late warnings** on day 1, 2 and 3 past due, each more insistent than the
  last. After the third the plant stays on the list but stops nagging.

## How the reminder works

A web app cannot wake itself up. A service worker only runs when a push message
arrives, so the daily timer lives on the server rather than on the phone:

```
pg_cron (every 15 min)
   -> send-reminders Edge Function
        for each person whose reminder time just passed:
          claim the day in notification_log  (the duplicate guard)
          work out what is due across their spaces
          push to their devices
             -> service worker shows the notification
                  -> tap -> opens the app on Tonight
```

Each person gets at most one notification per day. That is enforced by a primary
key on `(user_id, local_date)`, not by trusting the schedule — two overlapping
cron runs race on the insert and exactly one wins.

Running the timer server-side has a side benefit over doing it on the device:
the reminder still fires for someone who has not opened the app in weeks, and
Android's battery optimiser cannot suppress it.

## Dates, not timestamps

A plant is watered on an evening, not at an instant, so every date in the schema
is a `date` and all the arithmetic is in whole days. This is why a daylight
saving change cannot silently skip or repeat a watering, and why "today" is
computed in each person's own timezone and passed in by whoever is acting.

The rules themselves live in one file,
[`supabase/functions/_shared/due.ts`](supabase/functions/_shared/due.ts), which
is imported by both the React app and the reminder function — so the badge on
screen and the text in the notification cannot disagree. It is pure functions
over `YYYY-MM-DD` strings, and it is the part with real test coverage.

## Getting it running

See **[SETUP.md](SETUP.md)**. Three free accounts, no credit card, about 30
minutes. The short version:

1. Create a Supabase project, run `supabase/migrations/0001_init.sql`.
2. Enable Google sign-in (a Google Cloud OAuth client, pasted into Supabase).
3. `npm run vapid` for the notification keys.
4. Put the keys in GitHub repository variables and Supabase function secrets.
5. Push to `main` — GitHub Actions builds the app to Pages and deploys the
   functions.
6. Run `supabase/cron.sql` to schedule the daily check.

## Working on it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase details
npm run dev
npm test                     # watering rules and push encryption
npm run typecheck
```

`npm test` needs no network, no database and no browser.

## Layout

```
src/
  lib/
    due.ts        re-export of the shared watering rules
    api.ts        every database call the screens make
    push.ts       permission, subscription, and the several ways it can fail
    supabase.ts   client, and whether the build was configured at all
  state/AppState.tsx   session, spaces, plants, and the realtime subscription
  components/          screens and the pieces they share
supabase/
  migrations/0001_init.sql   tables, row-level security, and the RPCs
  cron.sql                   schedules the daily check
  functions/
    _shared/due.ts       the watering rules (source of truth)
    _shared/webpush.ts   RFC 8291 push encryption on Web Crypto
    send-reminders/      the daily job
    send-test/           the "send me a test notification" button
```

## Security

Every table has row-level security, and the policies are the only access
control — the client filters nothing itself. You can read a space only if you
are a member of it; you can read a profile only if you share a space with that
person; you can read your own push subscriptions and nobody else's. Joining a
space goes through a `SECURITY DEFINER` function precisely because the joiner
cannot see the space yet, which is the point.

The reminder function is not protected by a user session — pg_cron does not have
one — so it checks a shared secret header instead, and it is the only thing in
the project that uses the service-role key.

## Known limits

- **Android and desktop only, in practice.** iOS supports web push from 16.4,
  but only after the page is added to the home screen; nothing here prevents it
  working, it is just not what this was built and tested for.
- **Delivery is within an hour of the time you set**, not to the minute. The
  cron runs every 15 minutes and the function accepts a 60-minute window so a
  slow run or a cold start cannot cause a silent miss.
- **Whole days only.** No "water at 6am and again at 6pm".
- **The interface is in English.**
