import { useEffect, useState } from "react";
import { BarChart3, BellRing, Boxes, CalendarDays, CalendarPlus, ChartNoAxesCombined, CircleDollarSign, ContactRound, Gauge, Menu, MessageCircleMore, Package, Settings, Sparkles, UsersRound, X } from "lucide-react";
import { clinicConfig } from "../config/clinic";
import { loadBookingOptions } from "../lib/clinic-data";
import { requireSupabase } from "../lib/supabase";
import { QuickBookingModal } from "./QuickBookingModal";
import { AppointmentsPage } from "./AppointmentsPage";
import { GlobalSearch } from "./GlobalSearch";
import { PatientsPage } from "./PatientsPage";
import { loadPatientDirectory } from "../lib/patients";
import { DashboardPage } from "./DashboardPage";
import { ActivitiesPage } from "./ActivitiesPage";
import { SessionsPage } from "./SessionsPage";
import { PackagesPage } from "./PackagesPage";
import { FinancePage } from "./FinancePage";
import { InventoryPage } from "./InventoryPage";
import { ServicesPage } from "./ServicesPage";
import { ReportsPage } from "./ReportsPage";
import { NotificationsPage } from "./NotificationsPage";
import { SettingsPage } from "./SettingsPage";

const navigation = [
  ["dashboard", "الرئيسية", Gauge],
  ["patients", "المرضى", UsersRound],
  ["activities", "التواصل والمتابعات", ContactRound],
  ["notifications", "واتساب والتنبيهات", BellRing],
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
  const [patientDirectory, setPatientDirectory] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [bookingPatientId, setBookingPatientId] = useState("");
  const [services, setServices] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [appointmentRefreshKey, setAppointmentRefreshKey] = useState(0);

  async function refreshOptions() {
    try {
      const [data, directory] = await Promise.all([loadBookingOptions(), loadPatientDirectory()]);
      setPatients(data.patients);
      setPatientDirectory(directory);
      setServices(data.services);
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "تعذر تحميل بيانات الحجز");
    }
  }

  useEffect(() => { refreshOptions(); }, []);

  function openBooking(patientId = "") {
    setBookingPatientId(patientId || "");
    setBookingOpen(true);
  }

  function openPatient(patientId) {
    setSelectedPatientId(patientId);
    setActive("patients");
    setMenuOpen(false);
  }

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
        <nav>{navigation.map(([key, label, Icon], index) => <div key={key}>{[0, 7, 10].includes(index) && <small>{index === 0 ? "التشغيل اليومي" : index === 7 ? "الإدارة" : "التحليل والنظام"}</small>}<button className={active === key ? "active" : ""} onClick={() => { setActive(key); if (key === "patients") setSelectedPatientId(null); setMenuOpen(false); }}><Icon size={19} />{label}</button></div>)}</nav>
        <footer><div className="user-card"><span>{(user.user_metadata?.display_name || "A").slice(0, 1)}</span><div><strong>{user.user_metadata?.display_name || "Admin"}</strong><small>مديرة النظام</small></div></div><button onClick={logout}>تسجيل الخروج</button></footer>
      </aside>

      <div className="workspace">
        <header className="topbar"><div className="topbar-title"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة"><Menu size={21} /></button><div><small>أهلًا وسهلًا بكم في {clinicConfig.name}</small><h1>{title}</h1></div></div><GlobalSearch patients={patientDirectory} onSelect={openPatient} /><div className="topbar-actions"><button className="primary-button" onClick={() => openBooking()}><CalendarPlus size={17} />حجز سريع</button><button className="secondary-button" onClick={() => setActive("notifications")}><MessageCircleMore size={17} />تواصل</button><span className="connection-state">● النظام متصل وآمن</span></div></header>
        <main className="page-content">
          {loadError && <div className="error-box">{loadError}</div>}
          {active === "dashboard" && <DashboardPage patientDirectory={patientDirectory} refreshKey={appointmentRefreshKey} onBook={openBooking} onOpenAppointments={() => setActive("appointments")} onOpenPatient={openPatient} />}
          {active === "patients" && <PatientsPage patients={patientDirectory} selectedPatientId={selectedPatientId} onSelect={setSelectedPatientId} onBook={openBooking} onChanged={refreshOptions} />}
          {active === "activities" && <ActivitiesPage patients={patients} refreshKey={appointmentRefreshKey} onOpenPatient={openPatient} onChanged={() => setAppointmentRefreshKey((value) => value + 1)} />}
          {active === "appointments" && <AppointmentsPage services={services} onBook={() => openBooking()} refreshKey={appointmentRefreshKey} onChanged={() => setAppointmentRefreshKey((value) => value + 1)} />}
          {active === "sessions" && <SessionsPage patients={patients} services={services} refreshKey={appointmentRefreshKey} onOpenPatient={openPatient} onChanged={() => { refreshOptions(); setAppointmentRefreshKey((value) => value + 1); }} />}
          {active === "packages" && <PackagesPage patients={patients} services={services} refreshKey={appointmentRefreshKey} onOpenPatient={openPatient} onChanged={() => { refreshOptions(); setAppointmentRefreshKey((value) => value + 1); }} />}
          {active === "finance" && <FinancePage patients={patients} patientDirectory={patientDirectory} refreshKey={appointmentRefreshKey} onOpenPatient={openPatient} onChanged={() => { refreshOptions(); setAppointmentRefreshKey((value) => value + 1); }} />}
          {active === "inventory" && <InventoryPage refreshKey={appointmentRefreshKey} onChanged={() => setAppointmentRefreshKey((value) => value + 1)} />}
          {active === "services" && <ServicesPage refreshKey={appointmentRefreshKey} onChanged={() => { refreshOptions(); setAppointmentRefreshKey((value) => value + 1); }} />}
          {active === "reports" && <ReportsPage patientDirectory={patientDirectory} refreshKey={appointmentRefreshKey} />}
          {active === "notifications" && <NotificationsPage patients={patients} refreshKey={appointmentRefreshKey} onOpenPatient={openPatient} />}
          {active === "settings" && <SettingsPage user={user} onChanged={refreshOptions} />}
          {!['dashboard', 'patients', 'activities', 'notifications', 'appointments', 'sessions', 'packages', 'finance', 'inventory', 'services', 'reports', 'settings'].includes(active) && <ReconstructionCheckpoint title={title} onBook={() => openBooking()} />}
        </main>
      </div>

      <QuickBookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} patients={patients} services={services} initialPatientId={bookingPatientId} onSaved={() => { refreshOptions(); setAppointmentRefreshKey((value) => value + 1); }} />
    </div>
  );
}

function ReconstructionCheckpoint({ title, onBook }) {
  return <section className="empty-checkpoint"><CalendarDays size={42} /><h2>{title}</h2><p>هذه الشاشة موجودة في Production وسيتم نقلها إلى Source تدريجيًا قبل السماح بالنشر.</p><button className="primary-button" onClick={onBook}>فتح الحجز السريع</button></section>;
}
