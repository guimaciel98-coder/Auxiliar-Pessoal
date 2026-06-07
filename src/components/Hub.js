"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import QuickAddModal from "./Daily/QuickAddModal";
import styles from "./Hub.module.css";

const DAYS   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const TREINOS_META = 16; // meta mensal de treinos

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
  const [modal,   setModal]   = useState(false);
  const [health,  setHealth]  = useState(null);
  const [tasks,   setTasks]   = useState(null);
  const [finance, setFinance] = useState(null);
  const [routine, setRoutine] = useState(null);

  const now     = new Date();
  const hour    = now.getHours();
  const nowMin  = hour * 60 + now.getMinutes();
  const todayBR = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;

  useEffect(() => {
    // Tarefas
    fetch("/api/tasks")
      .then(r => r.json())
      .then(d => {
        const all  = d.tasks ?? [];
        const done = all.filter(t => t.status === "done" || t.completed).length;
        setTasks({ total: all.length, done });
      }).catch(() => {});

    // Saúde
    fetch("/api/health")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const today    = d.days?.find(x => x.date === todayBR) ?? d.days?.[0] ?? null;
        const todayWks = d.workouts?.filter(w => w.date === todayBR) ?? [];
        const monthWks = d.workouts?.filter(w => {
          const parts = w.date?.split("/");
          return parts && parseInt(parts[1]) === now.getMonth() + 1
                       && parseInt(parts[2]) === now.getFullYear();
        }).length ?? 0;
        setHealth({ today, todayWks, monthWks, averages: d.averages });
      }).catch(() => {});

    // Financeiro
    fetch("/api/finance")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const budgetVar  = d.gastos?.variaveis?.previsaoTotal ?? null;
        const gastoVar   = d.gastos?.variaveis?.realTotal     ?? null;
        const saldoVar   = budgetVar != null && gastoVar != null ? budgetVar - gastoVar : null;
        const pctVar     = budgetVar > 0 ? Math.round((gastoVar / budgetVar) * 100) : null;
        setFinance({ saldoVar, budgetVar, gastoVar, pctVar });
      }).catch(() => {});

    // Rotina
    fetch("/api/routine")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const blocks = d.blocks ?? [];
        if (!blocks.length) { setRoutine({ current: null, next: null, total: 0, dayPct: 0 }); return; }

        const sorted = [...blocks].sort((a, b) => a.minutes - b.minutes);
        const first  = sorted[0];
        const last   = sorted[sorted.length - 1];
        const end    = last.minutes + (last.duration ?? 60);
        const start  = first.minutes;
        const pct    = start < end
          ? Math.round(((Math.min(nowMin, end) - start) / (end - start)) * 100)
          : 0;

        let current = null, next = null;
        for (let i = 0; i < sorted.length; i++) {
          const b   = sorted[i];
          const bEnd = b.minutes + (b.duration ?? 60);
          if (b.minutes <= nowMin && nowMin < bEnd) {
            current = b;
            next    = sorted[i + 1] ?? null;
            break;
          }
          if (b.minutes > nowMin && !next) next = b;
        }
        setRoutine({ current, next, total: sorted.length, dayPct: Math.max(0, Math.min(100, pct)) });
      }).catch(() => {});
  }, []);

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

      {/* ── Grid 2×2 ── */}
      <main className={styles.grid}>

        {/* ── Tarefas ── */}
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
              <Kpi label="Hoje"       value={tasks ? tasks.total : null} color="#818cf8" />
              <Kpi label="Concluídas" value={tasks ? tasks.done  : null} color="#818cf8" />
            </div>
            {tasks && (
              <ProgressBar
                pct={tasks.total > 0 ? Math.round((tasks.done / tasks.total) * 100) : 0}
                color="#818cf8"
                label={tasks.total > 0 ? `${tasks.done} de ${tasks.total}` : "sem tarefas"}
              />
            )}
            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Acessar painel</span>
              <span className={styles.ctaArrow} style={{ color:"#818cf8" }}>→</span>
            </div>
          </div>
        </Link>

        {/* ── Saúde ── */}
        <Link href="/health" className={styles.card} style={{ "--accent": "248,113,113" }}>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.iconWrap} style={{ background:"rgba(248,113,113,0.15)", color:"#f87171" }}>❤</div>
              <div>
                <h2 className={styles.cardTitle}>Saúde</h2>
                <p className={styles.cardSub}>Médias dos últimos 30 dias</p>
              </div>
            </div>
            <div className={styles.kpiRow}>
              <Kpi label="Passos (méd.)"  value={health ? fmtNum(health.averages?.steps) : null} color="#f87171" />
              <Kpi label="Sono (méd.)"    value={health ? fmtNum(health.averages?.sleep_h, 1) : null} unit="h" color="#f87171" />
              <Kpi label="BPM repouso"    value={health ? fmtNum(health.averages?.bpm_rest) : null} color="#f87171" />
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

        {/* ── Financeiro ── */}
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
                  ? `${finance.pctVar}% do orçamento variável gasto (${fmtBRL(finance.gastoVar)} de ${fmtBRL(finance.budgetVar)})`
                  : "sem orçamento definido"}
              />
            )}
            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Abrir módulo</span>
              <span className={styles.ctaArrow} style={{ color:"#fbbf24" }}>→</span>
            </div>
          </div>
        </Link>

        {/* ── Rotina ── */}
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

            {/* Bloco atual */}
            <div className={styles.routineBlock}>
              <div className={styles.routineBlockLabel}>Agora</div>
              <div className={styles.routineBlockName}>
                {routine == null
                  ? <span className={styles.kpiSkeleton} style={{ width: 120 }}/>
                  : routine.current
                    ? routine.current.activity
                    : routine.next
                      ? <span style={{ color:"rgba(255,255,255,0.4)" }}>Em breve: {routine.next.activity}</span>
                      : <span style={{ color:"rgba(255,255,255,0.3)" }}>Dia encerrado</span>
                }
              </div>
              {routine?.next && routine.current && (
                <div className={styles.routineBlockNext}>
                  A seguir: {routine.next.time} · {routine.next.activity}
                </div>
              )}
            </div>

            <ProgressBar
              pct={routine?.dayPct ?? null}
              color="#38bdf8"
              label={routine != null ? `${routine.dayPct}% do dia concluído` : "carregando..."}
            />
            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Ver rotina</span>
              <span className={styles.ctaArrow} style={{ color:"#38bdf8" }}>→</span>
            </div>
          </div>
        </Link>

      </main>

      {modal && <QuickAddModal onClose={() => setModal(false)} onSuccess={() => setModal(false)} />}
    </div>
  );
}
