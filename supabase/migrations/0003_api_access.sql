-- PlantShare - גישת ה-API לסכמה plantshare. בטוח להריץ שוב.
-- הפרויקט משותף עם HouseHero, ולכן הטבלאות בסכמה משלהן ולא ב-public.
-- סכמה שאינה public לא נפתחת ל-API מעצמה: צריך גם להוסיף אותה ל-Exposed
-- schemas (את זה עושה .github/workflows/migrate.yml), וגם לתת הרשאות כאן.
-- ההרשאות לבדן לא חושפות שורה אחת: RLS מסנן כל טבלה, כמו קודם.

grant usage on schema plantshare to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema plantshare to authenticated, service_role;
grant usage, select on all sequences in schema plantshare to authenticated, service_role;
grant execute on all functions in schema plantshare to authenticated, service_role;

-- האפליקציה דורשת התחברות; לאורח אין מה לקרוא כאן.
revoke all on all tables in schema plantshare from anon;
revoke execute on all functions in schema plantshare from anon, public;
grant execute on all functions in schema plantshare to authenticated, service_role;

-- הטריגר של משתמש חדש רץ בשם supabase_auth_admin.
grant usage on schema plantshare to supabase_auth_admin;
grant execute on function plantshare.handle_new_user() to supabase_auth_admin;

-- סודות השרת: רק service_role, כמו קודם.
revoke all on plantshare.app_config from anon, authenticated;

-- הערכים של ההתקנה (כולל המפתח הפרטי) - בסכמה שלא נחשפת, ובלי הרשאה לאף אחד.
revoke all on schema plantshare_private from public, anon, authenticated;
revoke execute on all functions in schema plantshare_private from public, anon, authenticated;

alter default privileges for role postgres in schema plantshare
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role postgres in schema plantshare
  grant execute on functions to authenticated, service_role;

do $$
begin
  raise notice '✅ הרשאות הסכמה plantshare מוכנות.';
end $$;
