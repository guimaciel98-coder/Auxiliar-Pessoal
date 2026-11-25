// Lê o export do app Saúde do iPhone (.zip ou .xml) direto no navegador, em partes (streaming),
// para aguentar arquivos de centenas de MB sem travar. Mesma lógica do scripts/import-health.mjs,
// e agora também pega calorias/distância dos treinos nos exports novos (WorkoutStatistics).
import { Unzip, UnzipInflate } from "fflate";

const WORKOUT_TYPES = {
  HKWorkoutActivityTypeRunning: "Corrida",
  HKWorkoutActivityTypeCycling: "Ciclismo",
  HKWorkoutActivityTypeWalking: "Caminhada",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "Musculação",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "Musculação",
  HKWorkoutActivityTypeYoga: "Yoga",
  HKWorkoutActivityTypeSwimming: "Natação",
  HKWorkoutActivityTypeHighIntensityIntervalTraining: "HIIT",
  HKWorkoutActivityTypeElliptical: "Elíptico",
  HKWorkoutActivityTypeCrossTraining: "Cross Training",
  HKWorkoutActivityTypeHiking: "Trilha",
  HKWorkoutActivityTypeDance: "Dança",
  HKWorkoutActivityTypeSoccer: "Futebol",
  HKWorkoutActivityTypeTennis: "Tênis",
  HKWorkoutActivityTypePilates: "Pilates",
  HKWorkoutActivityTypeCoreTraining: "Core",
  HKWorkoutActivityTypeOther: "Outro",
};

export const FROM_DATE = "2025-01-01";

const dateBR = iso => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

// Extrai o valor de um atributo sem regex (milhões de registros → precisa ser rápido)
function attr(s, key) {
  const k = ` ${key}="`;
  const i = s.indexOf(k);
  if (i < 0) return "";
  const a = i + k.length;
  const b = s.indexOf('"', a);
  return b < 0 ? "" : s.slice(a, b);
}

// "2026-07-30 08:12:00 -0300" → ms (formato ISO estrito, que o Safari também entende)
const toMs = s => Date.parse(`${s.slice(0, 10)}T${s.slice(11, 19)}${s.slice(20, 23)}:${s.slice(23, 25)}`);

// O arquivo principal no zip: apple_health_export/export.xml (ou exportar.xml no iPhone em português)
const isMainXml = name => /(^|\/)(export|exportar)\.xml$/i.test(name);

function createAggregator() {
  const steps = {}, cal = {}, dist = {}, hr = {}, sleep = {}, deep = {};
  const workouts = [];
  let current = null, records = 0;

  function onTag(tag, a) {
    if (tag === "Record") {
      records++;
      const type = attr(a, "type");
      if (type === "HKQuantityTypeIdentifierStepCount") {
        const d = attr(a, "startDate").slice(0, 10); steps[d] = (steps[d] || 0) + (parseFloat(attr(a, "value")) || 0);
      } else if (type === "HKQuantityTypeIdentifierActiveEnergyBurned") {
        const d = attr(a, "startDate").slice(0, 10); cal[d] = (cal[d] || 0) + (parseFloat(attr(a, "value")) || 0);
      } else if (type === "HKQuantityTypeIdentifierDistanceWalkingRunning") {
        const d = attr(a, "startDate").slice(0, 10); dist[d] = (dist[d] || 0) + (parseFloat(attr(a, "value")) || 0);
      } else if (type === "HKQuantityTypeIdentifierHeartRate") {
        const d = attr(a, "startDate").slice(0, 10); const v = parseFloat(attr(a, "value")) || 0;
        const h = hr[d] || (hr[d] = [0, 0]); h[0] += v; h[1]++;
      } else if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
        // Só InBed para o total e AsleepDeep para profundo (os outros estágios se sobrepõem)
        const v = attr(a, "value");
        const s = attr(a, "startDate"), e = attr(a, "endDate");
        const mins = (toMs(e) - toMs(s)) / 60000;
        if (mins > 0 && mins < 720) {
          const d = e.slice(0, 10);
          if (v === "HKCategoryValueSleepAnalysisInBed") sleep[d] = (sleep[d] || 0) + mins;
          else if (v === "HKCategoryValueSleepAnalysisAsleepDeep") deep[d] = (deep[d] || 0) + mins;
        }
      }
    } else if (tag === "Workout") {
      const wType = attr(a, "workoutActivityType");
      const dur   = parseFloat(attr(a, "duration")) || 0;
      const start = attr(a, "startDate").slice(0, 10);
      current = null;
      if (!wType || !start || dur < 1 || start < FROM_DATE) return;
      current = {
        iso: start,
        tipo: WORKOUT_TYPES[wType] || wType.replace("HKWorkoutActivityType", ""),
        duracao_min: Math.round(dur),
        calorias: parseFloat(attr(a, "totalEnergyBurned")) || 0,
        distancia_km: parseFloat(attr(a, "totalDistance")) || 0,
      };
      workouts.push(current);
    } else if (tag === "WorkoutStatistics" && current) {
      const type = attr(a, "type"), sum = parseFloat(attr(a, "sum")) || 0;
      if (type === "HKQuantityTypeIdentifierActiveEnergyBurned" && !current.calorias) current.calorias = sum;
      else if (/Distance/.test(type) && !current.distancia_km) current.distancia_km = sum;
    }
  }

  // Recebe texto já cortado em fim de linha (as tags de abertura ficam numa linha só)
  function feed(text) {
    let i = 0;
    while ((i = text.indexOf("<", i)) !== -1) {
      const c = text.charCodeAt(i + 1);
      // R(82) W(87) — só nos interessam <Record, <Workout e <WorkoutStatistics
      if (c !== 82 && c !== 87) { i++; continue; }
      const end = text.indexOf(">", i);
      if (end === -1) break;
      const sp = text.indexOf(" ", i);
      if (sp !== -1 && sp < end) {
        const tag = text.slice(i + 1, sp);
        if (tag === "Record" || tag === "Workout" || tag === "WorkoutStatistics") onTag(tag, text.slice(sp, end));
      }
      i = end + 1;
    }
  }

  function result() {
    const all = new Set([...Object.keys(steps), ...Object.keys(cal), ...Object.keys(sleep)]);
    const days = [...all].filter(d => d.length === 10 && d >= FROM_DATE).sort().map(d => ({
      date: dateBR(d),
      steps: Math.round(steps[d] || 0) || null,
      calories: Math.round(cal[d] || 0) || null,
      distance_km: dist[d] ? Math.round(dist[d] * 10) / 10 : null,
      bpm_avg: hr[d] ? Math.round(hr[d][0] / hr[d][1]) : null,
      sleep_h: sleep[d] ? Math.round((sleep[d] / 60) * 10) / 10 : null,
      sleep_deep_h: deep[d] ? Math.round((deep[d] / 60) * 10) / 10 : null,
    }));
    const wks = workouts.map(w => ({
      date: dateBR(w.iso), tipo: w.tipo, duracao_min: w.duracao_min,
      calorias: Math.round(w.calorias), distancia_km: Math.round(w.distancia_km * 10) / 10,
    }));
    const isoDays = [...all].filter(d => d.length === 10 && d >= FROM_DATE).sort();
    return { days, workouts: wks, records, first: isoDays[0] ?? null, last: isoDays[isoDays.length - 1] ?? null };
  }

  return { feed, result };
}

/**
 * parseHealthFile(file, onProgress) → { days, workouts, records, first, last }
 * onProgress(0..1) é chamado conforme o arquivo é lido.
 */
export async function parseHealthFile(file, onProgress = () => {}) {
  const agg = createAggregator();
  const decoder = new TextDecoder();
  let carry = "";
  let found = false;

  const pushText = (chunk, final) => {
    const s = carry + decoder.decode(chunk, { stream: !final });
    const cut = final ? s.length : s.lastIndexOf("\n") + 1;
    agg.feed(s.slice(0, cut));
    carry = s.slice(cut);
  };

  const isZip = /\.zip$/i.test(file.name) || file.type.includes("zip");
  let unzip = null;
  if (isZip) {
    unzip = new Unzip(f => {
      if (!isMainXml(f.name) || found) return; // os outros arquivos do zip são ignorados
      found = true;
      f.ondata = (err, data, final) => { if (err) throw err; pushText(data, final); };
      f.start();
    });
    unzip.register(UnzipInflate);
  } else {
    found = true;
  }

  const reader = file.stream().getReader();
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // Fatias de 512 KB: entre elas o navegador atualiza a tela (porcentagem)
    for (let o = 0; o < value.length; o += 1 << 19) {
      const part = value.subarray(o, Math.min(value.length, o + (1 << 19)));
      if (unzip) unzip.push(part, false); else pushText(part, false);
      read += part.length;
      onProgress(read / file.size);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  if (unzip) unzip.push(new Uint8Array(0), true); else pushText(new Uint8Array(0), true);
  if (carry) agg.feed(carry);

  if (!found) throw new Error("Não achei o export.xml dentro do zip. É o arquivo exportado do app Saúde?");
  const res = agg.result();
  if (!res.days.length && !res.workouts.length) throw new Error("O arquivo não tem dados de saúde a partir de 2025.");
  return res;
}
