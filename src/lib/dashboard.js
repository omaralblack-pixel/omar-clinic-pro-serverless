import { requireSupabase } from "./supabase";

function localDayRange(date = new Date()) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function loadDashboardSnapshot() {
  const client = requireSupabase();
  const { from, to } = localDayRange();
  const [appointments, transactions, sessions, patients, followUps, packages] = await Promise.all([
    client.from("casanova_appointments").select("*,patient:casanova_patients(id,file_no,full_name,phone),service:casanova_services(id,name)").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
    client.from("casanova_transactions").select("id,kind,amount,method,occurred_at,patient:casanova_patients(id,full_name)").gte("occurred_at", from).lt("occurred_at", to).order("occurred_at", { ascending: false }),
    client.from("casanova_laser_sessions").select("id,patient_id,performed_at,body_area,patient:casanova_patients(id,full_name)").gte("performed_at", from).lt("performed_at", to).order("performed_at", { ascending: false }),
    client.from("casanova_patients").select("id,full_name,created_at").gte("created_at", from).lt("created_at", to),
    client.from("casanova_patient_activities").select("id,summary,follow_up_at,activity_type,patient:casanova_patients(id,file_no,full_name,phone)").is("completed_at", null).not("follow_up_at", "is", null).lt("follow_up_at", to).order("follow_up_at"),
    client.from("casanova_packages").select("id,name,total_sessions,used_sessions,expires_on,status,patient:casanova_patients(id,file_no,full_name),service:casanova_services(id,name)").eq("status", "active").order("expires_on"),
  ]);

  for (const result of [appointments, transactions, sessions, patients, followUps, packages]) {
    if (result.error) throw result.error;
  }

  return {
    appointments: appointments.data || [],
    transactions: transactions.data || [],
    sessions: sessions.data || [],
    newPatients: patients.data || [],
    followUps: followUps.data || [],
    packages: packages.data || [],
  };
}

export async function completeFollowUp(activityId) {
  const client = requireSupabase();
  const { data, error } = await client.from("casanova_patient_activities").update({ completed_at: new Date().toISOString() }).eq("id", activityId).select("id").single();
  if (error) throw error;
  return data;
}
