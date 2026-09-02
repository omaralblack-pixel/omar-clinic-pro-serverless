create index if not exists casanova_inventory_movements_inventory_idx on public.casanova_inventory_movements(inventory_id);
create index if not exists casanova_notifications_appointment_idx on public.casanova_notifications(appointment_id) where appointment_id is not null;
create index if not exists casanova_notifications_package_idx on public.casanova_notifications(package_id) where package_id is not null;
create index if not exists casanova_patient_notes_patient_idx on public.casanova_patient_notes(patient_id);
create index if not exists casanova_patient_media_patient_idx on public.casanova_patient_media(patient_id);
