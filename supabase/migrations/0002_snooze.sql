-- PlantShare - השהיית תזכורות. בטוח להריץ שוב - גם ביחד עם 0001_init.sql
-- וגם לבד, למי שמדביק רק את זה בעריכה חוזרת.
-- מוסיף למה שכבר יצר 0001_init.sql.

-- אישית לכל משתמש: השהיה של אדם אחד לא נוגעת לתזכורת של אדם אחר באותו מרחב.
create table if not exists public.plant_snoozes (
  plant_id      uuid not null references public.plants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  snoozed_until timestamptz not null,
  created_at    timestamptz not null default now(),
  primary key (plant_id, user_id)
);

-- מאותר לפי זמן תפוגה - כך שהמעיר התקופתי (send-reminders) שולף רק את מה
-- שכבר עבר, בלי לסרוק את כל הטבלה.
create index if not exists plant_snoozes_due_idx on public.plant_snoozes(snoozed_until);

alter table public.plant_snoozes enable row level security;

-- Cleared first so this file re-runs on its own too, not only as part of a
-- full run of every migration file in order.
do $$
declare r record;
begin
  for r in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'plant_snoozes'
  loop
    execute format('drop policy if exists %I on public.plant_snoozes', r.policyname);
  end loop;
end $$;

create policy plant_snoozes_select on public.plant_snoozes for select
  using (user_id = auth.uid());
create policy plant_snoozes_insert on public.plant_snoozes for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.plants p where p.id = plant_id and public.is_member(p.space_id))
  );
create policy plant_snoozes_update on public.plant_snoozes for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.plants p where p.id = plant_id and public.is_member(p.space_id))
  );
create policy plant_snoozes_delete on public.plant_snoozes for delete
  using (user_id = auth.uid());

do $$
begin
  raise notice '✅ טבלת ההשהיות מוכנה.';
end $$;
