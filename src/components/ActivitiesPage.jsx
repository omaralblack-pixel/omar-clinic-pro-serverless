import { useEffect, useMemo, useState } from "react";
import { Check, CirclePlus, Clock3, ContactRound, MessageCircle, Phone, RotateCcw, Search, X } from "lucide-react";
import { activityTypes, createActivity, loadActivities, setActivityCompleted } from "../lib/activities";

const typeLabels = Object.fromEntries(activityTypes);
const typeIcons = { call: Phone, whatsapp: MessageCircle, message: MessageCircle, visit: ContactRound, follow_up: Clock3, note: ContactRound };

function localDateTimeValue(date = new Date()) { const copy = new Date(date); copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset()); return copy.toISOString().slice(0, 16); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("ar-JO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—"; }

export function ActivitiesPage({ patients, refreshKey, onOpenPatient, onChanged }) {
  const [activities, setActivities] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("open");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() { setLoading(true); try { setActivities(await loadActivities()); setError(""); } catch (loadError) { setError(loadError?.message || "تعذر تحميل المتابعات"); } finally { setLoading(false); } }
  useEffect(() => { refresh(); }, [refreshKey]);

  const now = Date.now();
  const filtered = useMemo(() => activities.filter((item) => {
    const searchable = `${item.patient?.full_name || ""} ${item.patient?.phone || ""} ${item.summary || ""}`.toLowerCase();
    const stateMatches = stateFilter === "all" || (stateFilter === "completed" ? Boolean(item.completed_at) : stateFilter === "overdue" ? !item.completed_at && item.follow_up_at && new Date(item.follow_up_at).getTime() < now : !item.completed_at);
    return (typeFilter === "all" || item.activity_type === typeFilter) && stateMatches && searchable.includes(query.trim().toLowerCase());
  }), [activities, query, typeFilter, stateFilter, now]);

  async function toggle(item) { try { const updated = await setActivityCompleted(item.id, !item.completed_at); setActivities((rows) => rows.map((row) => row.id === item.id ? updated : row)); onChanged?.(); } catch (actionError) { setError(actionError.message); } }
  const openCount = activities.filter((item) => !item.completed_at).length;
  const overdueCount = activities.filter((item) => !item.completed_at && item.follow_up_at && new Date(item.follow_up_at).getTime() < now).length;

  return <section className="operations-page">
    <header className="page-heading"><div><small>التواصل وخدمة المراجعات</small><h2><ContactRound size={25} />التواصل والمتابعات</h2><p>سجل موحد للمكالمات والواتساب والزيارات مع متابعة ما يستحق اليوم.</p></div><button className="primary-button" onClick={() => setDialogOpen(true)}><CirclePlus size={18} />إضافة تواصل</button></header>
    <div className="operations-metrics"><article><span>المفتوح</span><strong>{openCount}</strong></article><article className={overdueCount ? "danger" : ""}><span>المتأخر</span><strong>{overdueCount}</strong></article><article><span>المكتمل</span><strong>{activities.length - openCount}</strong></article></div>
    <div className="operations-toolbar"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث بالاسم أو الهاتف أو الملاحظة" /></label><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">كل أنواع التواصل</option>{activityTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="open">المفتوح</option><option value="overdue">المتأخر</option><option value="completed">المكتمل</option><option value="all">الكل</option></select></div>
    {error && <div className="error-box">{error}</div>}
    {loading ? <div className="calendar-loading">جاري تحميل المتابعات...</div> : <div className="activity-board">{filtered.length ? filtered.map((item) => <ActivityCard key={item.id} item={item} onToggle={() => toggle(item)} onOpenPatient={onOpenPatient} />) : <p className="empty-line">لا توجد متابعات مطابقة.</p>}</div>}
    {dialogOpen && <ActivityDialog patients={patients} onClose={() => setDialogOpen(false)} onSaved={async () => { setDialogOpen(false); await refresh(); onChanged?.(); }} />}
  </section>;
}

function ActivityCard({ item, onToggle, onOpenPatient }) {
  const Icon = typeIcons[item.activity_type] || ContactRound;
  const overdue = !item.completed_at && item.follow_up_at && new Date(item.follow_up_at).getTime() < Date.now();
  const phone = String(item.patient?.phone || "").replace(/\D/g, "");
  return <article className={`activity-card ${item.completed_at ? "done" : ""} ${overdue ? "overdue" : ""}`}><span className="activity-icon"><Icon size={19} /></span><button className="activity-patient" onClick={() => onOpenPatient(item.patient?.id)}><strong>{item.patient?.full_name || "—"}</strong><small>ملف #{item.patient?.file_no || "—"} · {item.patient?.phone || "—"}</small></button><div className="activity-content"><span>{typeLabels[item.activity_type] || item.activity_type} · {formatDate(item.occurred_at)}</span><strong>{item.summary}</strong>{item.outcome && <p>النتيجة: {item.outcome}</p>}{item.follow_up_at && <em>المتابعة: {formatDate(item.follow_up_at)}</em>}</div><div className="activity-actions">{phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label="فتح واتساب"><MessageCircle size={17} /></a>}<button onClick={onToggle} aria-label={item.completed_at ? "إعادة فتح" : "إكمال"}>{item.completed_at ? <RotateCcw size={17} /> : <Check size={17} />}</button></div></article>;
}

function ActivityDialog({ patients, onClose, onSaved }) {
  const [form, setForm] = useState({ patientId: patients[0]?.id || "", activityType: "call", occurredAt: localDateTimeValue(), summary: "", outcome: "", followUpAt: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event) { event.preventDefault(); setBusy(true); setError(""); try { await createActivity({ ...form, occurredAt: new Date(form.occurredAt).toISOString(), followUpAt: form.followUpAt ? new Date(form.followUpAt).toISOString() : null }); onSaved(); } catch (saveError) { setError(saveError?.message || "تعذر حفظ التواصل"); } finally { setBusy(false); } }
  return <div className="modal-backdrop"><section className="operation-dialog" role="dialog" aria-modal="true"><header><h2>إضافة تواصل أو متابعة</h2><button className="icon-button" onClick={onClose}><X size={20} /></button></header><form onSubmit={submit}><div className="form-grid"><div className="field"><label>المريضة</label><select value={form.patientId} onChange={(event) => update("patientId", event.target.value)} required>{patients.map((patient) => <option key={patient.id} value={patient.id}>#{patient.file_no} — {patient.full_name}</option>)}</select></div><div className="field"><label>نوع التواصل</label><select value={form.activityType} onChange={(event) => update("activityType", event.target.value)}>{activityTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label>وقت التواصل</label><input type="datetime-local" value={form.occurredAt} onChange={(event) => update("occurredAt", event.target.value)} required /></div><div className="field"><label>موعد متابعة لاحق</label><input type="datetime-local" value={form.followUpAt} onChange={(event) => update("followUpAt", event.target.value)} /></div><div className="field field-wide"><label>الملخص</label><textarea rows="3" value={form.summary} onChange={(event) => update("summary", event.target.value)} required /></div><div className="field field-wide"><label>النتيجة</label><textarea rows="2" value={form.outcome} onChange={(event) => update("outcome", event.target.value)} /></div></div>{error && <div className="error-box">{error}</div>}<footer className="modal-actions"><button className="primary-button" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ"}</button><button type="button" className="secondary-button" onClick={onClose}>إلغاء</button></footer></form></section></div>;
}
