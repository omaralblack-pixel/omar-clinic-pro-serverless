import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarCheck2, CalendarPlus, Check, CircleDollarSign, Clock3, ContactRound, RefreshCw, Sparkles, UserPlus, UsersRound } from "lucide-react";
import { completeFollowUp, loadDashboardSnapshot } from "../lib/dashboard";

const statusLabels = { scheduled: "محجوز", confirmed: "مؤكد", arrived: "وصلت", in_progress: "قيد الجلسة", completed: "مكتمل", cancelled: "ملغي", no_show: "لم تحضر", delayed: "متأخر" };
const attendanceStatuses = new Set(["arrived", "in_progress", "completed"]);
const resolvedStatuses = new Set(["arrived", "in_progress", "completed", "no_show"]);

function money(value) { return `${Number(value || 0).toFixed(2)} د.أ`; }
function formatTime(value) { return new Intl.DateTimeFormat("ar-JO", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("ar-JO", { day: "numeric", month: "short" }).format(new Date(value)) : "بدون تاريخ"; }

export function DashboardPage({ patientDirectory, refreshKey, onBook, onOpenAppointments, onOpenPatient }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    try { setData(await loadDashboardSnapshot()); setError(""); }
    catch (loadError) { setError(loadError?.message || "تعذر تحميل لوحة اليوم"); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, [refreshKey]);

  const summary = useMemo(() => {
    if (!data) return { income: 0, expenses: 0, attendanceRate: 0, outstanding: 0, alerts: [] };
    const resolved = data.appointments.filter((item) => resolvedStatuses.has(item.status));
    const attended = resolved.filter((item) => attendanceStatuses.has(item.status));
    const outstandingPatients = patientDirectory.filter((patient) => patient.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
    const packageAlerts = data.packages.filter((item) => {
      const remaining = Number(item.total_sessions || 0) - Number(item.used_sessions || 0);
      const days = item.expires_on ? (new Date(item.expires_on).getTime() - Date.now()) / 86_400_000 : Infinity;
      return remaining <= 1 || days <= 14;
    });
    return {
      income: data.transactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      expenses: data.transactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      attendanceRate: resolved.length ? Math.round((attended.length / resolved.length) * 100) : 0,
      outstanding: outstandingPatients.reduce((sum, patient) => sum + patient.outstanding, 0),
      alerts: [
        ...outstandingPatients.slice(0, 5).map((patient) => ({ key: `due-${patient.id}`, patientId: patient.id, title: `${patient.full_name} عليها ${money(patient.outstanding)}`, meta: "رصيد مستحق" })),
        ...packageAlerts.slice(0, 5).map((item) => ({ key: `package-${item.id}`, patientId: item.patient?.id, title: `${item.patient?.full_name || "مريضة"} · ${item.name}`, meta: `${Math.max(0, Number(item.total_sessions || 0) - Number(item.used_sessions || 0))} جلسة متبقية · ينتهي ${formatDate(item.expires_on)}` })),
      ].slice(0, 8),
    };
  }, [data, patientDirectory]);

  async function markDone(activityId) {
    try { await completeFollowUp(activityId); await refresh(); }
    catch (actionError) { setError(actionError?.message || "تعذر إكمال المتابعة"); }
  }

  return <section className="dashboard-page">
    <header className="dashboard-welcome"><div><small>{new Intl.DateTimeFormat("ar-JO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</small><h2>صباح الخير، جاهزين ليوم مرتب؟</h2><p>كل ما يحتاج انتباهك اليوم في مكان واحد.</p></div><div><button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw size={17} />تحديث</button><button className="primary-button" onClick={() => onBook()}><CalendarPlus size={18} />حجز سريع</button></div></header>
    {error && <div className="error-box"><AlertCircle size={18} />{error}</div>}
    {loading && !data ? <div className="calendar-loading">جاري تجهيز لوحة اليوم...</div> : data && <>
      <div className="dashboard-metrics">
        <Metric icon={CalendarCheck2} label="مواعيد اليوم" value={data.appointments.length} note={`${data.appointments.filter((item) => item.status === "confirmed").length} مؤكدة`} />
        <Metric icon={CircleDollarSign} label="دخل اليوم" value={money(summary.income)} note={summary.expenses ? `مصروف ${money(summary.expenses)}` : "لا مصروف مسجل"} />
        <Metric icon={Sparkles} label="الجلسات المنفذة" value={data.sessions.length} note={`${summary.attendanceRate}% نسبة الحضور`} />
        <Metric icon={UserPlus} label="مرضى جدد" value={data.newPatients.length} note={`${patientDirectory.length} ملف نشط`} />
        <Metric icon={CircleDollarSign} label="إجمالي المستحقات" value={money(summary.outstanding)} note="من المواعيد غير المسددة" warning={summary.outstanding > 0} />
      </div>
      <div className="dashboard-columns">
        <section className="dashboard-panel today-panel"><header><div><h3><Clock3 size={19} />جدول اليوم</h3><span>{data.appointments.length} موعد</span></div><button onClick={onOpenAppointments}>فتح التقويم</button></header>{data.appointments.length ? <div className="today-list">{data.appointments.map((item) => <button key={item.id} onClick={() => item.patient?.id && onOpenPatient(item.patient.id)}><time>{formatTime(item.starts_at)}</time><span><strong>{item.patient?.full_name || "—"}</strong><small>{item.service?.name || "موعد عام"} · {item.duration_minutes} دقيقة</small></span><em className={`status-dot ${item.status}`}>{statusLabels[item.status] || item.status}</em></button>)}</div> : <EmptyLine text="لا توجد مواعيد اليوم." />}</section>
        <section className="dashboard-panel"><header><div><h3><ContactRound size={19} />متابعات مستحقة</h3><span>{data.followUps.length}</span></div></header>{data.followUps.length ? <div className="followup-list">{data.followUps.map((item) => <article key={item.id}><button className="patient-link" onClick={() => item.patient?.id && onOpenPatient(item.patient.id)}><strong>{item.patient?.full_name || "—"}</strong><small>{formatDate(item.follow_up_at)} · {item.summary}</small></button><button className="done-button" onClick={() => markDone(item.id)} aria-label="إكمال المتابعة"><Check size={17} /></button></article>)}</div> : <EmptyLine text="لا توجد متابعات متأخرة أو مستحقة." />}</section>
        <section className="dashboard-panel alerts-panel"><header><div><h3><AlertCircle size={19} />تنبيهات تحتاج انتباه</h3><span>{summary.alerts.length}</span></div></header>{summary.alerts.length ? <div className="alert-list">{summary.alerts.map((item) => <button key={item.key} onClick={() => item.patientId && onOpenPatient(item.patientId)}><AlertCircle size={17} /><span><strong>{item.title}</strong><small>{item.meta}</small></span></button>)}</div> : <EmptyLine text="لا توجد تنبيهات حاليًا." />}</section>
      </div>
    </>}
  </section>;
}

function Metric({ icon: Icon, label, value, note, warning = false }) { return <article className={warning ? "dashboard-metric warning" : "dashboard-metric"}><span><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>; }
function EmptyLine({ text }) { return <p className="empty-line">{text}</p>; }
