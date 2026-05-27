"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import QuickAddModal from "./Daily/QuickAddModal";
import styles from "./Hub.module.css";

const DAYS   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const MONTHS_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function greet(h) {
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
function fmt(v, dec = 0) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
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
  const [modal, setModal]       = useState(false);
  const [health, setHealth]     = useState(null);
  const [tasks, setTasks]       = useState(null);

  const now    = new Date();
  const hour   = now.getHours();
  const todayBR = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const today = d.days?.find(x => x.date === todayBR) ?? d.days?.[0] ?? null;
        const todayWks = d.workouts?.filter(w => w.date === todayBR) ?? [];
        setHealth({ today, todayWks, workoutsTotal: d.workouts?.length ?? 0 });
      }).catch(() => {});

    fetch("/api/tasks")
      .then(r => r.json())
      .then(d => {
        const all  = d.tasks ?? [];
        const done = all.filter(t => t.status === "done" || t.completed).length;
        setTasks({ total: all.length, done });
      }).catch(() => {});
  }, []);

  return (
    <div className={styles.root}>
      {/* Glows */}
      <div className={styles.glowA} />
      <div className={styles.glowB} />
      <div className={styles.glowC} />

      {/* ── Brand bar ────────────────────────────────────────────── */}
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

      {/* ── Greeting ─────────────────────────────────────────────── */}
      <section className={styles.greeting}>
        <p className={styles.greetSmall}>{greet(hour)}</p>
        <h1 className={styles.greetTitle}>
          {DAYS[now.getDay()]}<span className={styles.greetDate}>, {now.getDate()} de {MONTHS[now.getMonth()]}</span>
        </h1>
      </section>

      {/* ── Grid de módulos ─────────────────────────────────────── */}
      <main className={styles.grid}>

        {/* ── Tarefas — coluna esquerda, grande ── */}
        <Link href="/daily" className={`${styles.card} ${styles.cardTarefas}`}>
          <div className={styles.cardBar} style={{ background:"#818cf8" }}/>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.iconWrap} style={{ background:"#818cf812", color:"#818cf8" }}>✓</div>
              <div>
                <h2 className={styles.cardTitle}>Tarefas</h2>
                <p className={styles.cardSub}>Pessoal · VCA Brasil · Ponto de Vista</p>
              </div>
            </div>

            <div className={styles.kpiRow}>
              <Kpi label="Hoje" value={tasks ? tasks.total : null} color="#818cf8" />
              <Kpi label="Concluídas" value={tasks ? tasks.done : null} color="#818cf8" />
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
                  {tasks.total > 0 ? Math.round((tasks.done/tasks.total)*100) : 0}% do dia
                </span>
              </div>
            )}

            <div className={styles.cardFooter} style={{ borderColor:"#818cf820" }}>
              <span className={styles.ctaLabel}>Acessar painel</span>
              <span className={styles.ctaArrow} style={{ color:"#818cf8" }}>→</span>
            </div>
          </div>
        </Link>

        {/* ── Coluna direita: 3 cards empilhados ── */}
        <div className={styles.rightCol}>

          {/* Saúde */}
          <Link href="/health" className={`${styles.card} ${styles.cardSmall}`}>
            <div className={styles.cardBar} style={{ background:"#f87171" }}/>
            <div className={styles.cardBody}>
              <div className={styles.cardHead}>
                <div className={styles.iconWrap} style={{ background:"#f8717112", color:"#f87171" }}>❤</div>
                <div>
                  <h2 className={styles.cardTitle}>Saúde</h2>
                  <p className={styles.cardSub}>Atividade · Sono · Treinos</p>
                </div>
              </div>
              <div className={styles.kpiRow}>
                <Kpi label="Passos" value={health ? fmt(health.today?.steps) : null} color="#f87171" />
                <Kpi label="Sono" value={health ? (health.today?.sleep_h != null ? fmt(health.today.sleep_h,1) : "—") : null} unit="h" color="#f87171" />
                <Kpi label="Treinos hoje" value={health ? health.todayWks.length : null} color="#f87171" />
              </div>
              <div className={styles.cardFooter} style={{ borderColor:"#f8717120" }}>
                <span className={styles.ctaLabel}>Ver saúde</span>
                <span className={styles.ctaArrow} style={{ color:"#f87171" }}>→</span>
              </div>
            </div>
          </Link>

          {/* Financeiro */}
          <Link href="/finance/overview" className={`${styles.card} ${styles.cardSmall}`}>
            <div className={styles.cardBar} style={{ background:"#fbbf24" }}/>
            <div className={styles.cardBody}>
              <div className={styles.cardHead}>
                <div className={styles.iconWrap} style={{ background:"#fbbf2412", color:"#fbbf24" }}>R$</div>
                <div>
                  <h2 className={styles.cardTitle}>Financeiro</h2>
                  <p className={styles.cardSub}>Receitas · Gastos · Saldo</p>
                </div>
              </div>
              <div className={styles.cardFooter} style={{ borderColor:"#fbbf2420" }}>
                <span className={styles.ctaLabel}>Abrir módulo</span>
                <span className={styles.ctaArrow} style={{ color:"#fbbf24" }}>→</span>
              </div>
            </div>
          </Link>

          {/* Rotina */}
          <Link href="/routine" className={`${styles.card} ${styles.cardSmall}`}>
            <div className={styles.cardBar} style={{ background:"#38bdf8" }}/>
            <div className={styles.cardBody}>
              <div className={styles.cardHead}>
                <div className={styles.iconWrap} style={{ background:"#38bdf812", color:"#38bdf8" }}>⏱</div>
                <div>
                  <h2 className={styles.cardTitle}>Rotina</h2>
                  <p className={styles.cardSub}>Timeline do dia</p>
                </div>
              </div>
              <div className={styles.cardFooter} style={{ borderColor:"#38bdf820" }}>
                <span className={styles.ctaLabel}>Ver rotina</span>
                <span className={styles.ctaArrow} style={{ color:"#38bdf8" }}>→</span>
              </div>
            </div>
          </Link>

        </div>
      </main>

      {modal && <QuickAddModal onClose={() => setModal(false)} onSuccess={() => setModal(false)} />}
    </div>
  );
}
