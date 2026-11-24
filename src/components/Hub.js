"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import QuickAddModal from "./Daily/QuickAddModal";
import styles from "./Hub.module.css";
import BrandMark from "./ui/BrandMark";

const DAYS         = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTHS       = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const TREINOS_META = 16;
const LS_KEY       = "dailyapp_completed";

function greet(h) {
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
function fmtNum(v, dec = 0) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtBRL(v) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const str = abs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (v < 0 ? "-R$" : "R$") + str;
}
function brtTodayKey() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

// ── Anel de progresso (SVG) ───────────────────────────────────────────────────
function Ring({ pct, color, size = 88, stroke = 9, children }) {
  const r     = (size - stroke) / 2;
  const circ  = 2 * Math.PI * r;
  const value = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  // Começa em 0 e anima até o valor (o arco "enche" ao abrir a tela)
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={styles.ringArc}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className={styles.ringCenter}>{children}</div>
    </div>
  );
}

// ── Número com rótulo (mostra esqueleto enquanto carrega) ────────────────────
function Stat({ label, value, unit, color, big }) {
  return (
    <div className={styles.stat}>
      <div className={big ? styles.statValueBig : styles.statValue} style={{ color: color ?? "inherit" }}>
        {value ?? <span className={styles.skeleton} />}
        {value != null && unit && <span className={styles.statUnit}>{unit}</span>}
      </div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

// ── Gráfico de área (ex.: passos do mês) ─────────────────────────────────────
function Sparkline({ data, color, height = 56 }) {
  if (!data || data.length < 2) return <div className={styles.sparkEmpty}>sem dados no mês</div>;
  const W = 300, H = height, pad = 4;
  const max = Math.max(...data.map(d => d.v)) || 1;
  const pts = data.map((d, i) => [
    pad + (i / (data.length - 1)) * (W - pad * 2),
    H - pad - (d.v / max) * (H - pad * 2),
  ]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const last = pts[pts.length - 1];
  const gid  = `spark-${color.replace("#", "")}`;
  return (
    <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
    </svg>
  );
}

// ── Linha do tempo do dia (blocos da rotina + marcador de agora) ─────────────
// Cores das categorias — iguais às da página Minha Rotina
const ROT_COLOR = { treino: "#a78bfa", trabalho: "#38bdf8", pdv: "#fb923c", estudo: "#f472b6", pessoal: "#cbd5e1", sono: "#64748b", livre: "#34d399", "refeição": "#fbbf24" };
function rotColor(b) {
  const a = (b.activity ?? "").toLowerCase();
  const c = /acordar|dormir/.test(a) ? "sono" : /estudo/.test(a) ? "estudo" : /ponto de vista/.test(a) ? "pdv" : b.category;
  return ROT_COLOR[c] ?? ROT_COLOR.livre;
}
// % do dia: blocos já terminados ÷ total de blocos, sem contar Dormir (igual à página Minha Rotina)
function dayDonePct(allBlocks, nowMin) {
  const blocks = (allBlocks ?? []).filter(b => !/dormir/i.test(b.activity ?? ""));
  if (!blocks.length) return null;
  return Math.round((blocks.filter(b => b.minutes + (b.duration ?? 60) <= nowMin).length / blocks.length) * 100);
}

function DayTimeline({ blocks: allBlocks, nowMin, current }) {
  // "Dormir" fica fora: a barra mostra só o dia acordado
  const blocks = (allBlocks ?? []).filter(b => !/dormir/i.test(b.activity ?? ""));
  if (!blocks?.length) return <div className={styles.sparkEmpty}>sem blocos hoje</div>;
  const start = Math.min(...blocks.map(b => b.minutes));
  const end   = Math.max(...blocks.map(b => b.minutes + (b.duration ?? 60)));
  const span  = Math.max(1, end - start);
  const pos   = m => `${((m - start) / span) * 100}%`;
  const hh    = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}h`;
  return (
    <div className={styles.timeline}>
      <div className={styles.tlTrack}>
        {blocks.map((b, i) => {
          const done = b.minutes + (b.duration ?? 60) <= nowMin;
          const isCur = current && b === current;
          return (
            <span
              key={i}
              className={`${styles.tlBlock} ${isCur ? styles.tlCur : ""}`}
              style={{ left: pos(b.minutes), width: `calc(${((b.duration ?? 60) / span) * 100}% - 2px)`, background: rotColor(b), opacity: isCur ? 1 : done ? 0.3 : 0.75, "--g": rotColor(b) }}
              title={b.activity}
            />
          );
        })}
        {nowMin >= start && nowMin <= end && <span className={styles.tlNow} style={{ left: pos(nowMin) }} />}
      </div>
      <div className={styles.tlScale}><span>{hh(start)}</span><span>{hh(start + span / 2)}</span><span>{hh(end)}</span></div>
    </div>
  );
}

export default function Hub() {
  const [modal,        setModal]        = useState(false);
  const [health,       setHealth]       = useState(null);
  const [openTasks,    setOpenTasks]    = useState(null);  // lista de abertas hoje/atrasadas (da API)
  const [tasksErr,     setTasksErr]     = useState(false);
  const [completedIds, setCompletedIds] = useState(null);  // concluídas (localStorage deste navegador)
  const [doneApiIds,   setDoneApiIds]   = useState(null);  // concluídas hoje segundo o Todoist (fonte real)
  const [finance,      setFinance]      = useState(null);
  const [routine,      setRoutine]      = useState(null);

  const now    = new Date();
  const hour   = now.getHours();
  const nowMin = hour * 60 + now.getMinutes();

  useEffect(() => {
    // ── Concluídas do localStorage (mesmo mecanismo do painel) ──
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      setCompletedIds(new Set(raw[brtTodayKey()] ?? []));
    } catch { setCompletedIds(new Set()); }

    // ── Tarefas abertas ──
    fetch("/api/tasks")
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => setOpenTasks(d.tasks ?? []))
      .catch(() => { setTasksErr(true); setOpenTasks([]); });

    // ── Concluídas hoje (Todoist) — se falhar, fica só o localStorage ──
    fetch("/api/tasks/completed-today")
      .then(r => r.json())
      .then(d => setDoneApiIds(d.ok ? d.ids : []))
      .catch(() => setDoneApiIds([]));

    // ── Saúde — médias do mês atual ──
    fetch("/api/health")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const curM = now.getMonth() + 1;
        const curY = now.getFullYear();

        const monthDays = (d.days ?? []).filter(day => {
          const p = day.date?.split("/");
          return p && parseInt(p[1]) === curM && parseInt(p[2]) === curY;
        });

        function avg(key) {
          const vals = monthDays.map(x => x[key]).filter(v => v != null);
          return vals.length
            ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
            : null;
        }

        const monthWks = (d.workouts ?? []).filter(w => {
          const p = w.date?.split("/");
          return p && parseInt(p[1]) === curM && parseInt(p[2]) === curY;
        }).length;

        setHealth({
          steps:   avg("steps"),
          sleep_h: avg("sleep_h"),
          bpm:     avg("bpm_rest"),
          monthWks,
          // Passos dia a dia do mês (para o gráfico)
          stepsSeries: monthDays
            .map(x => ({ day: parseInt(x.date.split("/")[0]), v: x.steps }))
            .filter(x => x.v != null)
            .sort((a, b) => a.day - b.day),
        });
      }).catch(() => {});

    // ── Financeiro ──
    fetch("/api/finance")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const budgetVar = d.gastos?.variaveis?.previsaoTotal ?? null;
        const gastoVar  = d.gastos?.variaveis?.realTotal     ?? null;
        const saldoVar  = budgetVar != null && gastoVar != null ? budgetVar - gastoVar : null;
        const pctVar    = budgetVar > 0 ? Math.round((gastoVar / budgetVar) * 100) : null;
        setFinance({ saldoVar, budgetVar, gastoVar, pctVar });
      }).catch(() => {});

    // ── Rotina ──
    fetch("/api/routine")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const blocks = d.blocks ?? [];
        if (!blocks.length) { setRoutine({ current: null, total: 0, eventPct: 0 }); return; }

        const sorted = [...blocks].sort((a, b) => a.minutes - b.minutes);

        let current = null;
        for (const b of sorted) {
          if (b.minutes <= nowMin && nowMin < b.minutes + (b.duration ?? 60)) {
            current = b; break;
          }
        }

        let eventPct = 0;
        if (current) {
          const start = current.minutes;
          const end   = start + (current.duration ?? 60);
          eventPct = end > start
            ? Math.round(((nowMin - start) / (end - start)) * 100)
            : 0;
        }

        setRoutine({ current, total: sorted.length, eventPct: Math.max(0, Math.min(100, eventPct)), blocks: sorted });
      }).catch(() => {});
  }, []);

  // ── Tarefas: concluídas = Todoist ∪ este navegador (sem repetir, sem as que reabriram) ──
  const openIds  = new Set((openTasks ?? []).map(t => String(t.id)));
  const doneSet  = completedIds && doneApiIds
    ? new Set([...doneApiIds, ...[...completedIds].map(String)].filter(id => !openIds.has(id)))
    : null;
  const tasksDone  = doneSet ? doneSet.size : null;
  const tasksOpen  = openTasks ? openTasks.length : null;
  const tasksTotal = tasksOpen != null && tasksDone != null ? tasksOpen + tasksDone : null;
  const tasksPct   = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const allDone    = tasksTotal > 0 && tasksOpen === 0;

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const overdue    = (openTasks ?? []).filter(t => Number(t.due_date) < startToday).length;

  const finColor = finance
    ? (finance.pctVar > 85 ? "#fb7185" : finance.pctVar > 60 ? "#fbbf24" : "#34d399")
    : "#34d399";
  const treinosPct = health ? Math.round((health.monthWks / TREINOS_META) * 100) : null;
  const dayPct     = Math.round((nowMin / 1440) * 100);

  return (
    <div className={styles.root}>
      <div className={styles.aurora} aria-hidden />
      <div className={styles.grain}  aria-hidden />

      {/* ── Barra do topo ── */}
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <div className={styles.brandMark}><BrandMark size={28} /></div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Daily</span>
            <span className={styles.brandSub}>Guilherme</span>
          </div>
        </Link>
        <div className={styles.topRight}>
          <div className={styles.clock} title={`${dayPct}% do dia já passou`}>
            <span>{now.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}</span>
            <span className={styles.dayTrack}><span className={styles.dayFill} style={{ width: `${dayPct}%` }} /></span>
          </div>
          <button className={styles.quickBtn} onClick={() => setModal(true)}>
            <span className={styles.quickPlus}>+</span> Nova tarefa
          </button>
        </div>
      </header>

      {/* ── Saudação ── */}
      <section className={styles.hero}>
        <p className={styles.greetSmall}>{greet(hour)}, Guilherme</p>
        <h1 className={styles.greetTitle}>
          {DAYS[now.getDay()]}<span className={styles.greetDate}>, {now.getDate()} de {MONTHS[now.getMonth()]}</span>
        </h1>
      </section>

      {/* ── Grade 2×2, mesmo peso: Tarefas | Financeiro / Rotina | Saúde ── */}
      <main className={styles.bento}>

        {/* Tarefas */}
        <Link href="/daily" className={`${styles.card} ${allDone ? styles.celebrate : ""}`} style={{ "--c": "167,139,250" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>✓</span>Tarefas</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.quad}>
            <Ring pct={tasksPct} color={allDone ? "#34d399" : "#a78bfa"} size={132} stroke={12}>
              <span className={styles.ringPct}>{tasksTotal != null ? `${tasksPct}%` : "—"}</span>
            </Ring>
            <div className={styles.quadRight}>
              <Stat label="feitas hoje" value={tasksTotal != null ? <>{tasksDone}<span className={styles.of}>/{tasksTotal}</span></> : null} big />
              <div className={styles.statRow}>
                <Stat label="pendentes" value={tasksOpen} />
                <Stat label="atrasadas" value={openTasks ? overdue : null} color={overdue ? "#fb7185" : undefined} />
              </div>
            </div>
          </div>
        </Link>

        {/* Financeiro */}
        <Link href="/finance/overview" className={styles.card} style={{ "--c": "52,211,153" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>R$</span>Financeiro</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.quad}>
            <Ring pct={finance?.pctVar} color={finColor} size={132} stroke={12}>
              <span className={styles.ringPct}>{finance?.pctVar != null ? `${finance.pctVar}%` : "—"}</span>
              <span className={styles.ringSub}>gasto</span>
            </Ring>
            <div className={styles.quadRight}>
              <Stat
                label={finance && finance.saldoVar < 0 ? "acima do orçamento" : "disponível"}
                value={finance ? fmtBRL(finance.saldoVar) : null}
                color={finance && finance.saldoVar < 0 ? "#fb7185" : undefined}
                big
              />
              <div className={styles.statRow}>
                <Stat label="gasto" value={finance ? fmtBRL(finance.gastoVar) : null} />
                <Stat label="orçamento" value={finance ? fmtBRL(finance.budgetVar) : null} />
              </div>
            </div>
          </div>
        </Link>

        {/* Rotina */}
        <Link href="/routine" className={styles.card} style={{ "--c": "56,189,248" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>⏱</span>Rotina</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.quad}>
            <Ring pct={dayDonePct(routine?.blocks, nowMin) ?? 0} color="#38bdf8" size={132} stroke={12}>
              <span className={styles.ringPct}>{dayDonePct(routine?.blocks, nowMin) != null ? `${dayDonePct(routine?.blocks, nowMin)}%` : "—"}</span>
            </Ring>
            <div className={styles.quadRight}>
              <div className={styles.statLabel}>{routine?.current && <span className={styles.liveDot} />}agora</div>
              <div className={styles.nowTitle}>
                {routine == null ? <span className={styles.skeleton} />
                  : routine.current ? routine.current.activity
                  : "Livre"}
              </div>
            </div>
          </div>
          <DayTimeline blocks={routine?.blocks} nowMin={nowMin} current={routine?.current} />
        </Link>

        {/* Saúde */}
        <Link href="/health" className={styles.card} style={{ "--c": "251,113,133" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>❤</span>Saúde</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.quad}>
            <Ring pct={treinosPct} color="#fb7185" size={132} stroke={12}>
              <span className={styles.ringPct}>{health ? health.monthWks : "—"}</span>
              <span className={styles.ringSub}>/{TREINOS_META} treinos</span>
            </Ring>
            <div className={styles.quadRight}>
              <Stat label="passos / dia" value={health ? fmtNum(health.steps) : null} big />
              <div className={styles.statRow}>
                <Stat label="sono"    value={health ? fmtNum(health.sleep_h, 1) : null} unit="h" />
                <Stat label="bpm rep." value={health ? fmtNum(health.bpm) : null} />
              </div>
            </div>
          </div>
          <Sparkline data={health?.stepsSeries} color="#fb7185" />
        </Link>

      </main>

      {modal && <QuickAddModal onClose={() => setModal(false)} onSuccess={() => setModal(false)} />}
    </div>
  );
}
