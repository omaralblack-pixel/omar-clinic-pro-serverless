import { requireSupabase } from "./supabase";

export const appointmentStatuses = [
  ["scheduled", "محجوز"],
  ["confirmed", "مؤكد"],
  ["arrived", "وصلت"],
  ["in_progress", "قيد الجلسة"],
  ["completed", "مكتمل"],
  ["cancelled", "ملغي"],
  ["no_show", "لم تحضر"],
  ["delayed", "متأخر"],
];

export const paymentMethods = [
  ["cash", "نقدي"],
  ["card", "بطاقة"],
  ["cliq", "CliQ"],
  ["bank_transfer", "حوالة بنكية"],
  ["other", "أخرى"],
];

export async function findAppointmentConflicts({ startsAt, durationMinutes, excludeAppointmentId = null }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("casanova_find_appointment_conflicts", {
    p_starts_at: startsAt,
    p_duration_minutes: durationMinutes,
    p_exclude_appointment_id: excludeAppointmentId,
  });

  if (error) throw error;
  return data || [];
}

export async function createQuickBooking(values) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("casanova_create_quick_booking", {
    p_patient_id: values.patientId,
    p_starts_at: values.startsAt,
    p_service_id: values.serviceId || null,
    p_duration_minutes: values.durationMinutes,
    p_price: values.price,
    p_deposit: values.deposit,
    p_payment_method: values.paymentMethod,
    p_notes: values.notes || null,
    p_allow_conflict: values.allowConflict,
  });

  if (error) throw error;
  return data?.[0] || null;
}
