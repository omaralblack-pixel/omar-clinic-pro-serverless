import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./components/LoginPage";
import { adminEmail } from "./config/clinic";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    supabase.auth.getUser().then(async ({ data }) => {
      const authorizedUser = data.user?.email?.toLowerCase() === adminEmail.toLowerCase() ? data.user : null;
      if (data.user && !authorizedUser) await supabase.auth.signOut();
      setUser(authorizedUser);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const authorizedUser = session?.user?.email?.toLowerCase() === adminEmail.toLowerCase() ? session.user : null;
      setUser(authorizedUser);
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="loading-screen">جاري تحميل النظام...</div>;
  return user ? <AppShell user={user} onLogout={() => setUser(null)} /> : <LoginPage onLogin={setUser} />;
}
