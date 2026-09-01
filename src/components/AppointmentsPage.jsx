import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, TriangleAlert, X } from "lucide-react";
import { appointmentStatuses, findAppointmentConflicts, loadAppointmentsRange, updateAppointment } from "../lib/appointments";

const statusClass = {
  scheduled: "scheduled",
  confirmed: "confirmed",
  arrived: "arrived",
  in_progress: "in-progress",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no-show",
  delayed: "delayed",
};

const statusLabels = Object.fromEntries(appointmentStatuses);

function dateKey(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - ((day + 6) % 7));
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function rangeFor(view, anchor) {
  const from = view === "day" ? new Date(anchor) : startOfWeek(anchor);
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, view === "day" ? 1 : 7);
  return { from: from.toISOString(), to: to.toISOString(), days: Array.from({ length: view === "day" ? 1 : 7 }, (_, index) => addDays(from, index)) };
}

function toDateTimeLocal(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function AppointmentsPage({ services, onBook, refreshKey, onChanged }) {
  const [view, setView] = useState("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [appointments, setAppointments] = useState([]);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadAppointmentsRange(range)
      .then((rows) => { if (active) { setAppointments(rows); setError(""); } })
      .catch((loadError) => { if (active) setError(loadError?.message || "تعذر تحميل المواعيد"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range.from, range.to, refreshKey]);

  const filtered = useMemo(() => appointments.filter((appointment) => {
    const serviceMatches = serviceFilter === "all" || appointment.service_id === serviceFilter;
    const statusMatches = statusFilter === "all" || appointment.status === statusFilter;
    return serviceMatches && statusMatches;
  }), [appointments, serviceFilter, statusFilter]);

  function movePeriod(direction) {
    setAnchor((current) => addDays(current, direction * (view === "day" ? 1 : 7)));
  }

  async function moveAppointment(appointment, day, hour) {
    const nextStart = new Date(day);
    nextStart.setHours(hour, 0, 0, 0);
    const conflicts = await findAppointmentConflicts({
      startsAt: nextStart.toISOString(),
      durationMinutes: appointment.duration_minutes,
      excludeAppointmentId: appointment.id,
    });

    if (conflicts.length) {
      setError(`لا يمكن نقل الموعد إلى ${hour}:00 لوجود تعارض. افتحي الموعد للمراجعة.`);
      return;
    }

    const updated = await updateAppointment(appointment.id, { starts_at: nextStart.toISOString() });
    setAppointments((rows) => rows.map((row) => row.id === updated.id ? updated : row));
    setError("");
    onChanged?.();
  }

  const title = view === "day"
    ? new Intl.DateTimeFormat("ar-JO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(anchor)
    : `${new Intl.DateTimeFormat("ar-JO", { day: "numeric", month: "short" }).format(range.days[0])} — ${new Intl.DateTimeFormat("ar-JO", { day: "numeric", month: "short", year: "numeric" }).format(range.days[6])}`;

  return (
    <section className="appointments-page">
      <header className="page-heading">
        <div><small>إدارة وقت العيادة</small><h2><CalendarDays size={25} />المواعيد</h2><p>عرض يومي وأسبوعي مع الحالات والتعارضات والتعديل السريع.</p></div>
        <button className="primary-button" onClick={onBook}><Plus size={18} />موعد جديد</button>
      </header>

      <div className="calendar-toolbar">
        <div className="period-controls"><button className="icon-button" onClick={() => movePeriod(-1)}><ChevronRight size={19} /></button><button className="today-button" onClick={() => setAnchor(new Date())}>اليوم</button><button className="icon-button" onClick={() => movePeriod(1)}><ChevronLeft size={19} /></button><strong>{title}</strong></div>
        <div className="view-switch"><button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>يومي</button><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>أسبوعي</button></div>
      </div>

      <div className="calendar-filters">
        <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option value="all">كل الخدمات</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">كل الحالات</option>{appointmentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <span>{filtered.length} موعد</span>
      </div>

      {error && <div className="error-box"><TriangleAlert size={18} />{error}</div>}
      {loading ? <div className="calendar-loading">جاري تحميل المواعيد...</div> : (
        <CalendarGrid days={range.days} appointments={filtered} onEdit={setSelected} onMove={(appointment, day, hour) => moveAppointment(appointment, day, hour).catch((moveError) => setError(moveError.message))} />
      )}

      {selected && <AppointmentEditor appointment={selected} services={services} onClose={() => setSelected(null)} onSaved={(updated) => { setAppointments((rows) => rows.map((row) => row.id === updated.id ? updated : row)); setSelected(null); onChanged?.(); }} />}
    </section>
  );
}

function CalendarGrid({ days, appointments, onEdit, onMove }) {
  const hours = Array.from({ length: 13 }, (_, index) => index + 8);
  return (
    <div className="calendar-scroll">
      <div className="calendar-grid" style={{ "--calendar-days": days.length }}>
        <div className="calendar-corner" />
        {days.map((day) => <div className="calendar-day-head" key={dateKey(day)}><strong>{new Intl.DateTimeFormat("ar-JO", { weekday: "short" }).format(day)}</strong><span>{new Intl.DateTimeFormat("ar-JO", { day: "numeric", month: "numeric" }).format(day)}</span></div>)}
        {hours.map((hour) => [<div className="calendar-hour" key={`hour-${hour}`}><Clock3 size={13} />{String(hour).padStart(2, "0")}:00</div>, ...days.map((day) => {
          const slotAppointments = appointments.filter((appointment) => {
            const startsAt = new Date(appointment.starts_at);
            return dateKey(startsAt) === dateKey(day) && startsAt.getHours() === hour;
          });
          return <div className="calendar-slot" key={`${dateKey(day)}-${hour}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const appointment = appointments.find((item) => item.id === event.dataTransfer.getData("text/appointment-id")); if (appointment) onMove(appointment, day, hour); }}>{slotAppointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onEdit={onEdit} />)}</div>;
        })])}
      </div>
    </div>
  );
}

function AppointmentCard({ appointment, onEdit }) {
  const startsAt = new Date(appointment.starts_at);
  return <article className={`appointment-card ${statusClass[appointment.status] || ""}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/appointment-id", appointment.id)}><button onClick={() => onEdit(appointment)} aria-label="تعديل الموعد"><Pencil size={14} /></button><strong>{startsAt.toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" })} · {appointment.patient?.full_name || "—"}</strong><span>{appointment.service?.name || "موعد عام"} · {appointment.duration_minutes} دقيقة</span><footer><em>{statusLabels[appointment.status] || appointment.status}</em><b>{Number(appointment.price || 0).toFixed(2)} د.أ</b></footer></article>;
}

function AppointmentEditor({ appointment, services, onClose, onSaved }) {
  const [form, setForm] = useState({
    starts_at: toDateTimeLocal(appointment.starts_at),
    duration_minutes: String(appointment.duration_minutes),
    service_id: appointment.service_id || "",
    status: appointment.status,
    price: String(appointment.price || 0),
    paid: String(appointment.paid || 0),
    cancellation_reason: appointment.cancellation_reason || "",
    no_show_reason: appointment.no_show_reason || "",
    delay_minutes: String(appointment.delay_minutes || 0),
    status_note: appointment.status_note || "",
    notes: appointment.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (Number(form.paid || 0) > Number(form.price || 0)) throw new Error("المدفوع لا يمكن أن يتجاوز سعر الموعد");
      const startsAt = new Date(form.starts_at).toISOString();
      const conflicts = await findAppointmentConflicts({ startsAt, durationMinutes: Number(form.duration_minutes), excludeAppointmentId: appointment.id });
      if (conflicts.length) throw new Error("الوقت الجديد يتعارض مع موعد آخر");
      const updated = await updateAppointment(appointment.id, {
        starts_at: startsAt,
        duration_minutes: Number(form.duration_minutes),
        service_id: form.service_id || null,
        status: form.status,
        price: Number(form.price || 0),
        paid: Number(form.paid || 0),
        cancellation_reason: form.status === "cancelled" ? form.cancellation_reason.trim() || null : null,
        no_show_reason: form.status === "no_show" ? form.no_show_reason.trim() || null : null,
        delay_minutes: form.status === "delayed" ? Number(form.delay_minutes || 0) : 0,
        status_note: form.status_note.trim() || null,
        notes: form.notes.trim() || null,
      });
      onSaved(updated);
    } catch (saveError) {
      setError(saveError?.message || "تعذر تحديث الموعد");
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop"><section className="appointment-editor" role="dialog" aria-modal="true"><header><div><h2>تعديل الموعد</h2><p>{appointment.patient?.full_name} · #{appointment.patient?.file_no}</p></div><button className="icon-button" onClick={onClose}><X size={20} /></button></header><form onSubmit={save}><div className="form-grid"><div className="field"><label>التاريخ والوقت</label><input type="datetime-local" value={form.starts_at} onChange={(event) => update("starts_at", event.target.value)} required /></div><div className="field"><label>المدة</label><input type="number" min="5" value={form.duration_minutes} onChange={(event) => update("duration_minutes", event.target.value)} required /></div><div className="field"><label>الخدمة</label><select value={form.service_id} onChange={(event) => update("service_id", event.target.value)}><option value="">موعد عام</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div><div className="field"><label>الحالة</label><select value={form.status} onChange={(event) => update("status", event.target.value)}>{appointmentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label>السعر</label><input type="number" min="0" step=".01" value={form.price} onChange={(event) => update("price", event.target.value)} /></div><div className="field"><label>المدفوع</label><input type="number" min="0" step=".01" value={form.paid} onChange={(event) => update("paid", event.target.value)} /></div>{form.status === "cancelled" && <div className="field field-wide"><label>سبب الإلغاء</label><textarea value={form.cancellation_reason} onChange={(event) => update("cancellation_reason", event.target.value)} required /></div>}{form.status === "no_show" && <div className="field field-wide"><label>سبب عدم الحضور</label><textarea value={form.no_show_reason} onChange={(event) => update("no_show_reason", event.target.value)} /></div>}{form.status === "delayed" && <div className="field"><label>دقائق التأخير</label><input type="number" min="0" value={form.delay_minutes} onChange={(event) => update("delay_minutes", event.target.value)} /></div>}<div className="field field-wide"><label>ملاحظة الحالة</label><textarea value={form.status_note} onChange={(event) => update("status_note", event.target.value)} /></div><div className="field field-wide"><label>ملاحظات الموعد</label><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></div></div>{error && <div className="error-box">{error}</div>}<footer className="modal-actions"><button className="primary-button" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ التعديلات"}</button><button className="secondary-button" type="button" onClick={onClose}>إلغاء</button></footer></form></section></div>;
}
