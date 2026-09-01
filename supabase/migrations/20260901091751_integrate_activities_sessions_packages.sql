do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casanova_packages'::regclass
      and conname = 'casanova_packages_used_within_total_check'
  ) then
    alter table public.casanova_packages
      add constraint casanova_packages_used_within_total_check
      check (used_sessions <= total_sessions);
  end if;
end
$$;

create unique index if not exists casanova_laser_sessions_one_per_appointment_idx
  on public.casanova_laser_sessions (appointment_id)
  where appointment_id is not null;

create index if not exists casanova_laser_sessions_owner_performed_idx
  on public.casanova_laser_sessions (owner_id, performed_at desc);

create index if not exists casanova_packages_active_alert_idx
  on public.casanova_packages (owner_id, expires_on)
  where status = 'active';

create or replace function public.casanova_create_package(
  p_patient_id uuid, p_service_id uuid, p_name text,
  p_total_sessions integer, p_total_price numeric, p_paid_amount numeric,
  p_starts_on date, p_expires_on date, p_notes text, p_payment_method text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_package_id uuid;
begin
  if v_owner_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'PACKAGE_NAME_REQUIRED'; end if;
  if p_total_sessions is null or p_total_sessions <= 0 then raise exception 'INVALID_SESSION_COUNT'; end if;
  if coalesce(p_total_price, 0) < 0 or coalesce(p_paid_amount, 0) < 0
     or coalesce(p_paid_amount, 0) > coalesce(p_total_price, 0) then
    raise exception 'INVALID_PACKAGE_PAYMENT';
  end if;
  if not exists (select 1 from public.casanova_patients p where p.id = p_patient_id and p.owner_id = v_owner_id and p.active) then
    raise exception 'PATIENT_NOT_FOUND';
  end if;
  if p_service_id is not null and not exists (select 1 from public.casanova_services s where s.id = p_service_id and s.owner_id = v_owner_id and s.active) then
    raise exception 'SERVICE_NOT_FOUND';
  end if;

  insert into public.casanova_packages (
    owner_id, patient_id, service_id, name, total_sessions,
    total_price, paid_amount, starts_on, expires_on, notes
  ) values (
    v_owner_id, p_patient_id, p_service_id, btrim(p_name), p_total_sessions,
    coalesce(p_total_price, 0), coalesce(p_paid_amount, 0),
    coalesce(p_starts_on, current_date), p_expires_on, nullif(btrim(coalesce(p_notes, '')), '')
  ) returning id into v_package_id;

  if coalesce(p_paid_amount, 0) > 0 then
    insert into public.casanova_transactions (
      owner_id, patient_id, package_id, kind, category, amount, method, description
    ) values (
      v_owner_id, p_patient_id, v_package_id, 'income', 'package_payment',
      p_paid_amount, coalesce(p_payment_method, 'cash'), 'دفعة أولى للبكج: ' || btrim(p_name)
    );
  end if;
  return v_package_id;
end;
$$;

create or replace function public.casanova_record_laser_session(
  p_patient_id uuid, p_appointment_id uuid, p_service_id uuid, p_package_id uuid,
  p_performed_at timestamptz, p_body_area text, p_device_name text, p_wavelength text,
  p_fluence_j_cm2 numeric, p_pulse_ms numeric, p_spot_mm numeric, p_cooling text,
  p_skin_type smallint, p_pain_score smallint, p_reaction text, p_notes text,
  p_next_session_date date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_session_id uuid;
  v_session_number integer;
  v_package_service_id uuid;
begin
  if v_owner_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(btrim(coalesce(p_body_area, ''))) = 0 then raise exception 'BODY_AREA_REQUIRED'; end if;
  if not exists (select 1 from public.casanova_patients p where p.id = p_patient_id and p.owner_id = v_owner_id and p.active) then
    raise exception 'PATIENT_NOT_FOUND';
  end if;
  if p_service_id is not null and not exists (select 1 from public.casanova_services s where s.id = p_service_id and s.owner_id = v_owner_id) then
    raise exception 'SERVICE_NOT_FOUND';
  end if;
  if p_appointment_id is not null and not exists (
    select 1 from public.casanova_appointments a
    where a.id = p_appointment_id and a.patient_id = p_patient_id
      and a.owner_id = v_owner_id and a.status <> 'cancelled'
  ) then raise exception 'APPOINTMENT_NOT_FOUND'; end if;

  if p_package_id is not null then
    select service_id into v_package_service_id
    from public.casanova_packages
    where id = p_package_id and patient_id = p_patient_id
      and owner_id = v_owner_id and status = 'active' and used_sessions < total_sessions
    for update;
    if not found then raise exception 'PACKAGE_NOT_AVAILABLE'; end if;
    if v_package_service_id is not null and p_service_id is distinct from v_package_service_id then
      raise exception 'PACKAGE_SERVICE_MISMATCH';
    end if;
    update public.casanova_packages
    set used_sessions = used_sessions + 1,
        status = case when used_sessions + 1 >= total_sessions then 'completed' else status end,
        updated_at = now()
    where id = p_package_id;
  end if;

  select coalesce(max(ls.session_number), 0) + 1 into v_session_number
  from public.casanova_laser_sessions ls
  where ls.patient_id = p_patient_id and ls.service_id is not distinct from p_service_id;

  insert into public.casanova_laser_sessions (
    owner_id, patient_id, appointment_id, service_id, session_number,
    performed_at, body_area, device_name, wavelength, fluence_j_cm2,
    pulse_ms, spot_mm, cooling, skin_type, pain_score, reaction, notes, next_session_date
  ) values (
    v_owner_id, p_patient_id, p_appointment_id, p_service_id, v_session_number,
    coalesce(p_performed_at, now()), btrim(p_body_area),
    nullif(btrim(coalesce(p_device_name, '')), ''), nullif(btrim(coalesce(p_wavelength, '')), ''),
    p_fluence_j_cm2, p_pulse_ms, p_spot_mm, nullif(btrim(coalesce(p_cooling, '')), ''),
    p_skin_type, p_pain_score, nullif(btrim(coalesce(p_reaction, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''), p_next_session_date
  ) returning id into v_session_id;

  if p_appointment_id is not null then
    update public.casanova_appointments set status = 'completed', updated_at = now() where id = p_appointment_id;
  end if;
  if p_next_session_date is not null then
    insert into public.casanova_patient_activities (
      owner_id, patient_id, appointment_id, activity_type, summary, follow_up_at
    ) values (
      v_owner_id, p_patient_id, null, 'follow_up', 'متابعة لحجز جلسة الليزر القادمة',
      timezone('Asia/Amman', p_next_session_date::timestamp + time '09:00')
    );
  end if;
  return v_session_id;
end;
$$;

revoke execute on function public.casanova_create_package(uuid, uuid, text, integer, numeric, numeric, date, date, text, text) from public, anon;
grant execute on function public.casanova_create_package(uuid, uuid, text, integer, numeric, numeric, date, date, text, text) to authenticated;

revoke execute on function public.casanova_record_laser_session(uuid, uuid, uuid, uuid, timestamptz, text, text, text, numeric, numeric, numeric, text, smallint, smallint, text, text, date) from public, anon;
grant execute on function public.casanova_record_laser_session(uuid, uuid, uuid, uuid, timestamptz, text, text, text, numeric, numeric, numeric, text, smallint, smallint, text, text, date) to authenticated;
