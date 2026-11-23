"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import QuickAddModal from "./Daily/QuickAddModal";
import styles from "./Hub.module.css";

const DAYS         = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTHS       = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const TREINOS_META = 16;
const LS_KEY       = "dailyapp_completed";
const PRIO_COLOR   = { p1: "#ff5a5f", p2: "#fb923c", p3: "#fbbf24", p4: "rgba(255,255,255,0.25)" };
const PROJ_LABEL   = { pessoal: "Pessoal", vca: "VCA", pdv: "Ponto de Vista" };

function fmtHour(ms) {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

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
  const nextTasks  = (openTasks ?? []).slice(0, 4);

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
          <div className={styles.brandMark}>G</div>
          <span className={styles.brandName}>Daily</span>
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

      {/* ── Saudação + resumo do dia ── */}
      <section className={styles.hero}>
        <p className={styles.greetSmall}>{greet(hour)}, Guilherme</p>
        <h1 className={styles.greetTitle}>
          {DAYS[now.getDay()]}<span className={styles.greetDate}>, {now.getDate()} de {MONTHS[now.getMonth()]}</span>
        </h1>
        <p className={styles.summary}>
          {tasksOpen == null ? "Preparando seu dia…" : allDone
            ? <>Você zerou as tarefas de hoje. ✨</>
            : <>Você tem <b>{tasksOpen} {tasksOpen === 1 ? "tarefa" : "tarefas"}</b> pela frente{overdue > 0 && <> (<b className={styles.warn}>{overdue} {overdue === 1 ? "atrasada" : "atrasadas"}</b>)</>}</>}
          {routine?.current && <>, agora é <b>{routine.current.activity}</b></>}
          {finance && finance.saldoVar != null && <> e <b style={{ color: finance.saldoVar < 0 ? "#fb7185" : undefined }}>{fmtBRL(Math.abs(finance.saldoVar))}</b> {finance.saldoVar < 0 ? "acima do orçamento" : "para gastar"}</>}.
        </p>
      </section>

      {/* ── Bento: Tarefas (destaque) | Financeiro / Rotina | Saúde ── */}
      <main className={styles.bento}>

        {/* Tarefas — destaque */}
        <Link href="/daily" className={`${styles.card} ${styles.cardTasks} ${allDone ? styles.celebrate : ""}`} style={{ "--c": "167,139,250" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>✓</span>Tarefas de hoje</span>
            <span className={styles.arrow}>↗</span>
          </div>

          <div className={styles.tasksBody}>
            <div className={styles.tasksLeft}>
              <Ring pct={tasksPct} color={allDone ? "#34d399" : "#a78bfa"} size={168} stroke={14}>
                <span className={styles.ringPct}>{tasksTotal != null ? `${tasksPct}%` : "—"}</span>
                <span className={styles.ringSub}>{tasksTotal != null ? `${tasksDone} de ${tasksTotal}` : "carregando"}</span>
              </Ring>
              <div className={styles.miniStats}>
                <Stat label="Pendentes" value={tasksOpen} />
                <Stat label="Feitas"    value={tasksDone} color="#34d399" />
                <Stat label="Atrasadas" value={openTasks ? overdue : null} color={overdue ? "#fb7185" : undefined} />
              </div>
            </div>

            <div className={styles.taskList}>
              <div className={styles.eyebrow}>{allDone ? "Tudo feito" : "Próximas"}</div>
              {openTasks == null && [0, 1, 2].map(i => <span key={i} className={styles.taskSkeleton} />)}
              {tasksErr && <div className={styles.muted}>Não consegui carregar as tarefas agora.</div>}
              {!tasksErr && openTasks && nextTasks.length === 0 && (
                <div className={styles.emptyTasks}>🎉 Nada pendente pra hoje</div>
              )}
              {nextTasks.map(t => {
                const due  = Number(t.due_date);
                const late = due < startToday;
                return (
                  <div key={t.id} className={styles.taskItem}>
                    <span className={styles.prio} style={{ background: PRIO_COLOR[t._priority] ?? PRIO_COLOR.p4 }} />
                    <span className={styles.taskName}>{t.name}</span>
                    <span className={`${styles.taskMeta} ${late ? styles.taskLate : ""}`}>
                      {late ? "atrasada" : t.due_date_time ? fmtHour(due) : PROJ_LABEL[t._project_id] ?? ""}
                    </span>
                  </div>
                );
              })}
              {openTasks && openTasks.length > nextTasks.length && (
                <div className={styles.more}>+ {openTasks.length - nextTasks.length} no painel</div>
              )}
            </div>
          </div>
        </Link>

        {/* Financeiro */}
        <Link href="/finance/overview" className={styles.card} style={{ "--c": "52,211,153" }}>
          <div className={styles.cardTop}>
            <span className={styles.chip}><span className={styles.chipIcon}>R$</span>Financeiro</span>
            <span className={styles.arrow}>↗</span>
          </div>
          <div className={styles.stack}>
            <div className={styles.eyebrow}>{finance && finance.saldoVar < 0 ? "Acima do orçamento" : "Disponível para gastar"}</div>
            <div className={styles.money} style={{ color: finance && finance.saldoVar < 0 ? "#fb7185" : "#f9fafb" }}>
              {finance ? fmtBRL(finance.saldoVar) : <span className={styles.skeleton} />}
            </div>
            <Bar pct={finance?.pctVar} color={finColor} />
            <div className={styles.muted}>
              {finance?.pctVar != null
                ? <><b>{finance.pctVar}%</b> usado · {fmtBRL(finance.gastoVar)} de {fmtBRL(finance.budgetVar)}</>
                : "sem orçamento definido"}
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
              {routine?.current && <span className={styles.liveDot} />}Agora
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
              <div className={styles.statLabel}>de {TREINOS_META} treinos<br />no mês</div>
            </div>
          </div>
        </Link>

      </main>

      {modal && <QuickAddModal onClose={() => setModal(false)} onSuccess={() => setModal(false)} />}
    </div>
  );
}
