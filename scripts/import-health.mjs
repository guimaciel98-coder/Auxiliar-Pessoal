/**
 * import-health.mjs — processa export.xml do Apple Health e importa para o app
 * Execução: node scripts/import-health.mjs
 */

import { readFileSync } from "fs";

const XML_PATH  = "c:/Users/Guilherme/Downloads/health-export/apple_health_export/export.xml";
const API_URL   = "https://daily-app-standalone.vercel.app/api/health/import";

// ── Workout types → PT ────────────────────────────────────────────────────────
const WORKOUT_TYPES = {
  HKWorkoutActivityTypeRunning:                     "Corrida",
  HKWorkoutActivityTypeCycling:                     "Ciclismo",
  HKWorkoutActivityTypeWalking:                     "Caminhada",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "Musculação",
  HKWorkoutActivityTypeFunctionalStrengthTraining:  "Musculação",
  HKWorkoutActivityTypeYoga:                        "Yoga",
  HKWorkoutActivityTypeSwimming:                    "Natação",
  HKWorkoutActivityTypeHighIntensityIntervalTraining:"HIIT",
  HKWorkoutActivityTypeElliptical:                  "Elíptico",
  HKWorkoutActivityTypeCrossTraining:               "Cross Training",
  HKWorkoutActivityTypeOther:                       "Outro",
};

function dateBR(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function getAttr(str, key) {
  const r = new RegExp(`${key}="([^"]*?)"`);
  const x = r.exec(str);
  return x ? x[1] : "";
}

console.log("📂 Lendo arquivo...");
const text = readFileSync(XML_PATH, "utf8");
console.log(`✓ ${(text.length / 1024 / 1024).toFixed(1)} MB carregados`);

// ── Agrega métricas por dia ───────────────────────────────────────────────────
const stepsByDay    = {};
const caloriesByDay = {};
const distByDay     = {};
const hrByDay       = {};
// Sono: apenas InBed como total, AsleepDeep como sono profundo
// (AsleepCore/REM/InBed são sub-intervalos sobrepostos — somar todos causa dupla contagem)
const sleepByDay     = {};
const sleepDeepByDay = {};

console.log("⚙️  Processando registros de saúde...");
const recRegex = /<Record\s([^>]*?)(?:\/?>)/g;
let m, count = 0;

while ((m = recRegex.exec(text)) !== null) {
  const attrs = m[1];
  const type  = getAttr(attrs, "type");
  const val   = parseFloat(getAttr(attrs, "value")) || 0;
  const start = getAttr(attrs, "startDate").slice(0, 10);
  const end   = getAttr(attrs, "endDate").slice(0, 10);
  count++;

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
    const v    = getAttr(attrs, "value");
    const sMs  = new Date(getAttr(attrs, "startDate")).getTime();
    const eMs  = new Date(getAttr(attrs, "endDate")).getTime();
    const mins = (eMs - sMs) / 60000;
    if (mins > 0 && mins < 720) {
      // Contagem correta: apenas o registro raiz InBed para sono total
      // (os estágios Core/REM/Deep são sub-intervalos dentro do InBed)
      if (v === "HKCategoryValueSleepAnalysisInBed") {
        sleepByDay[end] = (sleepByDay[end] || 0) + mins;
      } else if (v === "HKCategoryValueSleepAnalysisAsleepDeep") {
        sleepDeepByDay[end] = (sleepDeepByDay[end] || 0) + mins;
      }
    }
  }
}
console.log(`✓ ${count.toLocaleString()} registros processados`);

// ── Treinos ───────────────────────────────────────────────────────────────────
const workouts = [];
const wkRegex  = /<Workout\s([^>]*?)>/g;
while ((m = wkRegex.exec(text)) !== null) {
  const attrs = m[1];
  const wType = getAttr(attrs, "workoutActivityType");
  const dur   = parseFloat(getAttr(attrs, "duration")) || 0;
  const dist  = parseFloat(getAttr(attrs, "totalDistance")) || 0;
  const cal   = parseFloat(getAttr(attrs, "totalEnergyBurned")) || 0;
  const start = getAttr(attrs, "startDate").slice(0, 10);
  if (!wType || !start || dur < 1) continue;
  workouts.push({
    date:         dateBR(start),
    tipo:         WORKOUT_TYPES[wType] || wType.replace("HKWorkoutActivityType", ""),
    duracao_min:  Math.round(dur),
    calorias:     Math.round(cal),
    distancia_km: Math.round(dist * 10) / 10,
  });
}
console.log(`✓ ${workouts.length} treinos encontrados`);

// ── Consolida dias ────────────────────────────────────────────────────────────
const allDays = new Set([...Object.keys(stepsByDay), ...Object.keys(caloriesByDay), ...Object.keys(sleepByDay)]);
const days    = Array.from(allDays)
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
    sleep_h:      sleepByDay[day]     ? Math.round((sleepByDay[day]     / 60) * 10) / 10 : null,
    sleep_deep_h: sleepDeepByDay[day] ? Math.round((sleepDeepByDay[day] / 60) * 10) / 10 : null,
  }));

console.log(`✓ ${days.length} dias com dados`);
const daysWithSleep = days.filter(d => d.sleep_h !== null);
console.log(`  → ${daysWithSleep.length} dias com sono (média: ${
  daysWithSleep.length
    ? (daysWithSleep.reduce((s, d) => s + d.sleep_h, 0) / daysWithSleep.length).toFixed(1)
    : "—"
}h)`);

// ── Passo 0 (opcional): limpa planilha se --reset ────────────────────────────
const RESET = process.argv.includes("--reset");
if (RESET) {
  console.log("\n🗑️  Limpando planilha (--reset)...");
  const res  = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ clear: true }) });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  console.log("  ✓ App_Saude e App_Treinos limpos");
}

// ── Passo 1: importa novos dias e treinos ─────────────────────────────────────
console.log(`\n📤 Importando novos registros → ${API_URL}...`);
const BATCH = 300;
let totalDays = 0, totalWorkouts = 0;

for (let i = 0; i < days.length; i += BATCH) {
  const chunk        = days.slice(i, i + BATCH);
  const wksThisBatch = i === 0 ? workouts : [];

  const res  = await fetch(API_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ days: chunk, workouts: wksThisBatch }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);

  totalDays     += json.days_written;
  totalWorkouts += json.workouts_written ?? 0;
  console.log(`  ✓ Batch ${Math.floor(i/BATCH)+1}: ${json.days_written} dias, ${json.workouts_written ?? 0} treinos`);
}

// ── Passo 2: corrige sono em dias já existentes na planilha ──────────────────
console.log(`\n🔧 Corrigindo sono em dias existentes...`);
for (let i = 0; i < days.length; i += BATCH) {
  const chunk = days.slice(i, i + BATCH);
  const res   = await fetch(API_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ days: chunk, workouts: [], update_sleep: true }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  console.log(`  ✓ Batch ${Math.floor(i/BATCH)+1}: ${json.sleep_updated ?? 0} linhas de sono atualizadas`);
}

console.log(`\n✅ Concluído!`);
console.log(`   ${totalDays} novos dias · ${totalWorkouts} treinos`);
console.log(`\n🌐 Acesse: https://daily-app-standalone.vercel.app/health`);
