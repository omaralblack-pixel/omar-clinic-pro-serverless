import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, CheckCircle2, UserPlus, X } from "lucide-react";
import { createQuickBooking, findAppointmentConflicts, paymentMethods } from "../lib/appointments";
import { createPatientQuickly } from "../lib/clinic-data";

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function initialForm(patientId = "") {
  return {
    patientId,
    serviceId: "",
    startsAt: localDateTimeValue(),
    durationMinutes: "30",
    price: "0",
    deposit: "0",
    paymentMethod: "cash",
    notes: "",
    allowConflict: false,
  };
}

export function QuickBookingModal({ open, onClose, patients, services, onSaved, initialPatientId = "" }) {
  const [form, setForm] = useState(() => initialForm(initialPatientId));
  const [patientMode, setPatientMode] = useState("existing");
  const [newPatient, setNewPatient] = useState({ fullName: "", phone: "" });
  const [query, setQuery] = useState("");
  const [conflicts, setConflicts] = useState([]);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(initialPatientId || patients[0]?.id || ""));
    setPatientMode("existing");
    setNewPatient({ fullName: "", phone: "" });
    setQuery("");
    setConflicts([]);
    setChecked(false);
    setMessage("");
  }, [open, initialPatientId, patients]);

  const filteredPatients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return patients;
    return patients.filter((patient) => [patient.full_name, patient.phone, patient.file_no].some((value) => String(value || "").toLowerCase().includes(normalized)));
  }, [patients, query]);

  const selectedPatient = patients.find((patient) => patient.id === form.patientId);
  const selectedService = services.find((service) => service.id === form.serviceId);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value, ...(key === "startsAt" || key === "durationMinutes" ? { allowConflict: false } : {}) }));
    if (key === "startsAt" || key === "durationMinutes") {
      setChecked(false);
      setConflicts([]);
    }
  }

  function selectService(serviceId) {
    const service = services.find((item) => item.id === serviceId);
    setForm((current) => ({
      ...current,
      serviceId,
      durationMinutes: String(service?.duration_minutes || current.durationMinutes),
      price: String(service?.price ?? current.price),
      allowConflict: false,
    }));
    setChecked(false);
    setConflicts([]);
  }

  async function checkConflicts() {
    setMessage("");
    const result = await findAppointmentConflicts({
      startsAt: new Date(form.startsAt).toISOString(),
      durationMinutes: Number(form.durationMinutes),
    });
    setConflicts(result);
    setChecked(true);
    return result;
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const currentConflicts = await checkConflicts();
      if (currentConflicts.length && !form.allowConflict) {
        setMessage("يوجد موعد متعارض. راجعي الوقت أو فعّلي الحجز رغم التعارض.");
        return;
      }

      let patientId = form.patientId;
      if (patientMode === "new") {
        if (!newPatient.fullName.trim() || !newPatient.phone.trim()) throw new Error("أدخلي اسم ورقم هاتف المريضة الجديدة");
        const createdPatient = await createPatientQuickly(newPatient);
        patientId = createdPatient.id;
      }

      if (!patientId) throw new Error("اختاري المريضة");

      const booking = await createQuickBooking({
        patientId,
        serviceId: form.serviceId,
        startsAt: new Date(form.startsAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        price: Number(form.price || 0),
        deposit: Number(form.deposit || 0),
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim(),
        allowConflict: form.allowConflict,
      });

      onSaved?.({ booking, patientId });
      onClose();
    } catch (error) {
      const conflictError = error?.message?.includes("APPOINTMENT_CONFLICT");
      setMessage(conflictError ? "الموعد متعارض مع حجز قائم" : error?.message || "تعذر إنشاء الموعد");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <header className="modal-header">
          <div className="modal-icon"><CalendarPlus size={24} /></div>
          <div><h2 id="booking-title">حجز موعد سريع</h2><p>الموعد والعربون يُحفظان كعملية واحدة مرتبطة بملف المريضة.</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </header>

        <form onSubmit={submit} className="booking-form">
          <div className="mode-switch">
            <button type="button" className={patientMode === "existing" ? "active" : ""} onClick={() => setPatientMode("existing")}>مريضة مسجلة</button>
            <button type="button" className={patientMode === "new" ? "active" : ""} onClick={() => setPatientMode("new")}><UserPlus size={16} />مريضة جديدة</button>
          </div>

          {patientMode === "existing" ? (
            <div className="field field-wide">
              <label htmlFor="patient-search">المريضة</label>
              <input id="patient-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحثي بالاسم أو الهاتف أو رقم الملف" />
              <select value={form.patientId} onChange={(event) => update("patientId", event.target.value)} required>
                <option value="">اختاري المريضة</option>
                {filteredPatients.map((patient) => <option key={patient.id} value={patient.id}>#{patient.file_no} — {patient.full_name} — {patient.phone}</option>)}
              </select>
            </div>
          ) : (
            <div className="form-grid field-wide">
              <div className="field"><label>الاسم الكامل</label><input value={newPatient.fullName} onChange={(event) => setNewPatient((current) => ({ ...current, fullName: event.target.value }))} required /></div>
              <div className="field"><label>رقم الهاتف</label><input value={newPatient.phone} onChange={(event) => setNewPatient((current) => ({ ...current, phone: event.target.value }))} dir="ltr" required /></div>
            </div>
          )}

          <div className="form-grid">
            <div className="field"><label>الخدمة</label><select value={form.serviceId} onChange={(event) => selectService(event.target.value)}><option value="">موعد عام</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div>
            <div className="field"><label>التاريخ والوقت</label><input type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt", event.target.value)} required /></div>
            <div className="field"><label>المدة بالدقائق</label><input type="number" min="5" value={form.durationMinutes} onChange={(event) => update("durationMinutes", event.target.value)} required /></div>
            <div className="field"><label>السعر</label><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => update("price", event.target.value)} /></div>
            <div className="field"><label>العربون</label><input type="number" min="0" max={form.price || undefined} step="0.01" value={form.deposit} onChange={(event) => update("deposit", event.target.value)} /></div>
            <div className="field"><label>طريقة دفع العربون</label><select value={form.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="field field-wide"><label>ملاحظات</label><textarea rows="3" value={form.notes} onChange={(event) => update("notes", event.target.value)} /></div>
          </div>

          <div className="booking-summary">
            <strong>ملخص الحجز</strong>
            <span>{patientMode === "new" ? newPatient.fullName || "مريضة جديدة" : selectedPatient?.full_name || "لم تُحدد المريضة"}</span>
            <span>{selectedService?.name || "موعد عام"}</span>
            <span>{form.startsAt ? new Date(form.startsAt).toLocaleString("ar-JO") : "—"} · {form.durationMinutes} دقيقة</span>
            <span>السعر {Number(form.price || 0).toFixed(2)} د.أ · العربون {Number(form.deposit || 0).toFixed(2)} د.أ</span>
          </div>

          <button className="secondary-button conflict-button" type="button" onClick={() => checkConflicts().catch((error) => setMessage(error.message))}>فحص تعارض المواعيد</button>
          {checked && !conflicts.length && <div className="success-box"><CheckCircle2 size={18} />لا يوجد تعارض في الوقت المختار.</div>}
          {conflicts.length > 0 && <div className="warning-box"><AlertTriangle size={18} /><div><strong>يوجد {conflicts.length} موعد متعارض</strong><p>{conflicts.map((item) => new Date(item.starts_at).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" })).join("، ")}</p><label className="override"><input type="checkbox" checked={form.allowConflict} onChange={(event) => update("allowConflict", event.target.checked)} />السماح بالحجز رغم التعارض بعد المراجعة</label></div></div>}
          {message && <div className="error-box" role="alert">{message}</div>}

          <footer className="modal-actions"><button type="submit" className="primary-button" disabled={busy}>{busy ? "جاري الحجز..." : "تأكيد الحجز"}</button><button type="button" className="secondary-button" onClick={onClose}>إلغاء</button></footer>
        </form>
      </section>
    </div>
  );
}
