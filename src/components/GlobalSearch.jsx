import { Search, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("ar-JO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
}

export function GlobalSearch({ patients, onSelect }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (normalized.length < 2) return [];
    return patients.filter((patient) => [patient.full_name, patient.phone, patient.file_no, patient.national_id]
      .some((value) => String(value || "").toLowerCase().includes(normalized))).slice(0, 8);
  }, [patients, normalized]);

  function select(patient) {
    onSelect(patient.id);
    setQuery("");
  }

  return (
    <div className="global-search">
      <Search size={18} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث شامل: اسم، هاتف، رقم ملف..." aria-label="البحث عن مريضة" />
      {query && <button onClick={() => setQuery("")} aria-label="مسح البحث"><X size={16} /></button>}
      {normalized.length >= 2 && <div className="search-results">
        {results.length ? results.map((patient) => <button key={patient.id} onClick={() => select(patient)}>
          <span className="search-avatar"><UserRound size={17} /></span>
          <span><strong>{patient.full_name}</strong><small>ملف #{patient.file_no} · {patient.phone}</small></span>
          <span className="search-dates"><small>آخر زيارة: {formatDate(patient.last_visit)}</small><small>القادم: {formatDate(patient.next_appointment)}</small></span>
        </button>) : <p>لا توجد نتائج مطابقة.</p>}
      </div>}
    </div>
  );
}
