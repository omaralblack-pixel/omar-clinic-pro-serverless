import { requireSupabase } from "./supabase";

export const activityTypes = [
  ["call", "مكالمة"], ["whatsapp", "واتساب"], ["message", "رسالة"],
  ["visit", "زيارة"], ["follow_up", "متابعة"], ["note", "ملاحظة"],
];

export async function loadActivities() {
  const client = requireSupabase();
  const { data, error } = await client.from("casanova_patient_activities")
    .select("*,patient:casanova_patients(id,file_no,full_name,phone),appointment:casanova_appointments(id,starts_at,status)")
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createActivity(values) {
  const client = requireSupabase();
  const { data, error } = await client.from("casanova_patient_activities").insert({
    patient_id: values.patientId,
    appointment_id: values.appointmentId || null,
    activity_type: values.activityType,
    occurred_at: values.occurredAt || new Date().toISOString(),
    summary: values.summary.trim(),
    outcome: values.outcome?.trim() || null,
    follow_up_at: values.followUpAt || null,
  }).select("*,patient:casanova_patients(id,file_no,full_name,phone),appointment:casanova_appointments(id,starts_at,status)").single();
  if (error) throw error;
  return data;
}

export async function setActivityCompleted(activityId, completed) {
  const client = requireSupabase();
  const { data, error } = await client.from("casanova_patient_activities")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", activityId)
    .select("*,patient:casanova_patients(id,file_no,full_name,phone),appointment:casanova_appointments(id,starts_at,status)")
    .single();
  if (error) throw error;
  return data;
}
