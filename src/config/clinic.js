export const clinicConfig = Object.freeze({
  name: import.meta.env.VITE_CLINIC_NAME || "Casanova Laser Clinic",
  brand: import.meta.env.VITE_CLINIC_BRAND || "CASANOVA",
  subtitle: import.meta.env.VITE_CLINIC_SUBTITLE || "Beauty Center · Laser Clinic",
  phone: import.meta.env.VITE_CLINIC_PHONE || "",
  whatsapp: import.meta.env.VITE_CLINIC_WHATSAPP || "",
  currency: import.meta.env.VITE_CLINIC_CURRENCY || "JOD",
  timezone: import.meta.env.VITE_CLINIC_TIMEZONE || "Asia/Amman",
  logo: import.meta.env.VITE_CLINIC_LOGO || "/casanova-logo.webp",
  mark: import.meta.env.VITE_CLINIC_MARK || "/casanova-mark.webp",
});

export const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || "";
