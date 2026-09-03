-- PlantShare schema.
--
-- Dates are stored as plain `date`, never timestamps: a plant is watered on an
-- evening, not at a moment. Every "today" is computed in the acting user's own
-- timezone and passed in, so a household spread across timezones still agrees
-- on what a day is for the person doing the tapping.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  display_name    text,
  avatar_url      text,
  reminder_hour   smallint not null default 19 check (reminder_hour between 0 and 23),
  reminder_minute smallint not null default 0  check (reminder_minute between 0 and 59),
  timezone        text not null default 'Asia/Jerusalem',
  created_at      timestamptz not null default now()
);

-- Every signed-in user gets a profile row automatically; the app never has to
-- deal with the "signed in but no profile yet" state.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ spaces --

create table public.spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.space_members (
  space_id  uuid not null references public.spaces(id) on delete cascade,
  -- Points at profiles rather than auth.users so the members list can be
  -- fetched with the display names embedded in one query. profiles itself
  -- cascades from auth.users, so deleting an account still cleans up.
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index space_members_user_idx on public.space_members(user_id);

-- ------------------------------------------------------------------ plants --

create table public.plants (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references public.spaces(id) on delete cascade,
  name              text not null check (length(trim(name)) between 1 and 80),
  period_days       smallint not null check (period_days between 1 and 365),
  next_due_date     date not null,
  last_watered_date date,
  last_watered_by   uuid references auth.users(id) on delete set null,
  notes             text,
  created_by        uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index plants_space_idx on public.plants(space_id);
create index plants_due_idx on public.plants(next_due_date);

-- One row per watering. Keeps the history, and carries the pre-watering state
-- so "undo" restores exactly what was there rather than guessing.
create table public.watering_events (
  id                     uuid primary key default gen_random_uuid(),
  plant_id               uuid not null references public.plants(id) on delete cascade,
  space_id               uuid not null references public.spaces(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  watered_on             date not null,
  prev_next_due_date     date not null,
  prev_last_watered_date date,
  prev_last_watered_by   uuid,
  created_at             timestamptz not null default now()
);

create index watering_events_plant_idx on public.watering_events(plant_id, created_at desc);

-- ----------------------------------------------------------------- pushing --

create table public.push_subscriptions (
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

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- The idempotency guard for the daily job: at most one reminder per user per
-- local day, no matter how many times the cron fires or overlaps.
create table public.notification_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  kind       text not null,
  plant_count smallint not null default 0,
  sent_at    timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- --------------------------------------------------------------- helpers ----

-- SECURITY DEFINER so RLS policies on space_members can ask "is this person a
-- member?" without the policy re-triggering itself.
create function public.is_member(p_space uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space and user_id = auth.uid()
  );
$$;

create function public.is_owner(p_space uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space and user_id = auth.uid() and role = 'owner'
  );
$$;

create function public.shares_space_with(p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

-- Ambiguous characters (0/O, 1/I/L) are left out so a code read aloud or typed
-- from a screenshot still works.
create function public.generate_invite_code()
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
    exit when not exists (select 1 from public.spaces where invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ------------------------------------------------------------------- RLS ----

alter table public.profiles           enable row level security;
alter table public.spaces             enable row level security;
alter table public.space_members      enable row level security;
alter table public.plants             enable row level security;
alter table public.watering_events    enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;

-- You can see yourself, and anyone you share a space with (so the app can show
-- "watered by Dana" rather than a bare user id).
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_space_with(id));
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy spaces_select on public.spaces for select
  using (public.is_member(id));
-- Spaces are created through create_space(), which also makes the creator an
-- owner; a bare insert would produce a space nobody is a member of.
create policy spaces_update on public.spaces for update
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy spaces_delete on public.spaces for delete
  using (public.is_owner(id));

create policy space_members_select on public.space_members for select
  using (public.is_member(space_id));
-- There is deliberately no insert policy. Membership is only ever granted by
-- create_space() and join_space_by_code(), which are SECURITY DEFINER and so
-- bypass RLS. Allowing a direct insert of "user_id = auth.uid()" would let
-- anyone who learned a space's id add themselves to it.
-- You can always remove yourself; an owner can remove anyone.
create policy space_members_delete on public.space_members for delete
  using (user_id = auth.uid() or public.is_owner(space_id));

create policy plants_select on public.plants for select
  using (public.is_member(space_id));
create policy plants_insert on public.plants for insert
  with check (public.is_member(space_id) and created_by = auth.uid());
create policy plants_update on public.plants for update
  using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy plants_delete on public.plants for delete
  using (public.is_member(space_id));

create policy watering_events_select on public.watering_events for select
  using (public.is_member(space_id));
create policy watering_events_insert on public.watering_events for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
create policy watering_events_delete on public.watering_events for delete
  using (public.is_member(space_id));

create policy push_select on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_insert on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy push_update on public.push_subscriptions for update using (user_id = auth.uid());
create policy push_delete on public.push_subscriptions for delete using (user_id = auth.uid());

create policy notification_log_select on public.notification_log for select using (user_id = auth.uid());

-- ------------------------------------------------------------------ RPCs ----

create function public.create_space(p_name text)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare
  new_space public.spaces;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.spaces (name, invite_code, created_by)
  values (trim(p_name), public.generate_invite_code(), auth.uid())
  returning * into new_space;

  insert into public.space_members (space_id, user_id, role)
  values (new_space.id, auth.uid(), 'owner');

  return new_space;
end;
$$;

-- SECURITY DEFINER because the joiner cannot read the space yet: RLS hides
-- spaces you are not a member of, which is exactly the point.
create function public.join_space_by_code(p_code text)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare
  target public.spaces;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into target from public.spaces
  where invite_code = upper(trim(p_code));

  if target.id is null then
    raise exception 'no_such_code' using errcode = 'P0002';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (space_id, user_id) do nothing;

  return target;
end;
$$;

-- Marking watered is two writes that must not drift apart, so it lives in one
-- statement-level function rather than two round trips from the phone.
create function public.mark_watered(p_plant uuid, p_today date)
returns public.watering_events language plpgsql security definer set search_path = public as $$
declare
  target public.plants;
  event  public.watering_events;
begin
  select * into target from public.plants where id = p_plant;
  if target.id is null then
    raise exception 'no_such_plant' using errcode = 'P0002';
  end if;
  if not public.is_member(target.space_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  insert into public.watering_events (
    plant_id, space_id, user_id, watered_on,
    prev_next_due_date, prev_last_watered_date, prev_last_watered_by
  )
  values (
    target.id, target.space_id, auth.uid(), p_today,
    target.next_due_date, target.last_watered_date, target.last_watered_by
  )
  returning * into event;

  -- The next period counts from the day it was actually watered, so a plant you
  -- were late on does not stay permanently behind schedule.
  update public.plants
  set next_due_date     = p_today + target.period_days,
      last_watered_date = p_today,
      last_watered_by   = auth.uid()
  where id = target.id;

  return event;
end;
$$;

create function public.undo_watering(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  event public.watering_events;
begin
  select * into event from public.watering_events where id = p_event;
  if event.id is null then
    raise exception 'no_such_event' using errcode = 'P0002';
  end if;
  if not public.is_member(event.space_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  update public.plants
  set next_due_date     = event.prev_next_due_date,
      last_watered_date = event.prev_last_watered_date,
      last_watered_by   = event.prev_last_watered_by
  where id = event.plant_id;

  delete from public.watering_events where id = event.id;
end;
$$;

-- Leaving a space you own would orphan it, so the last owner has to hand it
-- over or delete the space instead.
create function public.leave_space(p_space uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_owner(p_space)
     and (select count(*) from public.space_members where space_id = p_space and role = 'owner') = 1
     and (select count(*) from public.space_members where space_id = p_space) > 1
  then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;

  delete from public.space_members where space_id = p_space and user_id = auth.uid();

  -- An empty space is nobody's, so it goes.
  if not exists (select 1 from public.space_members where space_id = p_space) then
    delete from public.spaces where id = p_space;
  end if;
end;
$$;

-- Live updates so a plant someone else waters greys out on your screen while
-- you are looking at it.
alter publication supabase_realtime add table public.plants;
