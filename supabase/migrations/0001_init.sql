-- PlantShare - התקנה מלאה בהרצה אחת. בטוח להריץ שוב.
-- ממלאים שני ערכים בבלוק שלמטה ולוחצים Run. הסבר על המבנה ב-README.

-- ⬇️  שני הערכים שצריך למלא  ⬇️

create schema if not exists plantshare_private;
create or replace function plantshare_private.values()
returns table (project_ref text, vapid_private_key text, contact_email text)
language sql immutable as $$
  select
    -- ה-project ref: החלק שלפני supabase.co בכתובת הפרויקט.
    -- מ-https://abcdefghijklmnop.supabase.co כותבים abcdefghijklmnop
    'PASTE_PROJECT_REF_HERE',

    -- המפתח הפרטי של ההתראות. קיבלת אותו יחד עם הקוד.
    'PASTE_VAPID_PRIVATE_KEY_HERE',

    -- מייל ליצירת קשר, לשירותי ההתראות. לא מוצג באפליקציה.
    'plantshare@example.com';
$$;

--  ⬆️  מכאן והלאה אין מה לשנות  ⬆️

create extension if not exists "pgcrypto";

-- הכל בסכמה plantshare: הפרויקט משותף עם HouseHero.
create schema if not exists plantshare;

-- profiles --

create table if not exists plantshare.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  display_name    text,
  avatar_url      text,
  reminder_hour   smallint not null default 19 check (reminder_hour between 0 and 23),
  reminder_minute smallint not null default 0  check (reminder_minute between 0 and 59),
  timezone        text not null default 'Asia/Jerusalem',
  created_at      timestamptz not null default now()
);

-- שפת הממשק. nullable כדי לא לדרוס את שפת הדפדפן; alter נפרד למסד קיים.
alter table plantshare.profiles
  add column if not exists language text check (language in ('he', 'en'));

create or replace function plantshare.handle_new_user()
returns trigger language plpgsql security definer set search_path = plantshare as $$
begin
  insert into plantshare.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- שם ייחודי: הפרויקט משותף עם HouseHero, שיש לו טריגר משלו על auth.users.
drop trigger if exists on_auth_user_created_plantshare on auth.users;
create trigger on_auth_user_created_plantshare
  after insert on auth.users
  for each row execute function plantshare.handle_new_user();

-- spaces --

create table if not exists plantshare.spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists plantshare.space_members (
  space_id  uuid not null references plantshare.spaces(id) on delete cascade,
  -- profiles, not auth.users, so PostgREST can embed the names in one query.
  user_id   uuid not null references plantshare.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists space_members_user_idx on plantshare.space_members(user_id);

-- plants --

create table if not exists plantshare.plants (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references plantshare.spaces(id) on delete cascade,
  name              text not null check (length(trim(name)) between 1 and 80),
  period_days       smallint not null check (period_days between 1 and 365),
  next_due_date     date not null,
  last_watered_date date,
  last_watered_by   uuid references auth.users(id) on delete set null,
  notes             text,
  created_by        uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index if not exists plants_space_idx on plantshare.plants(space_id);
create index if not exists plants_due_idx on plantshare.plants(next_due_date);

create table if not exists plantshare.watering_events (
  id                     uuid primary key default gen_random_uuid(),
  plant_id               uuid not null references plantshare.plants(id) on delete cascade,
  space_id               uuid not null references plantshare.spaces(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  watered_on             date not null,
  prev_next_due_date     date not null,
  prev_last_watered_date date,
  prev_last_watered_by   uuid,
  created_at             timestamptz not null default now()
);

create index if not exists watering_events_plant_idx on plantshare.watering_events(plant_id, created_at desc);

-- pushing --

create table if not exists plantshare.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz,
  failure_count smallint not null default 0
);

create index if not exists push_subscriptions_user_idx on plantshare.push_subscriptions(user_id);

create table if not exists plantshare.notification_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  kind       text not null,
  plant_count smallint not null default 0,
  sent_at    timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- helpers --

-- SECURITY DEFINER so an RLS policy can ask "is this person a member?"
-- without re-triggering itself.
create or replace function plantshare.is_member(p_space uuid)
returns boolean language sql security definer stable set search_path = plantshare as $$
  select exists (
    select 1 from plantshare.space_members
    where space_id = p_space and user_id = auth.uid()
  );
$$;

create or replace function plantshare.is_owner(p_space uuid)
returns boolean language sql security definer stable set search_path = plantshare as $$
  select exists (
    select 1 from plantshare.space_members
    where space_id = p_space and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function plantshare.shares_space_with(p_user uuid)
returns boolean language sql security definer stable set search_path = plantshare as $$
  select exists (
    select 1
    from plantshare.space_members mine
    join plantshare.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

create or replace function plantshare.generate_invite_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for _ in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from plantshare.spaces where invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- RLS --

-- Cleared first so the script re-runs; all are recreated below.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'plantshare'
  loop
    execute format('drop policy if exists %I on plantshare.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table plantshare.profiles           enable row level security;
alter table plantshare.spaces             enable row level security;
alter table plantshare.space_members      enable row level security;
alter table plantshare.plants             enable row level security;
alter table plantshare.watering_events    enable row level security;
alter table plantshare.push_subscriptions enable row level security;
alter table plantshare.notification_log   enable row level security;

-- Yourself, plus anyone you share a space with, so the app can say
-- "watered by Dana" rather than showing an id.
create policy profiles_select on plantshare.profiles for select
  using (id = auth.uid() or plantshare.shares_space_with(id));
create policy profiles_update on plantshare.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy spaces_select on plantshare.spaces for select
  using (plantshare.is_member(id));
create policy spaces_update on plantshare.spaces for update
  using (plantshare.is_owner(id)) with check (plantshare.is_owner(id));
create policy spaces_delete on plantshare.spaces for delete
  using (plantshare.is_owner(id));

create policy space_members_select on plantshare.space_members for select
  using (plantshare.is_member(space_id));
-- Also no insert policy: membership comes only from create_space() and
-- join_space_by_code(). "user_id = auth.uid()" would let anyone who learned
-- a space id join it. Delete: yourself always, others if owner.
create policy space_members_delete on plantshare.space_members for delete
  using (user_id = auth.uid() or plantshare.is_owner(space_id));

create policy plants_select on plantshare.plants for select
  using (plantshare.is_member(space_id));
create policy plants_insert on plantshare.plants for insert
  with check (plantshare.is_member(space_id) and created_by = auth.uid());
create policy plants_update on plantshare.plants for update
  using (plantshare.is_member(space_id)) with check (plantshare.is_member(space_id));
create policy plants_delete on plantshare.plants for delete
  using (plantshare.is_member(space_id));

create policy watering_events_select on plantshare.watering_events for select
  using (plantshare.is_member(space_id));
create policy watering_events_insert on plantshare.watering_events for insert
  with check (plantshare.is_member(space_id) and user_id = auth.uid());
create policy watering_events_delete on plantshare.watering_events for delete
  using (plantshare.is_member(space_id));

create policy push_select on plantshare.push_subscriptions for select using (user_id = auth.uid());
create policy push_insert on plantshare.push_subscriptions for insert with check (user_id = auth.uid());
create policy push_update on plantshare.push_subscriptions for update using (user_id = auth.uid());
create policy push_delete on plantshare.push_subscriptions for delete using (user_id = auth.uid());

create policy notification_log_select on plantshare.notification_log for select using (user_id = auth.uid());

-- RPCs --

create or replace function plantshare.create_space(p_name text)
returns plantshare.spaces language plpgsql security definer set search_path = plantshare as $$
declare
  new_space plantshare.spaces;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into plantshare.spaces (name, invite_code, created_by)
  values (trim(p_name), plantshare.generate_invite_code(), auth.uid())
  returning * into new_space;

  insert into plantshare.space_members (space_id, user_id, role)
  values (new_space.id, auth.uid(), 'owner');

  return new_space;
end;
$$;

create or replace function plantshare.join_space_by_code(p_code text)
returns plantshare.spaces language plpgsql security definer set search_path = plantshare as $$
declare
  target plantshare.spaces;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into target from plantshare.spaces
  where invite_code = upper(trim(p_code));

  if target.id is null then
    raise exception 'no_such_code' using errcode = 'P0002';
  end if;

  insert into plantshare.space_members (space_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (space_id, user_id) do nothing;

  return target;
end;
$$;

create or replace function plantshare.mark_watered(p_plant uuid, p_today date)
returns plantshare.watering_events language plpgsql security definer set search_path = plantshare as $$
declare
  target plantshare.plants;
  event  plantshare.watering_events;
begin
  select * into target from plantshare.plants where id = p_plant;
  if target.id is null then
    raise exception 'no_such_plant' using errcode = 'P0002';
  end if;
  if not plantshare.is_member(target.space_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  insert into plantshare.watering_events (
    plant_id, space_id, user_id, watered_on,
    prev_next_due_date, prev_last_watered_date, prev_last_watered_by
  )
  values (
    target.id, target.space_id, auth.uid(), p_today,
    target.next_due_date, target.last_watered_date, target.last_watered_by
  )
  returning * into event;

  -- From the day it was actually watered, so a late plant does not stay behind.
  update plantshare.plants
  set next_due_date     = p_today + target.period_days,
      last_watered_date = p_today,
      last_watered_by   = auth.uid()
  where id = target.id;

  return event;
end;
$$;

-- Only whoever watered can undo - anyone may water early, so this guards
-- identity, not timing.
drop function if exists plantshare.undo_watering(uuid);
create or replace function plantshare.undo_last_watering(p_plant uuid)
returns plantshare.plants language plpgsql security definer set search_path = plantshare as $$
declare
  target plantshare.plants;
  event  plantshare.watering_events;
  result plantshare.plants;
begin
  select * into target from plantshare.plants where id = p_plant;
  if target.id is null then
    raise exception 'no_such_plant' using errcode = 'P0002';
  end if;
  if not plantshare.is_member(target.space_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  select * into event from plantshare.watering_events
  where plant_id = p_plant order by created_at desc limit 1;
  if event.id is null then
    raise exception 'nothing_to_undo' using errcode = 'P0002';
  end if;
  if event.user_id <> auth.uid() then
    raise exception 'not_your_watering' using errcode = '42501';
  end if;

  update plantshare.plants
  set next_due_date     = event.prev_next_due_date,
      last_watered_date = event.prev_last_watered_date,
      last_watered_by   = event.prev_last_watered_by
  where id = event.plant_id
  returning * into result;

  delete from plantshare.watering_events where id = event.id;
  return result;
end;
$$;

-- The last owner cannot walk out and orphan the space.
create or replace function plantshare.leave_space(p_space uuid)
returns void language plpgsql security definer set search_path = plantshare as $$
begin
  if plantshare.is_owner(p_space)
     and (select count(*) from plantshare.space_members where space_id = p_space and role = 'owner') = 1
     and (select count(*) from plantshare.space_members where space_id = p_space) > 1
  then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;

  delete from plantshare.space_members where space_id = p_space and user_id = auth.uid();

  -- An empty space is nobody's, so it goes.
  if not exists (select 1 from plantshare.space_members where space_id = p_space) then
    delete from plantshare.spaces where id = p_space;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'plantshare' and tablename = 'plants'
  ) then
    alter publication supabase_realtime add table plantshare.plants;
  end if;
end $$;

-- הגדרות השרת --
-- RLS בלי מדיניות = חסום לכולם חוץ מ-service_role; לכן אין סודות ב-Supabase.

create table if not exists plantshare.app_config (
  id                boolean primary key default true check (id),
  vapid_public_key  text not null,
  vapid_private_key text not null,
  vapid_subject     text not null,
  functions_url     text not null,
  -- נוצר אוטומטית; אף אחד לא מקליד אותו.
  cron_secret       text not null
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);

alter table plantshare.app_config enable row level security;
-- ללא מדיניות = חסום לכולם; service_role עוקף RLS וכן קורא.
revoke all on plantshare.app_config from anon, authenticated;

insert into plantshare.app_config (id, vapid_public_key, vapid_private_key, vapid_subject, functions_url)
select
  true,
  'BDJiNMmEeXk34oQvE1RjsVvlHjeJxM1aBKBhAwj2Idk9ePLvmCqcHT27VIkVh_roDRlE2JTgHCiffN4joeAXqjc',
  v.vapid_private_key,
  'mailto:' || v.contact_email,
  'https://' || v.project_ref || '.supabase.co/functions/v1/plantshare-send-reminders'
from plantshare_private.values() v
-- שני חצאי המפתח חייבים להתעדכן יחד: זוג לא תואם = כל ההתראות נדחות.
on conflict (id) do update set
  vapid_public_key  = excluded.vapid_public_key,
  vapid_private_key = excluded.vapid_private_key,
  vapid_subject     = excluded.vapid_subject,
  functions_url     = excluded.functions_url;

-- אם הערכים למעלה נשארו ריקים, עדיף להיכשל כאן מאשר בעוד שבוע.
do $$
declare
  cfg plantshare.app_config;
begin
  select * into cfg from plantshare.app_config;
  if cfg.vapid_private_key like 'PASTE_%' or cfg.functions_url like '%PASTE_%' then
    raise exception using
      message = 'חסרים ערכים בבלוק ההגדרות בראש הקובץ',
      hint = 'צריך למלא את project_ref ואת vapid_private_key בראש הסקריפט, ואז להריץ שוב.';
  end if;
end $$;

-- המשימה היומית --
-- pg_cron מעיר כל רבע שעה; מפתח notification_log מגביל לתזכורת אחת ליום.

-- Supabase שם אותן ב-extensions; לא כל גרסה מרשה, אז מנסים גם בלעדיה.
do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception when others then
    create extension if not exists pg_cron;
  end;
exception when others then
  raise exception using
    message = 'לא הצלחתי להתקין את pg_cron',
    hint = 'להפעיל ידנית: Supabase → Database → Extensions → pg_cron, ואז להריץ שוב.';
end $$;

do $$
begin
  begin
    create extension if not exists pg_net with schema extensions;
  exception when others then
    create extension if not exists pg_net;
  end;
exception when others then
  raise exception using
    message = 'לא הצלחתי להתקין את pg_net',
    hint = 'להפעיל ידנית: Supabase → Database → Extensions → pg_net, ואז להריץ שוב.';
end $$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'plantshare-reminders') then
    perform cron.unschedule('plantshare-reminders');
  end if;
end $$;

-- הכתובת והסוד נקראים בזמן ריצה, כך שהחלפה היא UPDATE אחד.
select cron.schedule(
  'plantshare-reminders',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := (select functions_url from plantshare.app_config),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select cron_secret from plantshare.app_config)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);


do $$
begin
  raise notice '✅ PlantShare הותקן. המשימה היומית רצה כל 15 דקות.';
end $$;
