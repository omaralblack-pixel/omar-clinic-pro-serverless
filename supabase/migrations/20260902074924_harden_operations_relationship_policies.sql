drop policy casanova_owner_access on public.casanova_inventory_movements;
create policy casanova_owner_access on public.casanova_inventory_movements for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id and exists(select 1 from public.casanova_inventory i where i.id=inventory_id and i.owner_id=(select auth.uid())));

drop policy casanova_owner_access on public.casanova_notifications;
create policy casanova_owner_access on public.casanova_notifications for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id and exists(select 1 from public.casanova_patients p where p.id=patient_id and p.owner_id=(select auth.uid())) and (appointment_id is null or exists(select 1 from public.casanova_appointments a where a.id=appointment_id and a.owner_id=(select auth.uid()) and a.patient_id=patient_id)) and (package_id is null or exists(select 1 from public.casanova_packages k where k.id=package_id and k.owner_id=(select auth.uid()) and k.patient_id=patient_id)));

drop policy casanova_owner_access on public.casanova_patient_notes;
create policy casanova_owner_access on public.casanova_patient_notes for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id and exists(select 1 from public.casanova_patients p where p.id=patient_id and p.owner_id=(select auth.uid())) and (session_id is null or exists(select 1 from public.casanova_laser_sessions s where s.id=session_id and s.owner_id=(select auth.uid()) and s.patient_id=patient_id)));

drop policy casanova_owner_access on public.casanova_patient_media;
create policy casanova_owner_access on public.casanova_patient_media for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id and exists(select 1 from public.casanova_patients p where p.id=patient_id and p.owner_id=(select auth.uid())) and storage_path like (select auth.uid())::text||'/'||patient_id::text||'/%' and (session_id is null or exists(select 1 from public.casanova_laser_sessions s where s.id=session_id and s.owner_id=(select auth.uid()) and s.patient_id=patient_id)));
