import { useEffect, useState } from "react";
import { BarChart3, Boxes, CalendarDays, CalendarPlus, ChartNoAxesCombined, CircleDollarSign, ContactRound, Gauge, Menu, MessageCircleMore, Package, Settings, Sparkles, UsersRound, X } from "lucide-react";
import { clinicConfig } from "../config/clinic";
import { loadBookingOptions } from "../lib/clinic-data";
import { requireSupabase } from "../lib/supabase";
import { QuickBookingModal } from "./QuickBookingModal";
import { AppointmentsPage } from "./AppointmentsPage";

const navigation = [
  ["dashboard", "الرئيسية", Gauge],
  ["patients", "المرضى", UsersRound],
  ["activities", "التواصل والمتابعات", ContactRound],
  ["appointments", "المواعيد", CalendarDays],
  ["sessions", "جلسات الليزر", Sparkles],
  ["packages", "الباقات", Package],
  ["finance", "الحسابات", CircleDollarSign],
  ["inventory", "المخزون", Boxes],
  ["services", "الخدمات والأسعار", BarChart3],
  ["reports", "التقارير", ChartNoAxesCombined],
  ["settings", "الإعدادات", Settings],
];

export function AppShell({ user, onLogout }) {
  const [active, setActive] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [appointmentRefreshKey, setAppointmentRefreshKey] = useState(0);

  async function refreshOptions() {
    try {
      const data = await loadBookingOptions();
      setPatients(data.patients);
      setServices(data.services);
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "تعذر تحميل بيانات الحجز");
    }
  }

  useEffect(() => { refreshOptions(); }, []);

  async function logout() {
    await requireSupabase().auth.signOut();
    onLogout();
  }

  const title = navigation.find(([key]) => key === active)?.[1];

  return (
    <div className="app-shell" dir="rtl">
      {menuOpen && <button className="mobile-overlay" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة" />}
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <header className="sidebar-brand"><img src={clinicConfig.mark} alt="" /><div><strong>{clinicConfig.brand}</strong><span>Beauty Center</span></div><button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button></header>
        <nav>{navigation.map(([key, label, Icon], index) => <div key={key}>{[0, 6, 9].includes(index) && <small>{index === 0 ? "التشغيل اليومي" : index === 6 ? "الإدارة" : "التحليل والنظام"}</small>}<button className={active === key ? "active" : ""} onClick={() => { setActive(key); setMenuOpen(false); }}><Icon size={19} />{label}</button></div>)}</nav>
        <footer><div className="user-card"><span>{(user.user_metadata?.display_name || "A").slice(0, 1)}</span><div><strong>{user.user_metadata?.display_name || "Admin"}</strong><small>مديرة النظام</small></div></div><button onClick={logout}>تسجيل الخروج</button></footer>
      </aside>

      <div className="workspace">
        <header className="topbar"><div className="topbar-title"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة"><Menu size={21} /></button><div><small>أهلًا وسهلًا بكم في {clinicConfig.name}</small><h1>{title}</h1></div></div><div className="topbar-actions"><button className="primary-button" onClick={() => setBookingOpen(true)}><CalendarPlus size={17} />حجز سريع</button><button className="secondary-button"><MessageCircleMore size={17} />تواصل</button><span className="connection-state">● النظام متصل وآمن</span></div></header>
        <main className="page-content">
          {loadError && <div className="error-box">{loadError}</div>}
          {active === "dashboard" && <DashboardCheckpoint patients={patients} services={services} onBook={() => setBookingOpen(true)} />}
          {active === "appointments" && <AppointmentsPage services={services} onBook={() => setBookingOpen(true)} refreshKey={appointmentRefreshKey} onChanged={() => setAppointmentRefreshKey((value) => value + 1)} />}
          {active !== "dashboard" && active !== "appointments" && <ReconstructionCheckpoint title={title} onBook={() => setBookingOpen(true)} />}
        </main>
      </div>

      <QuickBookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} patients={patients} services={services} onSaved={() => { refreshOptions(); setAppointmentRefreshKey((value) => value + 1); }} />
    </div>
  );
}

function DashboardCheckpoint({ patients, services, onBook }) {
  return <div className="dashboard-checkpoint"><section className="welcome-card"><div><small>نسخة المصدر الجديدة</small><h2>استعادة آمنة وقابلة للتطوير</h2><p>تم ربط تسجيل الدخول وخيارات المرضى والخدمات، وتجهيز الحجز السريع الجديد بدون تغيير نسخة Production الحالية.</p></div><button className="primary-button" onClick={onBook}><CalendarPlus size={18} />إنشاء موعد</button></section><div className="metric-grid"><article><span>ملفات المرضى المحملة</span><strong>{patients.length}</strong></article><article><span>الخدمات المتاحة</span><strong>{services.length}</strong></article><article><span>Quick Booking</span><strong className="ready">جاهز</strong></article><article><span>Production</span><strong className="safe">لم يتغير</strong></article></div></div>;
}

function ReconstructionCheckpoint({ title, onBook }) {
  return <section className="empty-checkpoint"><CalendarDays size={42} /><h2>{title}</h2><p>هذه الشاشة موجودة في Production وسيتم نقلها إلى Source تدريجيًا قبل السماح بالنشر.</p><button className="primary-button" onClick={onBook}>فتح الحجز السريع</button></section>;
}
