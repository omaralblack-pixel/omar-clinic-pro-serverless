alter table public.casanova_user_settings
  add column if not exists message_templates jsonb not null default jsonb_build_object('confirmation','مرحبًا {name}، نرجو تأكيد موعدك لدى Casanova Laser Clinic 🌷','appointment_reminder','مرحبًا {name}، تذكير لطيف بموعدك القادم لدى Casanova Laser Clinic 🌷','post_session','مرحبًا {name}، كيف كانت حالتك بعد الجلسة؟ نحن جاهزون لأي استفسار 🌷','outstanding','مرحبًا {name}، نذكّرك بلطف بوجود رصيد مستحق بقيمة {amount} د.أ 🌷','package_expiry','مرحبًا {name}، البكج الخاص بك قريب من الانتهاء 🌷'),
  add column if not exists payment_methods text[] not null default array['cash','card','cliq','bank_transfer','transfer','other'],
  add column if not exists backup_reminder_days integer not null default 7 check (backup_reminder_days between 1 and 90),
  add column if not exists last_backup_at timestamptz,
  add column if not exists whatsapp_auto_enabled boolean not null default false;

create table public.casanova_backup_log (id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,file_name text not null,file_size bigint not null check(file_size>0),table_count integer not null check(table_count>0),row_count integer not null check(row_count>=0),created_at timestamptz not null default now());
alter table public.casanova_backup_log enable row level security;
revoke all on public.casanova_backup_log from anon;
grant select,insert on public.casanova_backup_log to authenticated;
create policy casanova_owner_access on public.casanova_backup_log for all to authenticated using((select auth.uid())=owner_id) with check((select auth.uid())=owner_id);
create index casanova_backup_log_owner_date_idx on public.casanova_backup_log(owner_id,created_at desc);
notify pgrst,'reload schema';
