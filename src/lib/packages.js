import { requireSupabase } from "./supabase";

export const packageStatuses = [["active", "نشط"], ["completed", "مكتمل"], ["expired", "منتهي"], ["cancelled", "ملغي"]];

export async function loadPackages() {
  const client = requireSupabase();
  const { data, error } = await client.from("casanova_packages")
    .select("*,patient:casanova_patients(id,file_no,full_name,phone),service:casanova_services(id,name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPackage(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("casanova_create_package", {
    p_patient_id: values.patientId,
    p_service_id: values.serviceId || null,
    p_name: values.name.trim(),
    p_total_sessions: Number(values.totalSessions),
    p_total_price: Number(values.totalPrice || 0),
    p_paid_amount: Number(values.paidAmount || 0),
    p_starts_on: values.startsOn,
    p_expires_on: values.expiresOn || null,
    p_notes: values.notes || null,
    p_payment_method: values.paymentMethod,
  });
  if (error) throw error;
  return data;
}

export async function updatePackageStatus(packageId, status) {
  const client = requireSupabase();
  const { data, error } = await client.from("casanova_packages").update({ status })
    .eq("id", packageId)
    .select("*,patient:casanova_patients(id,file_no,full_name,phone),service:casanova_services(id,name)")
    .single();
  if (error) throw error;
  return data;
}
