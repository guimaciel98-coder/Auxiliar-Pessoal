"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import QuickAddModal from "./Daily/QuickAddModal";
import styles from "./Hub.module.css";

const DAYS   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

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
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
    fetch("/api/health")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const today    = d.days?.find(x => x.date === todayBR) ?? d.days?.[0] ?? null;
        const todayWks = d.workouts?.filter(w => w.date === todayBR) ?? [];
        setHealth({ today, todayWks });
      }).catch(() => {});

    fetch("/api/tasks")
      .then(r => r.json())
      .then(d => {
        const all  = d.tasks ?? [];
        const done = all.filter(t => t.status === "done" || t.completed).length;
        setTasks({ total: all.length, done });
      }).catch(() => {});

    fetch("/api/finance")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        setFinance({
          receita: d.receita?.total ?? null,
          gastos:  d.gastos?.real  ?? null,
          saldo:   d.summary?.saldoTudo ?? null,
        });
      }).catch(() => {});

    fetch("/api/routine")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const blocks = d.blocks ?? [];
        let current = null, next = null;
        for (let i = 0; i < blocks.length; i++) {
          const b   = blocks[i];
          const end = b.minutes + (b.duration ?? 60);
          if (b.minutes <= nowMin && nowMin < end) {
            current = b;
            next    = blocks[i + 1] ?? null;
            break;
          }
          if (b.minutes > nowMin && !next) next = b;
        }
        setRoutine({ current, next, total: blocks.length });
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
              <Kpi label="Hoje"      value={tasks ? tasks.total : null} color="#818cf8" />
              <Kpi label="Concluídas" value={tasks ? tasks.done  : null} color="#818cf8" />
              {tasks && tasks.total > 0 && (
                <Kpi label="Progresso"
                  value={`${Math.round((tasks.done / tasks.total) * 100)}%`}
                  color="#818cf8" />
              )}
            </div>

            {tasks && (
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{
                    width: tasks.total > 0 ? `${Math.round((tasks.done/tasks.total)*100)}%` : "0%",
                    background: "#818cf8",
                  }}/>
                </div>
                <span className={styles.progressLabel}>
                  {tasks.total > 0 ? `${tasks.done} de ${tasks.total}` : "sem tarefas"}
                </span>
              </div>
            )}

            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Acessar painel</span>
              <span className={styles.ctaArrow} style={{ color:"#818cf8" }}>→</span>
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
                <p className={styles.cardSub}>Atividade · Sono · Treinos</p>
              </div>
            </div>
            <div className={styles.kpiRow}>
              <Kpi label="Passos"  value={health ? fmtNum(health.today?.steps) : null} color="#f87171" />
              <Kpi label="Sono"    value={health ? (health.today?.sleep_h != null ? fmtNum(health.today.sleep_h,1) : "—") : null} unit="h" color="#f87171" />
              <Kpi label="Treinos" value={health ? health.todayWks.length : null} color="#f87171" />
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.ctaLabel}>Ver saúde</span>
              <span className={styles.ctaArrow} style={{ color:"#f87171" }}>→</span>
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
                <p className={styles.cardSub}>Receitas · Gastos · Saldo</p>
              </div>
            </div>
            <div className={styles.kpiRow}>
              <Kpi label="Receita" value={finance ? fmtBRL(finance.receita) : null} color="#4ade80" />
              <Kpi label="Gastos"  value={finance ? fmtBRL(finance.gastos)  : null} color="#f87171" />
              <Kpi label="Saldo"   value={finance ? fmtBRL(finance.saldo)   : null}
                color={finance?.saldo >= 0 ? "#fbbf24" : "#f87171"} />
            </div>
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
                  {routine ? `${routine.total} blocos hoje` : "Timeline do dia"}
                </p>
              </div>
            </div>

            {(routine?.current || routine?.next) && (
              <div className={styles.routineRow}>
                {routine.current && (
                  <div className={styles.routineItem}>
                    <span className={styles.routineTime}>Agora · {routine.current.time}</span>
                    <span className={styles.routineActivity}>{routine.current.activity}</span>
                  </div>
                )}
                {routine.next && (
                  <div className={styles.routineItem}>
                    <span className={styles.routineTime}>Próximo · {routine.next.time}</span>
                    <span className={styles.routineActivity} style={{ color:"rgba(255,255,255,0.45)" }}>
                      {routine.next.activity}
                    </span>
                  </div>
                )}
              </div>
            )}

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
