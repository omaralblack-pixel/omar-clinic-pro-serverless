import { requireSupabase } from "./supabase";

export async function loadBookingOptions() {
  const client = requireSupabase();
  const [patientsResult, servicesResult] = await Promise.all([
    client.from("casanova_patients").select("id,file_no,full_name,phone,active").eq("active", true).order("full_name"),
    client.from("casanova_services").select("id,name,price,duration_minutes,active").eq("active", true).order("name"),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (servicesResult.error) throw servicesResult.error;
  return { patients: patientsResult.data || [], services: servicesResult.data || [] };
}

export async function createPatientQuickly({ fullName, phone }) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("casanova_patients")
    .insert({ full_name: fullName.trim(), phone: phone.trim(), active: true })
    .select("id,file_no,full_name,phone,active")
    .single();

  if (error) throw error;
  return data;
}
