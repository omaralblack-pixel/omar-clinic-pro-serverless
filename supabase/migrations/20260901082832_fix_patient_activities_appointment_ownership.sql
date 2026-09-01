drop policy if exists casanova_owner_access on public.casanova_patient_activities;

create policy casanova_owner_access
on public.casanova_patient_activities
as permissive
for all
to authenticated
using (
  (select auth.uid()) = owner_id
)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.casanova_patients p
    where p.id = casanova_patient_activities.patient_id
      and p.owner_id = (select auth.uid())
  )
  and (
    appointment_id is null
    or exists (
      select 1
      from public.casanova_appointments a
      where a.id = casanova_patient_activities.appointment_id
        and a.patient_id = casanova_patient_activities.patient_id
        and a.owner_id = (select auth.uid())
    )
  )
);
