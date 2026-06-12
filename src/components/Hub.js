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

function Kpi({ label, value, unit, color }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiValue} style={{ color: color ?? "inherit" }}>
        {value ?? <span className={styles.kpiSkeleton}/>}
        {value != null && unit && <span className={styles.kpiUnit}>{unit}</span>}
      </div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

function ProgressBar({ pct, color, label }) {
  const clamped = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div className={styles.progressWrap}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${clamped}%`, background: color }}/>
      </div>
      <span className={styles.progressLabel}>{label}</span>
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

  return (
    <div className={styles.root}>
      <div className={styles.glowA} />
      <div className={styles.glowB} />
      <div className={styles.glowC} />

      {/* ── Brand bar ── */}
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <div className={styles.brandMark}>G</div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Daily</span>
            <span className={styles.brandSub}>workspace</span>
          </div>
        </Link>
        <div className={styles.topRight}>
          <span className={styles.clock}>
            {now.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
          </span>
          <button className={styles.quickBtn} onClick={() => setModal(true)}>+</button>
        </div>
      </header>

      {/* ── Greeting ── */}
      <section className={styles.greeting}>
        <p className={styles.greetSmall}>{greet(hour)}</p>
        <h1 className={styles.greetTitle}>
          {DAYS[now.getDay()]}<span className={styles.greetDate}>, {now.getDate()} de {MONTHS[now.getMonth()]}</span>
        </h1>
      </section>

      {/* ── Grid 2×2 — ordem: Tarefas | Financeiro / Rotina | Saúde ── */}
      <main className={styles.grid}>

        {/* Tarefas */}
        <Link href="/daily" className={styles.card} style={{ "--accent": "129,140,248" }}>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.iconWrap} style={{ background:"rgba(129,140,248,0.15)", color:"#818cf8" }}>✓</div>
              <div>
                <h2 className={styles.cardTitle}>Tarefas</h2>
                <p className={styles.cardSub}>Pessoal · VCA Brasil · Ponto de Vista</p>
              </div>
            </div>
            <div className={styles.kpiRow}>
              <Kpi label="Hoje"       value={tasksTotal} color="#818cf8" />
              <Kpi label="Concluídas" value={tasksDone}  color="#818cf8" />
            </div>
            {tasksTotal != null && (
              <ProgressBar
                pct={tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0}
                color="#818cf8"
                label={tasksTotal > 0 ? `${tasksDone} de ${tasksTotal}` : "sem tarefas"}
              />
            )}
            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Acessar painel</span>
              <span className={styles.ctaArrow} style={{ color:"#818cf8" }}>→</span>
            </div>
          </div>
        </Link>

        {/* Financeiro */}
        <Link href="/finance/overview" className={styles.card} style={{ "--accent": "251,191,36" }}>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.iconWrap} style={{ background:"rgba(251,191,36,0.15)", color:"#fbbf24" }}>R$</div>
              <div>
                <h2 className={styles.cardTitle}>Financeiro</h2>
                <p className={styles.cardSub}>Saldo variável disponível</p>
              </div>
            </div>
            <div className={styles.kpiRow}>
              <Kpi
                label="Disponível agora"
                value={finance ? fmtBRL(finance.saldoVar) : null}
                color={finance ? (finance.saldoVar >= 0 ? "#fbbf24" : "#f87171") : undefined}
              />
            </div>
            {finance && (
              <ProgressBar
                pct={finance.pctVar}
                color={finance.pctVar > 85 ? "#f87171" : finance.pctVar > 60 ? "#fbbf24" : "#4ade80"}
                label={finance.pctVar != null
                  ? `${finance.pctVar}% gasto (${fmtBRL(finance.gastoVar)} de ${fmtBRL(finance.budgetVar)})`
                  : "sem orçamento definido"}
              />
            )}
            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Abrir módulo</span>
              <span className={styles.ctaArrow} style={{ color:"#fbbf24" }}>→</span>
            </div>
          </div>
        </Link>

        {/* Rotina */}
        <Link href="/routine" className={styles.card} style={{ "--accent": "56,189,248" }}>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.iconWrap} style={{ background:"rgba(56,189,248,0.15)", color:"#38bdf8" }}>⏱</div>
              <div>
                <h2 className={styles.cardTitle}>Rotina</h2>
                <p className={styles.cardSub}>
                  {routine != null ? `${routine.total} blocos hoje` : "Timeline do dia"}
                </p>
              </div>
            </div>
            <div className={styles.kpiRow}>
              <Kpi
                label="Agora"
                value={routine == null ? null
                  : routine.current ? routine.current.activity
                  : "—"}
                color="#38bdf8"
              />
            </div>
            <ProgressBar
              pct={routine?.current ? routine.eventPct : null}
              color="#38bdf8"
              label={routine == null ? "carregando..."
                : routine.current ? `${routine.eventPct}% do bloco atual concluído`
                : "sem bloco em andamento"}
            />
            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Ver rotina</span>
              <span className={styles.ctaArrow} style={{ color:"#38bdf8" }}>→</span>
            </div>
          </div>
        </Link>

        {/* Saúde */}
        <Link href="/health" className={styles.card} style={{ "--accent": "248,113,113" }}>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.iconWrap} style={{ background:"rgba(248,113,113,0.15)", color:"#f87171" }}>❤</div>
              <div>
                <h2 className={styles.cardTitle}>Saúde</h2>
                <p className={styles.cardSub}>Médias do mês atual</p>
              </div>
            </div>
            <div className={styles.kpiRow}>
              <Kpi label="Passos (méd.)"  value={health ? fmtNum(health.steps)   : null} color="#f87171" />
              <Kpi label="Sono (méd.)"    value={health ? fmtNum(health.sleep_h, 1) : null} unit="h" color="#f87171" />
              <Kpi label="BPM repouso"    value={health ? fmtNum(health.bpm)     : null} color="#f87171" />
            </div>
            <ProgressBar
              pct={health ? Math.round((health.monthWks / TREINOS_META) * 100) : null}
              color="#f87171"
              label={health
                ? `${health.monthWks} de ${TREINOS_META} treinos este mês`
                : "carregando..."}
            />
            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Ver saúde</span>
              <span className={styles.ctaArrow} style={{ color:"#f87171" }}>→</span>
            </div>
          </div>
        </Link>

      </main>

      {modal && <QuickAddModal onClose={() => setModal(false)} onSuccess={() => setModal(false)} />}
    </div>
  );
}
