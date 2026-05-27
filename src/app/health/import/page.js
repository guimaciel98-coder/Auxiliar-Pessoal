"use client";
import { useState, useRef } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import Link from "next/link";

const WORKOUT_TYPES = {
  HKWorkoutActivityTypeRunning:                    "Corrida",
  HKWorkoutActivityTypeCycling:                    "Ciclismo",
  HKWorkoutActivityTypeWalking:                    "Caminhada",
  HKWorkoutActivityTypeTraditionalStrengthTraining:"Musculação",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "Funcional",
  HKWorkoutActivityTypeYoga:                       "Yoga",
  HKWorkoutActivityTypeSwimming:                   "Natação",
  HKWorkoutActivityTypeHighIntensityIntervalTraining:"HIIT",
  HKWorkoutActivityTypeElliptical:                 "Elíptico",
  HKWorkoutActivityTypeCrossTraining:              "Cross Training",
  HKWorkoutActivityTypeOther:                      "Outro",
};

function dateBR(isoDate) {
  // "2024-01-15" → "15/01/2024"
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function parseXML(text) {
  const stepsByDay    = {};
  const caloriesByDay = {};
  const distByDay     = {};
  const hrByDay       = {};  // { day: [values] }
  const sleepByDay    = {};  // minutes
  const workouts      = [];

  // ── Records ──────────────────────────────────────────────────────────────
  const recRegex = /<Record\s([^/>]*?)(?:\/?>)/g;
  let m;
  while ((m = recRegex.exec(text)) !== null) {
    const attrs = m[1];
    const get   = (k) => { const r = new RegExp(`${k}="([^"]*?)"`); const x = r.exec(attrs); return x ? x[1] : ""; };

    const type  = get("type");
    const val   = parseFloat(get("value")) || 0;
    const start = get("startDate").slice(0, 10); // "YYYY-MM-DD"
    const end   = get("endDate").slice(0, 10);

    if (type === "HKQuantityTypeIdentifierStepCount") {
      stepsByDay[start] = (stepsByDay[start] || 0) + val;
    } else if (type === "HKQuantityTypeIdentifierActiveEnergyBurned") {
      caloriesByDay[start] = (caloriesByDay[start] || 0) + val;
    } else if (type === "HKQuantityTypeIdentifierDistanceWalkingRunning") {
      distByDay[start] = (distByDay[start] || 0) + val;
    } else if (type === "HKQuantityTypeIdentifierHeartRate") {
      if (!hrByDay[start]) hrByDay[start] = [];
      hrByDay[start].push(val);
    } else if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
      const v = get("value");
      if (v.includes("Asleep") || v.includes("InBed")) {
        const sMs = new Date(get("startDate")).getTime();
        const eMs = new Date(get("endDate")).getTime();
        const mins = (eMs - sMs) / 60000;
        if (mins > 0 && mins < 720) {
          sleepByDay[end] = (sleepByDay[end] || 0) + mins;
        }
      }
    }
  }

  // ── Workouts ──────────────────────────────────────────────────────────────
  const wkRegex = /<Workout\s([^>]*?)>/g;
  while ((m = wkRegex.exec(text)) !== null) {
    const attrs = m[1];
    const get   = (k) => { const r = new RegExp(`${k}="([^"]*?)"`); const x = r.exec(attrs); return x ? x[1] : ""; };

    const wType = get("workoutActivityType");
    const dur   = parseFloat(get("duration")) || 0;
    const dist  = parseFloat(get("totalDistance")) || 0;
    const cal   = parseFloat(get("totalEnergyBurned")) || 0;
    const start = get("startDate").slice(0, 10);
    if (!wType || !start || dur < 1) continue;

    workouts.push({
      date:         dateBR(start),
      tipo:         WORKOUT_TYPES[wType] || wType.replace("HKWorkoutActivityType", ""),
      duracao_min:  Math.round(dur),
      calorias:     Math.round(cal),
      distancia_km: Math.round(dist * 10) / 10,
    });
  }

  // ── Consolida métricas por dia ─────────────────────────────────────────────
  const allDays = new Set([
    ...Object.keys(stepsByDay),
    ...Object.keys(caloriesByDay),
    ...Object.keys(sleepByDay),
  ]);

  const days = Array.from(allDays)
    .filter(d => d && d.length === 10)
    .sort()
    .map(day => ({
      date:        dateBR(day),
      steps:       Math.round(stepsByDay[day] || 0) || null,
      calories:    Math.round(caloriesByDay[day] || 0) || null,
      distance_km: distByDay[day] ? Math.round(distByDay[day] * 10) / 10 : null,
      bpm_avg:     hrByDay[day]?.length
        ? Math.round(hrByDay[day].reduce((a, b) => a + b, 0) / hrByDay[day].length)
        : null,
      sleep_h: sleepByDay[day] ? Math.round((sleepByDay[day] / 60) * 10) / 10 : null,
    }));

  return { days, workouts };
}

export default function ImportPage() {
  const [status,   setStatus]   = useState("idle"); // idle | parsing | preview | importing | done | error
  const [preview,  setPreview]  = useState(null);
  const [progress, setProgress] = useState("");
  const [result,   setResult]   = useState(null);
  const inputRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    setProgress("Lendo arquivo...");

    const reader = new FileReader();
    reader.onload = (ev) => {
      setProgress("Analisando dados de saúde...");
      setTimeout(() => {
        try {
          const text    = ev.target.result;
          const parsed  = parseXML(text);
          setPreview(parsed);
          setStatus("preview");
        } catch (err) {
          setStatus("error");
          setProgress("Erro ao ler o arquivo: " + err.message);
        }
      }, 50);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!preview) return;
    setStatus("importing");
    setProgress("Enviando para a planilha...");

    try {
      const res  = await fetch("/api/health/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(preview),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setResult(json);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setProgress("Erro ao importar: " + err.message);
    }
  }

  return (
    <div style={{ marginLeft: 220, minHeight: "100vh" }}>
      <ModuleHeader title="Saúde" />
      <Navigation />

      <div style={{ padding: "24px 28px 80px" }}>
        <Link href="/health" style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
          ← Voltar
        </Link>

        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Importar Histórico</h1>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, marginBottom: 32 }}>
          Importe seu histórico completo do Apple Health — passos, sono, frequência cardíaca e treinos.
        </p>

        {/* ── Como exportar ── */}
        {status === "idle" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "24px", marginBottom: 28, maxWidth: 540 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
              Como exportar do iPhone
            </p>
            {[
              "Abra o app Saúde no iPhone",
              "Toque na sua foto (canto superior direito)",
              'Toque em "Export All Health Data"',
              "Confirme e aguarde o arquivo ZIP ser gerado",
              "Extraia o ZIP → dentro tem o arquivo export.xml",
              "Selecione o export.xml aqui abaixo",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Upload ── */}
        {(status === "idle" || status === "error") && (
          <div>
            <input ref={inputRef} type="file" accept=".xml" onChange={handleFile} style={{ display: "none" }} />
            <button
              onClick={() => inputRef.current?.click()}
              style={{ padding: "14px 28px", borderRadius: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              Selecionar export.xml
            </button>
            {status === "error" && (
              <p style={{ marginTop: 12, color: "#ef4444", fontSize: 13 }}>{progress}</p>
            )}
          </div>
        )}

        {/* ── Parsing ── */}
        {status === "parsing" && (
          <div style={{ padding: "32px 0" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{progress}</p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 8 }}>Arquivos grandes podem demorar alguns segundos...</p>
          </div>
        )}

        {/* ── Preview ── */}
        {status === "preview" && preview && (
          <div style={{ maxWidth: 540 }}>
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Encontrado no arquivo
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { icon: "📅", label: "Dias com dados", value: preview.days.length },
                  { icon: "🏋️", label: "Treinos",        value: preview.workouts.length },
                  { icon: "👟", label: "Dias com passos",value: preview.days.filter(d => d.steps).length },
                  { icon: "🌙", label: "Dias com sono",  value: preview.days.filter(d => d.sleep_h).length },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => { setStatus("idle"); setPreview(null); }}
                style={{ padding: "12px 20px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                style={{ flex: 1, padding: "12px 20px", borderRadius: 10, background: "linear-gradient(135deg,#10b981,#059669)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Importar {preview.days.length} dias + {preview.workouts.length} treinos
              </button>
            </div>
          </div>
        )}

        {/* ── Importing ── */}
        {status === "importing" && (
          <div style={{ padding: "32px 0" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>📤</div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{progress}</p>
          </div>
        )}

        {/* ── Done ── */}
        {status === "done" && result && (
          <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: "28px 24px", maxWidth: 400 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginBottom: 8 }}>Importado com sucesso!</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
              {result.days_written} dias de métricas e {result.workouts_written} treinos salvos na planilha.
            </p>
            <Link href="/health" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 10, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              Ver Saúde →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
