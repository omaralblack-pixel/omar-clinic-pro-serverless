alter table public.casanova_appointments
  add column if not exists cancellation_reason text,
  add column if not exists no_show_reason text,
  add column if not exists delay_minutes integer not null default 0,
  add column if not exists status_note text,
  add column if not exists status_updated_at timestamptz not null default now();

alter table public.casanova_appointments
  drop constraint if exists casanova_appointments_delay_minutes_check,
  add constraint casanova_appointments_delay_minutes_check
    check (delay_minutes >= 0);

alter table public.casanova_appointments
  drop constraint if exists casanova_appointments_status_check,
  add constraint casanova_appointments_status_check
    check (status in (
      'scheduled',
      'confirmed',
      'arrived',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
      'delayed'
    ));

alter table public.casanova_transactions
  drop constraint if exists casanova_transactions_method_check,
  add constraint casanova_transactions_method_check
    check (method in (
      'cash',
      'card',
      'cliq',
      'bank_transfer',
      'transfer',
      'other'
    ));

create index if not exists casanova_appointments_owner_time_idx
  on public.casanova_appointments (owner_id, starts_at);

create or replace function public.casanova_find_appointment_conflicts(
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_exclude_appointment_id uuid default null
)
returns table (
  id uuid,
  patient_id uuid,
  starts_at timestamptz,
  duration_minutes integer,
  status text
)
language plpgsql
stable
set search_path = 'public', 'pg_temp'
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_starts_at is null or p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'A valid start time and duration are required' using errcode = '22023';
  end if;

  return query
  select
    a.id,
    a.patient_id,
    a.starts_at,
    a.duration_minutes,
    a.status
  from public.casanova_appointments a
  where a.owner_id = (select auth.uid())
    and a.status not in ('cancelled', 'no_show', 'completed')
    and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
    and tstzrange(
      a.starts_at,
      a.starts_at + make_interval(mins => a.duration_minutes),
      '[)'
    ) && tstzrange(
      p_starts_at,
      p_starts_at + make_interval(mins => p_duration_minutes),
      '[)'
    )
  order by a.starts_at;
end;
$$;

create or replace function public.casanova_create_quick_booking(
  p_patient_id uuid,
  p_starts_at timestamptz,
  p_service_id uuid default null,
  p_duration_minutes integer default 30,
  p_price numeric default 0,
  p_deposit numeric default 0,
  p_payment_method text default 'cash',
  p_notes text default null,
  p_allow_conflict boolean default false
)
returns table (
  appointment_id uuid,
  transaction_id uuid,
  conflict_count bigint
)
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_appointment_id uuid;
  v_transaction_id uuid;
  v_conflict_count bigint;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_starts_at is null or p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'A valid start time and duration are required' using errcode = '22023';
  end if;

  if coalesce(p_price, 0) < 0 or coalesce(p_deposit, 0) < 0 then
    raise exception 'Price and deposit cannot be negative' using errcode = '22023';
  end if;

  if coalesce(p_deposit, 0) > coalesce(p_price, 0) then
    raise exception 'Deposit cannot exceed appointment price' using errcode = '22023';
  end if;

  if p_payment_method not in ('cash', 'card', 'cliq', 'bank_transfer', 'transfer', 'other') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.casanova_patients p
    where p.id = p_patient_id
      and p.owner_id = v_owner_id
      and p.active = true
  ) then
    raise exception 'Patient is unavailable' using errcode = '23503';
  end if;

  if p_service_id is not null and not exists (
    select 1
    from public.casanova_services s
    where s.id = p_service_id
      and s.owner_id = v_owner_id
      and s.active = true
  ) then
    raise exception 'Service is unavailable' using errcode = '23503';
  end if;

  select count(*)
    into v_conflict_count
  from public.casanova_appointments a
  where a.owner_id = v_owner_id
    and a.status not in ('cancelled', 'no_show', 'completed')
    and tstzrange(
      a.starts_at,
      a.starts_at + make_interval(mins => a.duration_minutes),
      '[)'
    ) && tstzrange(
      p_starts_at,
      p_starts_at + make_interval(mins => p_duration_minutes),
      '[)'
    );

  if v_conflict_count > 0 and not p_allow_conflict then
    raise exception 'APPOINTMENT_CONFLICT'
      using errcode = 'P0001',
            detail = 'The selected time overlaps an active appointment',
            hint = 'Review conflicts or retry with p_allow_conflict = true';
  end if;

  insert into public.casanova_appointments (
    owner_id,
    patient_id,
    service_id,
    starts_at,
    duration_minutes,
    status,
    price,
    paid,
    notes
  )
  values (
    v_owner_id,
    p_patient_id,
    p_service_id,
    p_starts_at,
    p_duration_minutes,
    'scheduled',
    coalesce(p_price, 0),
    coalesce(p_deposit, 0),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_appointment_id;

  if coalesce(p_deposit, 0) > 0 then
    insert into public.casanova_transactions (
      owner_id,
      patient_id,
      appointment_id,
      kind,
      category,
      amount,
      method,
      occurred_at,
      description,
      reference
    )
    values (
      v_owner_id,
      p_patient_id,
      v_appointment_id,
      'income',
      'appointment_deposit',
      p_deposit,
      p_payment_method,
      now(),
      'Appointment deposit',
      'quick_booking'
    )
    returning id into v_transaction_id;
  end if;

  return query
  select v_appointment_id, v_transaction_id, v_conflict_count;
end;
$$;

revoke execute on function public.casanova_find_appointment_conflicts(timestamptz, integer, uuid)
  from public, anon;
revoke execute on function public.casanova_create_quick_booking(uuid, timestamptz, uuid, integer, numeric, numeric, text, text, boolean)
  from public, anon;

grant execute on function public.casanova_find_appointment_conflicts(timestamptz, integer, uuid)
  to authenticated;
grant execute on function public.casanova_create_quick_booking(uuid, timestamptz, uuid, integer, numeric, numeric, text, text, boolean)
  to authenticated;
