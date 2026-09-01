import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, CircleDollarSign, ClipboardPlus, Edit3, FileHeart, MessageCircle, Phone, Search, UserRound, X } from "lucide-react";
import { createPatientActivity, createPatientPayment, loadPatientDashboard, updatePatient } from "../lib/patients";
import { paymentMethods } from "../lib/appointments";

const tabs = [
  ["overview", "نظرة عامة"], ["appointments", "المواعيد"], ["sessions", "الجلسات"], ["packages", "الباقات"],
  ["payments", "الدفعات"], ["photos", "الصور"], ["medical", "الملف الطبي"], ["timeline", "السجل الزمني"],
];

const appointmentLabels = { scheduled: "محجوز", confirmed: "مؤكد", arrived: "وصلت", in_progress: "قيد الجلسة", completed: "مكتمل", cancelled: "ملغي", no_show: "لم تحضر", delayed: "متأخر" };

function formatDate(value, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-JO", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(value));
}

function money(value) { return `${Number(value || 0).toFixed(2)} د.أ`; }

export function PatientsPage({ patients, selectedPatientId, onSelect, onBook, onChanged }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return patients;
    return patients.filter((patient) => [patient.full_name, patient.phone, patient.file_no, patient.national_id].some((value) => String(value || "").toLowerCase().includes(normalized)));
  }, [patients, query]);

  if (selectedPatientId) return <PatientDashboard patientId={selectedPatientId} summary={patients.find((item) => item.id === selectedPatientId)} onBack={() => onSelect(null)} onBook={onBook} onChanged={onChanged} />;

  return <section className="patients-page">
    <header className="page-heading"><div><small>ملفات المراجعات</small><h2><UserRound size={25} />المرضى</h2><p>بحث سريع وملخص مالي ومواعيد لكل ملف.</p></div><button className="primary-button" onClick={() => onBook()}><CalendarPlus size={18} />حجز جديد</button></header>
    <div className="patient-filter"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="الاسم، الهاتف، رقم الملف أو الرقم الوطني" /><span>{filtered.length} ملف</span></div>
    <div className="patient-table-wrap"><table className="patient-table"><thead><tr><th>المريضة</th><th>الهاتف</th><th>آخر زيارة</th><th>الموعد القادم</th><th>المتبقي</th><th>الباقات</th></tr></thead><tbody>{filtered.map((patient) => <tr key={patient.id} onClick={() => onSelect(patient.id)}><td><strong>{patient.full_name}</strong><small>ملف #{patient.file_no}</small></td><td dir="ltr">{patient.phone}</td><td>{formatDate(patient.last_visit)}</td><td>{formatDate(patient.next_appointment, true)}</td><td className={patient.outstanding > 0 ? "amount-due" : ""}>{money(patient.outstanding)}</td><td>{patient.active_packages || 0} <small>{patient.remaining_sessions ? `· ${patient.remaining_sessions} جلسة` : ""}</small></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-row">لا توجد ملفات مطابقة.</div>}</div>
  </section>;
}

function PatientDashboard({ patientId, summary, onBack, onBook, onChanged }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState("");

  async function refresh() {
    try { setData(await loadPatientDashboard(patientId)); setError(""); }
    catch (loadError) { setError(loadError?.message || "تعذر تحميل ملف المريضة"); }
  }
  useEffect(() => { refresh(); }, [patientId]);

  if (!data) return <div className="calendar-loading">{error || "جاري تحميل ملف المريضة..."}</div>;
  const patient = data.patient;
  const whatsappPhone = String(patient.phone || "").replace(/\D/g, "");

  return <section className="patient-dashboard">
    <button className="back-button" onClick={onBack}>← العودة إلى قائمة المرضى</button>
    {error && <div className="error-box">{error}</div>}
    <header className="patient-hero"><div className="patient-avatar"><UserRound size={30} /></div><div className="patient-identity"><small>ملف #{patient.file_no}</small><h2>{patient.full_name}</h2><p><Phone size={14} /> <span dir="ltr">{patient.phone}</span>{patient.national_id && ` · ${patient.national_id}`}</p></div><div className="patient-actions"><button className="primary-button" onClick={() => onBook(patient.id)}><CalendarPlus size={17} />حجز</button><button className="secondary-button" onClick={() => setDialog("note")}><ClipboardPlus size={17} />ملاحظة</button><button className="secondary-button" onClick={() => setDialog("payment")}><CircleDollarSign size={17} />دفعة</button>{whatsappPhone && <a className="secondary-button" href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer"><MessageCircle size={17} />واتساب</a>}<button className="secondary-button" onClick={() => setDialog("edit")}><Edit3 size={17} />تعديل</button></div></header>
    <div className="patient-metrics"><article><span>آخر زيارة</span><strong>{formatDate(summary?.last_visit)}</strong></article><article><span>الموعد القادم</span><strong>{formatDate(summary?.next_appointment, true)}</strong></article><article><span>الرصيد المتبقي</span><strong className={summary?.outstanding > 0 ? "amount-due" : ""}>{money(summary?.outstanding)}</strong></article><article><span>الباقات النشطة</span><strong>{summary?.active_packages || 0}</strong></article></div>
    <nav className="patient-tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
    <PatientTab tab={tab} data={data} />
    {dialog && <PatientDialog type={dialog} patient={patient} appointments={data.appointments} onClose={() => setDialog(null)} onSaved={async () => { setDialog(null); await refresh(); onChanged?.(); }} />}
  </section>;
}

function PatientTab({ tab, data }) {
  const { patient, appointments, sessions, packages, transactions, activities } = data;
  if (tab === "overview") return <div className="detail-grid"><InfoCard title="الحالة الطبية" rows={[["الحالات", patient.medical_conditions], ["الحساسية", patient.allergies], ["الأدوية", patient.medications], ["موانع العلاج", patient.contraindications]]} /><InfoCard title="بيانات الملف" rows={[["تاريخ الميلاد", formatDate(patient.birth_date)], ["العنوان", patient.address], ["نوع البشرة", patient.skin_type ? `Fitzpatrick ${patient.skin_type}` : null], ["ملاحظات", patient.notes]]} /><InfoCard title="آخر جلسة ليزر" rows={sessions[0] ? [["المنطقة", sessions[0].body_area], ["الجهاز", sessions[0].device_name], ["Fluence", sessions[0].fluence_j_cm2], ["رد الفعل", sessions[0].reaction]] : []} /><InfoCard title="المتابعة القادمة" rows={activities.filter((item) => item.follow_up_at && !item.completed_at).slice(0, 3).map((item) => [formatDate(item.follow_up_at, true), item.summary])} /></div>;
  if (tab === "appointments") return <DataList empty="لا توجد مواعيد" rows={appointments.map((item) => ({ title: `${formatDate(item.starts_at, true)} · ${item.service?.name || "موعد عام"}`, meta: `${appointmentLabels[item.status] || item.status} · ${money(item.paid_effective)} مدفوع من ${money(item.price)}` }))} />;
  if (tab === "sessions") return <DataList empty="لا توجد جلسات مسجلة" rows={sessions.map((item) => ({ title: `${item.service?.name || "جلسة ليزر"} · ${item.body_area || "—"}`, meta: `${formatDate(item.performed_at, true)} · جلسة #${item.session_number || "—"} · ${item.fluence_j_cm2 || "—"} J/cm²` }))} />;
  if (tab === "packages") return <DataList empty="لا توجد باقات" rows={packages.map((item) => ({ title: item.name, meta: `${item.status} · ${item.used_sessions}/${item.total_sessions} جلسة · ${money(item.paid_amount)} من ${money(item.total_price)}` }))} />;
  if (tab === "payments") return <DataList empty="لا توجد حركات مالية" rows={transactions.map((item) => ({ title: `${item.kind === "income" ? "دفعة" : "مصروف"} · ${money(item.amount)}`, meta: `${formatDate(item.occurred_at, true)} · ${item.method} · ${item.description || "—"}` }))} />;
  if (tab === "medical") return <div className="detail-grid"><InfoCard title="الحالات الطبية" rows={[["الحالات", patient.medical_conditions], ["الحساسية", patient.allergies], ["الأدوية", patient.medications], ["موانع العلاج", patient.contraindications], ["ملاحظات", patient.notes]]} /></div>;
  if (tab === "photos") return <section className="photos-placeholder"><FileHeart size={38} /><h3>صور قبل وبعد</h3><p>هذه الميزة تحتاج إعداد Supabase Storage وسياسة وصول خاصة بالصور الطبية قبل تفعيل الرفع.</p></section>;
  const timeline = [
    ...activities.map((item) => ({ date: item.occurred_at, title: item.summary, meta: `متابعة · ${item.activity_type}` })),
    ...appointments.map((item) => ({ date: item.starts_at, title: item.service?.name || "موعد", meta: appointmentLabels[item.status] || item.status })),
    ...sessions.map((item) => ({ date: item.performed_at, title: item.service?.name || "جلسة ليزر", meta: item.body_area || "" })),
    ...transactions.map((item) => ({ date: item.occurred_at, title: `دفعة ${money(item.amount)}`, meta: item.method })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  return <DataList empty="لا يوجد سجل زمني" rows={timeline.map((item) => ({ title: item.title, meta: `${formatDate(item.date, true)} · ${item.meta}` }))} />;
}

function InfoCard({ title, rows }) { return <article className="info-card"><h3>{title}</h3>{rows.length ? rows.map(([label, value], index) => <div key={`${label}-${index}`}><span>{label}</span><strong>{value || "—"}</strong></div>) : <p>لا توجد بيانات مسجلة.</p>}</article>; }
function DataList({ rows, empty }) { return <div className="data-list">{rows.length ? rows.map((row, index) => <article key={`${row.title}-${index}`}><strong>{row.title}</strong><span>{row.meta}</span></article>) : <p>{empty}</p>}</div>; }

function PatientDialog({ type, patient, appointments, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState({ summary: "", followUpAt: "" });
  const [payment, setPayment] = useState({ appointmentId: "", amount: "", method: "cash", description: "" });
  const [edit, setEdit] = useState({ full_name: patient.full_name || "", phone: patient.phone || "", birth_date: patient.birth_date || "", national_id: patient.national_id || "", address: patient.address || "", medical_conditions: patient.medical_conditions || "", allergies: patient.allergies || "", medications: patient.medications || "", contraindications: patient.contraindications || "", notes: patient.notes || "" });

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (type === "note") await createPatientActivity(patient.id, note.summary, note.followUpAt ? new Date(note.followUpAt).toISOString() : null);
      if (type === "payment") { if (!(Number(payment.amount) > 0)) throw new Error("أدخلي مبلغًا صحيحًا"); await createPatientPayment(patient.id, payment); }
      if (type === "edit") await updatePatient(patient.id, Object.fromEntries(Object.entries(edit).map(([key, value]) => [key, value === "" ? null : value])));
      onSaved();
    } catch (saveError) { setError(saveError?.message || "تعذر الحفظ"); }
    finally { setBusy(false); }
  }

  const title = type === "note" ? "إضافة ملاحظة أو متابعة" : type === "payment" ? "تسجيل دفعة" : "تعديل بيانات المريضة";
  return <div className="modal-backdrop"><section className="patient-dialog" role="dialog" aria-modal="true"><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20} /></button></header><form onSubmit={submit}>
    {type === "note" && <div className="form-grid"><div className="field field-wide"><label>الملاحظة</label><textarea rows="4" value={note.summary} onChange={(event) => setNote((current) => ({ ...current, summary: event.target.value }))} required /></div><div className="field"><label>موعد المتابعة (اختياري)</label><input type="datetime-local" value={note.followUpAt} onChange={(event) => setNote((current) => ({ ...current, followUpAt: event.target.value }))} /></div></div>}
    {type === "payment" && <div className="form-grid"><div className="field"><label>المبلغ</label><input type="number" min=".01" step=".01" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required /></div><div className="field"><label>طريقة الدفع</label><select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field field-wide"><label>ربط بموعد (اختياري)</label><select value={payment.appointmentId} onChange={(event) => setPayment((current) => ({ ...current, appointmentId: event.target.value }))}><option value="">بدون موعد</option>{appointments.map((item) => <option key={item.id} value={item.id}>{formatDate(item.starts_at, true)} · {item.service?.name || "موعد"}</option>)}</select></div><div className="field field-wide"><label>الوصف</label><input value={payment.description} onChange={(event) => setPayment((current) => ({ ...current, description: event.target.value }))} /></div></div>}
    {type === "edit" && <div className="form-grid">{[["full_name", "الاسم الكامل"], ["phone", "الهاتف"], ["birth_date", "تاريخ الميلاد", "date"], ["national_id", "الرقم الوطني"], ["address", "العنوان"]].map(([key, label, inputType]) => <div className="field" key={key}><label>{label}</label><input type={inputType || "text"} value={edit[key]} onChange={(event) => setEdit((current) => ({ ...current, [key]: event.target.value }))} required={key === "full_name" || key === "phone"} /></div>)}{[["medical_conditions", "الحالات الطبية"], ["allergies", "الحساسية"], ["medications", "الأدوية"], ["contraindications", "موانع العلاج"], ["notes", "ملاحظات"]].map(([key, label]) => <div className="field field-wide" key={key}><label>{label}</label><textarea value={edit[key]} onChange={(event) => setEdit((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div>}
    {error && <div className="error-box">{error}</div>}<footer className="modal-actions"><button className="primary-button" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ"}</button><button type="button" className="secondary-button" onClick={onClose}>إلغاء</button></footer>
  </form></section></div>;
}
