create or replace function public.casanova_touch_appointment_status()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at := statement_timestamp();
  end if;

  return new;
end;
$$;

revoke execute on function public.casanova_touch_appointment_status()
  from public, anon, authenticated;
