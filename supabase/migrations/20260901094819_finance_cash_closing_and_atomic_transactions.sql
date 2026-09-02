create table if not exists public.casanova_cash_closings (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, closing_date date not null,
  opening_cash numeric not null default 0 check (opening_cash >= 0), cash_income numeric not null default 0 check (cash_income >= 0), cash_expense numeric not null default 0 check (cash_expense >= 0), expected_cash numeric not null default 0, counted_cash numeric not null default 0 check (counted_cash >= 0), difference numeric not null default 0, notes text, closed_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (owner_id, closing_date)
);
alter table public.casanova_cash_closings enable row level security;
revoke all on table public.casanova_cash_closings from anon;
grant select, insert, update on table public.casanova_cash_closings to authenticated;
create policy casanova_owner_access on public.casanova_cash_closings as permissive for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create index if not exists casanova_transactions_owner_occurred_idx on public.casanova_transactions (owner_id, occurred_at desc);
create index if not exists casanova_cash_closings_owner_date_idx on public.casanova_cash_closings (owner_id, closing_date desc);

create or replace function public.casanova_record_transaction(p_kind text, p_category text, p_amount numeric, p_method text, p_description text, p_occurred_at timestamptz, p_patient_id uuid, p_appointment_id uuid, p_package_id uuid, p_reference text) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_owner_id uuid := auth.uid(); v_transaction_id uuid; v_appointment_patient_id uuid; v_package_patient_id uuid;
begin
  if v_owner_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind not in ('income', 'expense') then raise exception 'INVALID_TRANSACTION_KIND'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_TRANSACTION_AMOUNT'; end if;
  if length(btrim(coalesce(p_category, ''))) = 0 then raise exception 'TRANSACTION_CATEGORY_REQUIRED'; end if;
  if length(btrim(coalesce(p_description, ''))) = 0 then raise exception 'TRANSACTION_DESCRIPTION_REQUIRED'; end if;
  if p_method not in ('cash', 'card', 'cliq', 'bank_transfer', 'transfer', 'other') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_patient_id is not null and not exists (select 1 from public.casanova_patients p where p.id = p_patient_id and p.owner_id = v_owner_id) then raise exception 'PATIENT_NOT_FOUND'; end if;
  if p_appointment_id is not null then select patient_id into v_appointment_patient_id from public.casanova_appointments where id = p_appointment_id and owner_id = v_owner_id; if not found then raise exception 'APPOINTMENT_NOT_FOUND'; end if; if p_patient_id is not null and p_patient_id <> v_appointment_patient_id then raise exception 'APPOINTMENT_PATIENT_MISMATCH'; end if; p_patient_id := coalesce(p_patient_id, v_appointment_patient_id); end if;
  if p_package_id is not null then select patient_id into v_package_patient_id from public.casanova_packages where id = p_package_id and owner_id = v_owner_id; if not found then raise exception 'PACKAGE_NOT_FOUND'; end if; if p_patient_id is not null and p_patient_id <> v_package_patient_id then raise exception 'PACKAGE_PATIENT_MISMATCH'; end if; p_patient_id := coalesce(p_patient_id, v_package_patient_id); end if;
  insert into public.casanova_transactions (owner_id, patient_id, appointment_id, package_id, kind, category, amount, method, occurred_at, description, reference) values (v_owner_id, p_patient_id, p_appointment_id, p_package_id, p_kind, btrim(p_category), p_amount, p_method, coalesce(p_occurred_at, now()), btrim(p_description), nullif(btrim(coalesce(p_reference, '')), '')) returning id into v_transaction_id;
  if p_kind = 'income' and p_appointment_id is not null then update public.casanova_appointments set paid = least(price, paid + p_amount), updated_at = now() where id = p_appointment_id and owner_id = v_owner_id; end if;
  if p_kind = 'income' and p_package_id is not null then update public.casanova_packages set paid_amount = least(total_price, paid_amount + p_amount), updated_at = now() where id = p_package_id and owner_id = v_owner_id; end if;
  return v_transaction_id;
end; $$;

create or replace function public.casanova_record_cash_closing(p_closing_date date, p_opening_cash numeric, p_counted_cash numeric, p_notes text) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_owner_id uuid := auth.uid(); v_income numeric := 0; v_expense numeric := 0; v_expected numeric := 0; v_closing_id uuid;
begin
  if v_owner_id is null then raise exception 'AUTH_REQUIRED'; end if; if p_closing_date is null then raise exception 'CLOSING_DATE_REQUIRED'; end if; if coalesce(p_opening_cash, 0) < 0 or coalesce(p_counted_cash, 0) < 0 then raise exception 'INVALID_CASH_AMOUNT'; end if;
  select coalesce(sum(amount) filter (where kind = 'income'), 0), coalesce(sum(amount) filter (where kind = 'expense'), 0) into v_income, v_expense from public.casanova_transactions where owner_id = v_owner_id and method = 'cash' and occurred_at >= timezone('Asia/Amman', p_closing_date::timestamp) and occurred_at < timezone('Asia/Amman', (p_closing_date + 1)::timestamp);
  v_expected := coalesce(p_opening_cash, 0) + v_income - v_expense;
  insert into public.casanova_cash_closings (owner_id, closing_date, opening_cash, cash_income, cash_expense, expected_cash, counted_cash, difference, notes, closed_at, updated_at) values (v_owner_id, p_closing_date, coalesce(p_opening_cash, 0), v_income, v_expense, v_expected, coalesce(p_counted_cash, 0), coalesce(p_counted_cash, 0) - v_expected, nullif(btrim(coalesce(p_notes, '')), ''), now(), now()) on conflict (owner_id, closing_date) do update set opening_cash = excluded.opening_cash, cash_income = excluded.cash_income, cash_expense = excluded.cash_expense, expected_cash = excluded.expected_cash, counted_cash = excluded.counted_cash, difference = excluded.difference, notes = excluded.notes, closed_at = now(), updated_at = now() returning id into v_closing_id;
  return v_closing_id;
end; $$;

revoke execute on function public.casanova_record_transaction(text, text, numeric, text, text, timestamptz, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.casanova_record_transaction(text, text, numeric, text, text, timestamptz, uuid, uuid, uuid, text) to authenticated;
revoke execute on function public.casanova_record_cash_closing(date, numeric, numeric, text) from public, anon;
grant execute on function public.casanova_record_cash_closing(date, numeric, numeric, text) to authenticated;
notify pgrst, 'reload schema';
