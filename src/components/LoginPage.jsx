import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { adminEmail, clinicConfig } from "../config/clinic";
import { requireSupabase } from "../lib/supabase";

export function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (username.trim().toLowerCase() !== "admin") {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }

    if (!adminEmail) {
      setError("بريد الإدارة غير مضبوط في إعدادات النسخة");
      return;
    }

    setBusy(true);
    try {
      const client = requireSupabase();
      const { data, error: signInError } = await client.auth.signInWithPassword({ email: adminEmail, password });
      if (signInError || !data.user) throw signInError || new Error("تعذر تسجيل الدخول");
      onLogin(data.user);
    } catch {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page" dir="rtl">
      <section className="login-intro">
        <div className="brand-inline">
          <img src={clinicConfig.mark} alt="" />
          <div><strong>{clinicConfig.brand}</strong><span>{clinicConfig.subtitle}</span></div>
        </div>
        <h1>إدارة العيادة، المواعيد والحسابات من مكان واحد.</h1>
        <p>نظام خاص وآمن للعيادة، مصمم للعمل بسلاسة على الكمبيوتر والتابلت.</p>
        <div className="feature-grid">
          {["ملفات المرضى", "المواعيد والجلسات", "الحسابات والدفعات", "بيانات خاصة ومحمية"].map((item) => (
            <span key={item}><ShieldCheck size={18} />{item}</span>
          ))}
        </div>
      </section>

      <section className="login-card">
        <img className="login-logo" src={clinicConfig.logo} alt={clinicConfig.name} />
        <h2>تسجيل الدخول</h2>
        <p>أدخلي بيانات الإدارة للوصول إلى النظام</p>
        <form onSubmit={submit}>
          <label>اسم المستخدم<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" dir="ltr" required /></label>
          <label>كلمة المرور<span className="password-field"><input type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" dir="ltr" required /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {error && <div className="error-box" role="alert">{error}</div>}
          <button className="primary-button login-button" disabled={busy} type="submit"><LockKeyhole size={18} />{busy ? "جاري الدخول..." : "تسجيل الدخول"}</button>
        </form>
        <small>النظام مخصص للاستخدام الداخلي في العيادة فقط</small>
      </section>
    </main>
  );
}
