import { requireSupabase } from "./supabase";
import { loadPatientMedia } from "./patient-media";

const inactiveAppointmentStatuses = new Set(["cancelled", "no_show"]);

export async function loadPatientDirectory() {
  const client = requireSupabase();
  const [patientsResult, appointmentsResult, packagesResult, transactionsResult] = await Promise.all([
    client.from("casanova_patients").select("*").eq("active", true).order("full_name"),
    client.from("casanova_appointments").select("id,patient_id,starts_at,status,price,paid").order("starts_at"),
    client.from("casanova_packages").select("id,patient_id,status,total_sessions,used_sessions,expires_on").eq("status", "active"),
    client.from("casanova_transactions").select("appointment_id,amount,kind").eq("kind", "income").not("appointment_id", "is", null),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (appointmentsResult.error) throw appointmentsResult.error;
  if (packagesResult.error) throw packagesResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  const appointmentsByPatient = new Map();
  for (const appointment of appointmentsResult.data || []) {
    const rows = appointmentsByPatient.get(appointment.patient_id) || [];
    rows.push(appointment);
    appointmentsByPatient.set(appointment.patient_id, rows);
  }
  const packagesByPatient = new Map();
  for (const patientPackage of packagesResult.data || []) {
    const rows = packagesByPatient.get(patientPackage.patient_id) || [];
    rows.push(patientPackage);
    packagesByPatient.set(patientPackage.patient_id, rows);
  }
  const paymentsByAppointment = new Map();
  for (const transaction of transactionsResult.data || []) {
    paymentsByAppointment.set(transaction.appointment_id, (paymentsByAppointment.get(transaction.appointment_id) || 0) + Number(transaction.amount || 0));
  }

  const now = Date.now();
  return (patientsResult.data || []).map((patient) => {
    const appointments = appointmentsByPatient.get(patient.id) || [];
    const past = appointments.filter((item) => new Date(item.starts_at).getTime() < now && item.status === "completed");
    const future = appointments.filter((item) => new Date(item.starts_at).getTime() >= now && !inactiveAppointmentStatuses.has(item.status));
    const outstanding = appointments
      .filter((item) => item.status !== "cancelled")
      .reduce((sum, item) => sum + Math.max(0, Number(item.price || 0) - Math.max(Number(item.paid || 0), paymentsByAppointment.get(item.id) || 0)), 0);
    const activePackages = packagesByPatient.get(patient.id) || [];

    return {
      ...patient,
      last_visit: past.at(-1)?.starts_at || null,
      next_appointment: future[0]?.starts_at || null,
      outstanding,
      active_packages: activePackages.length,
      remaining_sessions: activePackages.reduce((sum, item) => sum + Math.max(0, Number(item.total_sessions || 0) - Number(item.used_sessions || 0)), 0),
    };
  });
}

export async function loadPatientDashboard(patientId) {
  const client = requireSupabase();
  const [patient, appointments, sessions, packages, transactions, activities, patientFiles] = await Promise.all([
    client.from("casanova_patients").select("*").eq("id", patientId).single(),
    client.from("casanova_appointments").select("*,service:casanova_services(id,name)").eq("patient_id", patientId).order("starts_at", { ascending: false }),
    client.from("casanova_laser_sessions").select("*,service:casanova_services(id,name)").eq("patient_id", patientId).order("performed_at", { ascending: false }),
    client.from("casanova_packages").select("*,service:casanova_services(id,name)").eq("patient_id", patientId).order("created_at", { ascending: false }),
    client.from("casanova_transactions").select("*").eq("patient_id", patientId).order("occurred_at", { ascending: false }),
    client.from("casanova_patient_activities").select("*").eq("patient_id", patientId).order("occurred_at", { ascending: false }),
    loadPatientMedia(patientId),
  ]);

  for (const result of [patient, appointments, sessions, packages, transactions, activities]) {
    if (result.error) throw result.error;
  }

  const paymentsByAppointment = new Map();
  for (const transaction of transactions.data || []) {
    if (transaction.kind === "income" && transaction.appointment_id) {
      paymentsByAppointment.set(transaction.appointment_id, (paymentsByAppointment.get(transaction.appointment_id) || 0) + Number(transaction.amount || 0));
    }
  }

  return {
    patient: patient.data,
    appointments: (appointments.data || []).map((appointment) => ({ ...appointment, paid_effective: Math.max(Number(appointment.paid || 0), paymentsByAppointment.get(appointment.id) || 0) })),
    sessions: sessions.data || [],
    packages: packages.data || [],
    transactions: transactions.data || [],
    activities: activities.data || [],
    patientNotes: patientFiles.notes,
    media: patientFiles.media,
  };
}

export async function updatePatient(patientId, values) {
  const client = requireSupabase();
  const { data, error } = await client.from("casanova_patients").update(values).eq("id", patientId).select("*").single();
  if (error) throw error;
  return data;
}

export async function createPatientActivity(patientId, summary, followUpAt = null) {
  const client = requireSupabase();
  const { data, error } = await client.from("casanova_patient_activities").insert({
    patient_id: patientId,
    activity_type: followUpAt ? "follow_up" : "note",
    summary: summary.trim(),
    follow_up_at: followUpAt || null,
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function createPatientPayment(patientId, values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("casanova_record_transaction", {
    p_kind: "income", p_category: "payment", p_amount: Number(values.amount), p_method: values.method,
    p_description: values.description?.trim() || "دفعة من المريضة", p_occurred_at: new Date().toISOString(),
    p_patient_id: patientId, p_appointment_id: values.appointmentId || null, p_package_id: null, p_reference: null,
  });
  if (error) throw error;
  return data;
}
