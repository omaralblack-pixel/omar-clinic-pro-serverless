import { requireSupabase } from "./supabase";

function rangeForDate(date) {
  const from = new Date(`${date}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function loadFinanceSnapshot(date) {
  const client = requireSupabase();
  const { from, to } = rangeForDate(date);
  const [transactions, closing, appointments, packages] = await Promise.all([
    client.from("casanova_transactions").select("*,patient:casanova_patients(id,file_no,full_name),appointment:casanova_appointments(id,starts_at),package:casanova_packages(id,name)").gte("occurred_at", from).lt("occurred_at", to).order("occurred_at", { ascending: false }),
    client.from("casanova_cash_closings").select("*").eq("closing_date", date).maybeSingle(),
    client.from("casanova_appointments").select("id,patient_id,starts_at,price,paid,status,service:casanova_services(name)").not("status", "in", "(cancelled,no_show)").order("starts_at", { ascending: false }),
    client.from("casanova_packages").select("id,patient_id,name,total_price,paid_amount,status").eq("status", "active").order("created_at", { ascending: false }),
  ]);
  for (const result of [transactions, closing, appointments, packages]) if (result.error) throw result.error;
  return { transactions: transactions.data || [], closing: closing.data || null, appointments: appointments.data || [], packages: packages.data || [] };
}

export async function recordTransaction(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("casanova_record_transaction", {
    p_kind: values.kind, p_category: values.category, p_amount: Number(values.amount), p_method: values.method,
    p_description: values.description, p_occurred_at: new Date(values.occurredAt).toISOString(),
    p_patient_id: values.patientId || null, p_appointment_id: values.appointmentId || null,
    p_package_id: values.packageId || null, p_reference: values.reference || null,
  });
  if (error) throw error;
  return data;
}

export async function recordCashClosing(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("casanova_record_cash_closing", {
    p_closing_date: values.date, p_opening_cash: Number(values.openingCash || 0),
    p_counted_cash: Number(values.countedCash || 0), p_notes: values.notes || null,
  });
  if (error) throw error;
  return data;
}
