"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import QuickAddModal from "./Daily/QuickAddModal";
import styles from "./Hub.module.css";

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
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - value / 100)}
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

// ── Barra fina ───────────────────────────────────────────────────────────────
function Bar({ pct, color }) {
  const clamped = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div className={styles.bar}>
      <div className={styles.barFill} style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

export default function Hub() {
  const [modal,        setModal]        = useState(false);
  const [health,       setHealth]       = useState(null);
  const [openTasks,    setOpenTasks]    = useState(null);  // só abertas (da API)
  const [completedIds, setCompletedIds] = useState(null);  // concluídas (localStorage)
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
      .then(r => r.json())
      .then(d => setOpenTasks((d.tasks ?? []).length))
      .catch(() => setOpenTasks(0));

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

        setRoutine({ current, total: sorted.length, eventPct: Math.max(0, Math.min(100, eventPct)) });
      }).catch(() => {});
  }, []);

  // Combina abertas + concluídas do localStorage
  const tasksDone  = completedIds?.size ?? null;
  const tasksTotal = openTasks != null && tasksDone != null ? openTasks + tasksDone : null;
  const tasksPct   = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  const finColor = finance
    ? (finance.pctVar > 85 ? "#fb7185" : finance.pctVar > 60 ? "#fbbf24" : "#34d399")
    : "#34d399";
  const treinosPct = health ? Math.round((health.monthWks / TREINOS_META) * 100) : null;

  return (
    <div className={styles.root}>
      <div className={styles.aurora} aria-hidden />
      <div className={styles.grain}  aria-hidden />

      {/* ── Barra do topo ── */}
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <div className={styles.brandMark}>G</div>
          <span className={styles.brandName}>Daily</span>
        </Link>
        <div className={styles.topRight}>
          <span className={styles.clock}>
            {now.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
          </span>
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

      {/* ── Bento: Financeiro (grande) | Tarefas / Rotina | Saúde (largo) ── */}
      <main className={styles.bento}>

        {/* Financeiro */}
        <Link href="/finance/overview" className={`${styles.card} ${styles.cardFinance}`} style={{ "--c": "52,211,153" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>R$</span>Financeiro</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.financeBody}>
            <div>
              <div className={styles.eyebrow}>Disponível para gastar</div>
              <div className={styles.heroNumber} style={{ color: finance && finance.saldoVar < 0 ? "#fb7185" : "#f9fafb" }}>
                {finance ? fmtBRL(finance.saldoVar) : <span className={styles.skeletonBig} />}
              </div>
              <div className={styles.muted}>
                {finance?.pctVar != null
                  ? <>Gastou <b>{fmtBRL(finance.gastoVar)}</b> de {fmtBRL(finance.budgetVar)} no ciclo</>
                  : "sem orçamento definido"}
              </div>
            </div>
            <Ring pct={finance?.pctVar} color={finColor} size={132} stroke={12}>
              <span className={styles.ringPct}>{finance?.pctVar != null ? `${finance.pctVar}%` : "—"}</span>
              <span className={styles.ringSub}>usado</span>
            </Ring>
          </div>
          <Bar pct={finance?.pctVar} color={finColor} />
        </Link>

        {/* Tarefas */}
        <Link href="/daily" className={styles.card} style={{ "--c": "167,139,250" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>✓</span>Tarefas</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.rowBody}>
            <Ring pct={tasksPct} color="#a78bfa">
              <span className={styles.ringPctSm}>{tasksTotal != null ? `${tasksPct}%` : "—"}</span>
            </Ring>
            <div className={styles.stack}>
              <Stat label="Concluídas" value={tasksTotal != null ? `${tasksDone}/${tasksTotal}` : null} big />
              <div className={styles.muted}>Pessoal · VCA · Ponto de Vista</div>
            </div>
          </div>
        </Link>

        {/* Rotina */}
        <Link href="/routine" className={styles.card} style={{ "--c": "56,189,248" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>⏱</span>Rotina</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.stack}>
            <div className={styles.eyebrow}>
              {routine?.current ? <><span className={styles.liveDot} />Agora</> : "Agora"}
            </div>
            <div className={styles.nowTitle}>
              {routine == null ? <span className={styles.skeleton} />
                : routine.current ? routine.current.activity
                : "Tempo livre"}
            </div>
            <Bar pct={routine?.current ? routine.eventPct : 0} color="#38bdf8" />
            <div className={styles.muted}>
              {routine == null ? "carregando…"
                : routine.current ? `${routine.eventPct}% do bloco · ${routine.total} blocos hoje`
                : `${routine.total} blocos hoje`}
            </div>
          </div>
        </Link>

        {/* Saúde */}
        <Link href="/health" className={`${styles.card} ${styles.cardHealth}`} style={{ "--c": "251,113,133" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>❤</span>Saúde · média do mês</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.healthBody}>
            <Stat label="Passos"      value={health ? fmtNum(health.steps) : null} big />
            <Stat label="Sono"        value={health ? fmtNum(health.sleep_h, 1) : null} unit="h" big />
            <Stat label="BPM repouso" value={health ? fmtNum(health.bpm) : null} big />
            <div className={styles.treinos}>
              <Ring pct={treinosPct} color="#fb7185" size={76} stroke={8}>
                <span className={styles.ringPctSm}>{health ? health.monthWks : "—"}</span>
              </Ring>
              <div className={styles.statLabel}>de {TREINOS_META} treinos</div>
            </div>
          </div>
        </Link>

      </main>

      {modal && <QuickAddModal onClose={() => setModal(false)} onSuccess={() => setModal(false)} />}
    </div>
  );
}
