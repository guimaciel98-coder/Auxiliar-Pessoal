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
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function parseXML(text) {
  const stepsByDay = {}, caloriesByDay = {}, distByDay = {}, hrByDay = {}, sleepByDay = {};
  const workouts = [];
  const recRegex = /<Record\s([^/>]*?)(?:\/?>)/g;
  let m;
  while ((m = recRegex.exec(text)) !== null) {
    const attrs = m[1];
    const get = (k) => { const r = new RegExp(`${k}="([^"]*?)"`); const x = r.exec(attrs); return x ? x[1] : ""; };
    const type = get("type"), val = parseFloat(get("value")) || 0;
    const start = get("startDate").slice(0, 10), end = get("endDate").slice(0, 10);
    if (type === "HKQuantityTypeIdentifierStepCount")              stepsByDay[start]    = (stepsByDay[start] || 0) + val;
    else if (type === "HKQuantityTypeIdentifierActiveEnergyBurned") caloriesByDay[start] = (caloriesByDay[start] || 0) + val;
    else if (type === "HKQuantityTypeIdentifierDistanceWalkingRunning") distByDay[start] = (distByDay[start] || 0) + val;
    else if (type === "HKQuantityTypeIdentifierHeartRate") { if (!hrByDay[start]) hrByDay[start] = []; hrByDay[start].push(val); }
    else if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
      const v = get("value");
      if (v.includes("Asleep") || v.includes("InBed")) {
        const mins = (new Date(get("endDate")).getTime() - new Date(get("startDate")).getTime()) / 60000;
        if (mins > 0 && mins < 720) sleepByDay[end] = (sleepByDay[end] || 0) + mins;
      }
    }
  }
  const wkRegex = /<Workout\s([^>]*?)>/g;
  while ((m = wkRegex.exec(text)) !== null) {
    const attrs = m[1];
    const get = (k) => { const r = new RegExp(`${k}="([^"]*?)"`); const x = r.exec(attrs); return x ? x[1] : ""; };
    const wType = get("workoutActivityType"), dur = parseFloat(get("duration")) || 0;
    const start = get("startDate").slice(0, 10);
    if (!wType || !start || dur < 1) continue;
    workouts.push({ date: dateBR(start), tipo: WORKOUT_TYPES[wType] || wType.replace("HKWorkoutActivityType", ""), duracao_min: Math.round(dur), calorias: Math.round(parseFloat(get("totalEnergyBurned")) || 0), distancia_km: Math.round((parseFloat(get("totalDistance")) || 0) * 10) / 10 });
  }
  const allDays = new Set([...Object.keys(stepsByDay), ...Object.keys(caloriesByDay), ...Object.keys(sleepByDay)]);
  const days = Array.from(allDays).filter(d => d && d.length === 10).sort().map(day => ({
    date: dateBR(day),
    steps: Math.round(stepsByDay[day] || 0) || null,
    calories: Math.round(caloriesByDay[day] || 0) || null,
    distance_km: distByDay[day] ? Math.round(distByDay[day] * 10) / 10 : null,
    bpm_avg: hrByDay[day]?.length ? Math.round(hrByDay[day].reduce((a, b) => a + b, 0) / hrByDay[day].length) : null,
    sleep_h: sleepByDay[day] ? Math.round((sleepByDay[day] / 60) * 10) / 10 : null,
  }));
  return { days, workouts };
}

export default function ImportPage() {
  const [status,   setStatus]   = useState("idle");
  const [preview,  setPreview]  = useState(null);
  const [progress, setProgress] = useState("");
  const [result,   setResult]   = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  function processFile(file) {
    if (!file) return;
    setStatus("parsing");
    setProgress("Analisando dados...");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTimeout(() => {
        try {
          setPreview(parseXML(ev.target.result));
          setStatus("preview");
        } catch (err) {
          setStatus("error");
          setProgress("Erro ao ler o arquivo: " + err.message);
        }
      }, 50);
    };
    reader.readAsText(file);
  }

  function handleFile(e) { processFile(e.target.files?.[0]); }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  }

  async function handleImport() {
    if (!preview) return;
    setStatus("importing");
    try {
      const res  = await fetch("/api/health/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preview) });
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
    <div style={{ marginLeft: 220, minHeight: "100vh", background: "var(--bg-primary, #0a0d14)" }}>
      <ModuleHeader title="Saúde" />
      <Navigation />

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/health" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontWeight: 600, marginBottom: 20, letterSpacing: "0.04em" }}>
            ← SAÚDE
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Importar Histórico
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5 }}>
            Importe seu histórico do Apple Health — passos, sono, BPM e treinos.
          </p>
        </div>

        {/* ── IDLE: Upload zone + guia ── */}
        {(status === "idle" || status === "error") && (
          <>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 20,
                padding: "44px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: dragging ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
                transition: "all 0.2s",
                marginBottom: 24,
              }}
            >
              <input ref={inputRef} type="file" accept=".xml" onChange={handleFile} style={{ display: "none" }} />
              <div style={{ fontSize: 40, marginBottom: 14 }}>🫀</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", margin: "0 0 6px" }}>
                {dragging ? "Solte aqui" : "Selecionar export.xml"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                Arraste o arquivo ou clique para selecionar
              </p>
              {status === "error" && (
                <p style={{ marginTop: 14, color: "#ef4444", fontSize: 12, background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "8px 12px", display: "inline-block" }}>
                  {progress}
                </p>
              )}
            </div>

            {/* Guia de exportação */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", margin: "0 0 16px" }}>
                Como exportar do iPhone
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["📱", "Abra o app Saúde no iPhone"],
                  ["👤", "Toque na sua foto (canto superior direito)"],
                  ["📤", 'Toque em "Export All Health Data"'],
                  ["⏳", "Aguarde o arquivo ZIP ser gerado"],
                  ["📂", "Extraia o ZIP → selecione o export.xml aqui"],
                ].map(([icon, text], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                      {icon}
                    </div>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── PARSING ── */}
        {status === "parsing" && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 16, animation: "pulse 1.5s infinite" }}>⏳</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>Processando arquivo...</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Arquivos grandes podem demorar alguns segundos</p>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {status === "preview" && preview && (
          <div>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { icon: "📅", label: "Dias com dados",  value: preview.days.length,                          color: "#6366f1" },
                { icon: "🏋️", label: "Treinos",         value: preview.workouts.length,                      color: "#8b5cf6" },
                { icon: "👟", label: "Dias com passos", value: preview.days.filter(d => d.steps).length,     color: "#10b981" },
                { icon: "🌙", label: "Dias com sono",   value: preview.days.filter(d => d.sleep_h).length,   color: "#6366f1" },
                { icon: "🔥", label: "Dias com calorias",value: preview.days.filter(d => d.calories).length, color: "#f59e0b" },
                { icon: "💓", label: "Dias com BPM",    value: preview.days.filter(d => d.bpm_avg).length,   color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", lineHeight: 1 }}>{s.value.toLocaleString("pt-BR")}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Período */}
            {preview.days.length > 0 && (
              <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Período</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>
                  {preview.days[0].date} → {preview.days[preview.days.length - 1].date}
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setStatus("idle"); setPreview(null); }}
                style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button onClick={handleImport}
                style={{ flex: 1, padding: "12px 20px", borderRadius: 12, background: "linear-gradient(135deg,#10b981,#059669)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Importar {preview.days.length} dias + {preview.workouts.length} treinos →
              </button>
            </div>
          </div>
        )}

        {/* ── IMPORTING ── */}
        {status === "importing" && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>📤</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>Enviando para a planilha...</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Pode levar alguns segundos</p>
            <div style={{ width: 200, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, margin: "24px auto 0", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg,#10b981,#6366f1)", borderRadius: 99, animation: "shimmer 1.5s infinite" }} />
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {status === "done" && result && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "#10b981", marginBottom: 8 }}>Importação concluída!</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, margin: "20px 0 28px" }}>
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "14px 22px", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#10b981" }}>{result.days_written}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>dias salvos</div>
              </div>
              <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 12, padding: "14px 22px", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#8b5cf6" }}>{result.workouts_written}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>treinos salvos</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { setStatus("idle"); setPreview(null); setResult(null); }}
                style={{ padding: "11px 20px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Importar outro
              </button>
              <Link href="/health"
                style={{ padding: "11px 24px", borderRadius: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
                Ver Saúde →
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
