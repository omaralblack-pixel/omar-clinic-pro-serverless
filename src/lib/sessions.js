import { requireSupabase } from "./supabase";

export async function loadSessionsWorkspace() {
  const client = requireSupabase();
  const [sessions, appointments, packages] = await Promise.all([
    client.from("casanova_laser_sessions").select("*,patient:casanova_patients(id,file_no,full_name,phone),service:casanova_services(id,name)").order("performed_at", { ascending: false }),
    client.from("casanova_appointments").select("id,patient_id,service_id,starts_at,status,patient:casanova_patients(id,file_no,full_name),service:casanova_services(id,name)").in("status", ["scheduled", "confirmed", "arrived", "in_progress", "delayed"]).order("starts_at"),
    client.from("casanova_packages").select("id,patient_id,service_id,name,total_sessions,used_sessions,status").eq("status", "active").order("created_at", { ascending: false }),
  ]);
  for (const result of [sessions, appointments, packages]) if (result.error) throw result.error;
  return { sessions: sessions.data || [], appointments: appointments.data || [], packages: packages.data || [] };
}

export async function recordLaserSession(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("casanova_record_laser_session", {
    p_patient_id: values.patientId,
    p_appointment_id: values.appointmentId || null,
    p_service_id: values.serviceId || null,
    p_package_id: values.packageId || null,
    p_performed_at: values.performedAt || new Date().toISOString(),
    p_body_area: values.bodyArea.trim(),
    p_device_name: values.deviceName || null,
    p_wavelength: values.wavelength || null,
    p_fluence_j_cm2: values.fluence === "" ? null : Number(values.fluence),
    p_pulse_ms: values.pulse === "" ? null : Number(values.pulse),
    p_spot_mm: values.spot === "" ? null : Number(values.spot),
    p_cooling: values.cooling || null,
    p_skin_type: values.skinType === "" ? null : Number(values.skinType),
    p_pain_score: values.painScore === "" ? null : Number(values.painScore),
    p_reaction: values.reaction || null,
    p_notes: values.notes || null,
    p_next_session_date: values.nextSessionDate || null,
  });
  if (error) throw error;
  return data;
}
