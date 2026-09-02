-- Operations, reports, notifications, and private patient media.
create table public.casanova_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  inventory_id uuid not null references public.casanova_inventory(id) on delete restrict,
  movement_type text not null check (movement_type in ('in','out','adjustment')),
  quantity numeric not null check (quantity > 0),
  quantity_before numeric not null check (quantity_before >= 0),
  quantity_after numeric not null check (quantity_after >= 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  reference text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.casanova_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.casanova_patients(id) on delete cascade,
  appointment_id uuid references public.casanova_appointments(id) on delete cascade,
  package_id uuid references public.casanova_packages(id) on delete cascade,
  notification_type text not null check (notification_type in ('confirmation','appointment_reminder','post_session','outstanding','package_expiry')),
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  message text not null check (length(btrim(message)) > 0),
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','sent','skipped','failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.casanova_patient_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.casanova_patients(id) on delete cascade,
  session_id uuid references public.casanova_laser_sessions(id) on delete set null,
  note_type text not null default 'medical' check (note_type in ('medical','general','aftercare')),
  body text not null check (length(btrim(body)) > 0),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.casanova_patient_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.casanova_patients(id) on delete cascade,
  session_id uuid references public.casanova_laser_sessions(id) on delete set null,
  media_type text not null check (media_type in ('before','after','document')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10000000),
  caption text,
  captured_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.casanova_inventory_movements enable row level security;
alter table public.casanova_notifications enable row level security;
alter table public.casanova_patient_notes enable row level security;
alter table public.casanova_patient_media enable row level security;

revoke all on public.casanova_inventory_movements, public.casanova_notifications, public.casanova_patient_notes, public.casanova_patient_media from anon;
grant select, insert on public.casanova_inventory_movements to authenticated;
grant select, insert, update, delete on public.casanova_notifications, public.casanova_patient_notes, public.casanova_patient_media to authenticated;

create policy casanova_owner_access on public.casanova_inventory_movements for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy casanova_owner_access on public.casanova_notifications for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy casanova_owner_access on public.casanova_patient_notes for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy casanova_owner_access on public.casanova_patient_media for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create index casanova_inventory_movements_owner_item_date_idx on public.casanova_inventory_movements(owner_id, inventory_id, occurred_at desc);
create index casanova_notifications_owner_status_schedule_idx on public.casanova_notifications(owner_id, status, scheduled_for);
create index casanova_notifications_patient_idx on public.casanova_notifications(patient_id);
create index casanova_patient_notes_owner_patient_date_idx on public.casanova_patient_notes(owner_id, patient_id, occurred_at desc);
create index casanova_patient_media_owner_patient_date_idx on public.casanova_patient_media(owner_id, patient_id, captured_on desc);
create index casanova_patient_notes_session_idx on public.casanova_patient_notes(session_id) where session_id is not null;
create index casanova_patient_media_session_idx on public.casanova_patient_media(session_id) where session_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('casanova-patient-media', 'casanova-patient-media', false, 10000000, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy casanova_patient_media_select on storage.objects for select to authenticated
using (bucket_id='casanova-patient-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy casanova_patient_media_insert on storage.objects for insert to authenticated
with check (bucket_id='casanova-patient-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy casanova_patient_media_delete on storage.objects for delete to authenticated
using (bucket_id='casanova-patient-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.casanova_record_inventory_movement(
  p_inventory_id uuid, p_movement_type text, p_quantity numeric, p_unit_cost numeric,
  p_reference text, p_notes text, p_occurred_at timestamptz
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_owner uuid := auth.uid(); v_before numeric; v_after numeric; v_id uuid;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_movement_type not in ('in','out','adjustment') then raise exception 'INVALID_MOVEMENT_TYPE'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  select quantity into v_before from public.casanova_inventory where id=p_inventory_id and owner_id=v_owner for update;
  if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  v_after := case when p_movement_type='in' then v_before+p_quantity when p_movement_type='out' then v_before-p_quantity else p_quantity end;
  if v_after < 0 then raise exception 'INSUFFICIENT_STOCK'; end if;
  update public.casanova_inventory set quantity=v_after, unit_cost=case when p_movement_type='in' and p_unit_cost is not null then p_unit_cost else unit_cost end, updated_at=now() where id=p_inventory_id and owner_id=v_owner;
  insert into public.casanova_inventory_movements(owner_id,inventory_id,movement_type,quantity,quantity_before,quantity_after,unit_cost,reference,notes,occurred_at)
  values(v_owner,p_inventory_id,p_movement_type,p_quantity,v_before,v_after,coalesce(p_unit_cost,0),nullif(btrim(coalesce(p_reference,'')),''),nullif(btrim(coalesce(p_notes,'')),''),coalesce(p_occurred_at,now())) returning id into v_id;
  return v_id;
end; $$;

revoke execute on function public.casanova_record_inventory_movement(uuid,text,numeric,numeric,text,text,timestamptz) from public, anon;
grant execute on function public.casanova_record_inventory_movement(uuid,text,numeric,numeric,text,text,timestamptz) to authenticated;
notify pgrst, 'reload schema';
