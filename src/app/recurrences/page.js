"use client";

import { useState, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import TaskEditModal from "@/components/Daily/TaskEditModal";
import { niceName } from "@/utils/niceName";
import { recPt, recGroup } from "@/utils/recurrenceText";
import styles from "./Recurrences.module.css";

// Ordem e rótulos dos grupos de frequência (calculados a partir do texto da regra)
const GROUPS = [
  { key: "daily",    label: "Todo dia",   short: "diárias",    color: "#34d399" },
  { key: "weekdays", label: "Dias úteis", short: "dias úteis", color: "#2dd4bf" },
  { key: "weekly",   label: "Semanal",    short: "semanais",   color: "#a78bfa" },
  { key: "biweekly", label: "Quinzenal",  short: "quinzenais", color: "#38bdf8" },
  { key: "monthly",  label: "Mensal",     short: "mensais",    color: "#fbbf24" },
  { key: "yearly",   label: "Anual",      short: "anuais",     color: "#fb7185" },
  { key: "other",    label: "Outras",     short: "outras",     color: "#94a3b8" },
];

const PROJECTS = [
  { key: "all",     label: "Todas" },
  { key: "pessoal", label: "Pessoal",        color: "#94a3b8" },
  { key: "vca",     label: "VCA Brasil",     color: "#5b9fd6" },
  { key: "pdv",     label: "Ponto de Vista", color: "#818cf8" },
];
const PROJ_COLORS = Object.fromEntries(PROJECTS.filter(p => p.color).map(p => [p.key, p.color]));

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WD     = ["dom","seg","ter","qua","qui","sex","sáb"];

// Próxima ocorrência: { day: "seg 23", rel: "hoje" | "amanhã" | "em 5 dias" | "há 2 dias" }
function nextInfo(ms) {
  if (!ms) return null;
  const d = new Date(Number(ms) - 3 * 3600 * 1000);
  const nowBRT = new Date(Date.now() - 3 * 3600 * 1000);
  const dayIdx = x => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) / 86400000;
  const diff = Math.round(dayIdx(d) - dayIdx(nowBRT));
  const rel = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : diff < 0 ? `há ${-diff} dia${diff === -1 ? "" : "s"}` : `em ${diff} dias`;
  return { day: `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, rel, diff };
}

export default function RecurrencesPage() {
  const [tasks, setTasks]       = useState([]);
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [project, setProject]   = useState("all");
  const [freq, setFreq]         = useState("all");
  const [search, setSearch]     = useState("");
  const [editTask, setEditTask] = useState(null);

  function load() {
    setLoading(true); setError(null);
    fetch("/api/tasks?mode=recurrences")
      .then(r => r.json())
      .then(data => setTasks(Array.isArray(data) ? data : (data.tasks || [])))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetch("/api/clients").then(r => r.json()).then(setClients).catch(() => {});
  }, []);

  // Grupo de cada tarefa (pelo texto da regra; se não houver texto, usa o que a API já trouxe)
  const withGroup = tasks.map(t => ({ ...t, _group: recGroup(t._recurrence_string) !== "other" ? recGroup(t._recurrence_string) : (GROUPS.some(g => g.key === t._recurrence) ? t._recurrence : "other") }));

  const byProject = withGroup.filter(t => project === "all" || t._project_id === project);
  const counts    = Object.fromEntries(GROUPS.map(g => [g.key, byProject.filter(t => t._group === g.key).length]));

  const filtered = byProject
    .filter(t => freq === "all" || t._group === freq)
    .filter(t => !search || t.name?.toLowerCase().includes(search.toLowerCase()));

  const groups = GROUPS
    .map(g => ({ ...g, tasks: filtered.filter(t => t._group === g.key).sort((a, b) => Number(a.due_date || 0) - Number(b.due_date || 0)) }))
    .filter(g => g.tasks.length);

  return (
    <div className={styles.container}>
      <ModuleHeader title="Repetir" hideOnDesktop />

      <header className={styles.header}>
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <span className={styles.eyebrow}>Tarefas</span>
            <h1 className={styles.title}>Repetir</h1>
          </div>
          <div className={styles.total}>
            <span className={styles.totalNum}>{byProject.length}</span>
            <span className={styles.totalLbl}>tarefas que se repetem</span>
          </div>
        </div>

        {/* Big numbers por frequência — clicar filtra, clicar de novo mostra todas */}
        <div className={styles.freqGrid}>
          {GROUPS.filter(g => counts[g.key] > 0 || g.key !== "other").map(g => (
            <button
              key={g.key}
              className={`${styles.freqBox} ${freq === g.key ? styles.freqActive : ""}`}
              style={{ "--f": g.color }}
              onClick={() => setFreq(f => (f === g.key ? "all" : g.key))}
              title={freq === g.key ? "Mostrar todas" : `Mostrar só ${g.short}`}
            >
              <span className={styles.freqNum}>{counts[g.key]}</span>
              <span className={styles.freqLbl}><span className={styles.freqDot} />{g.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.segment}>
            {PROJECTS.map(p => (
              <button
                key={p.key}
                className={`${styles.segBtn} ${project === p.key ? styles.segActive : ""}`}
                style={p.color ? { "--p": p.color } : undefined}
                onClick={() => setProject(p.key)}
              >
                {p.color && <span className={styles.segDot} />}{p.label}
              </button>
            ))}
          </div>
          <label className={styles.searchBox}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="Buscar tarefa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button type="button" className={styles.searchClear} onClick={() => setSearch("")}>✕</button>}
          </label>
        </div>
      </header>

      <main className={styles.main}>
        {error && (
          <div className={styles.errorBox}>
            <p><b>Erro ao carregar.</b> {error}</p>
            <button onClick={load} className={styles.retryBtn}>Tentar novamente</button>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>Carregando repetições…</div>
        ) : error ? null : groups.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>↻</div>
            <p>{search ? `Nenhum resultado para "${search}"` : "Nenhuma tarefa nesse filtro."}</p>
          </div>
        ) : (
          groups.map(g => (
            <section key={g.key} className={styles.group} style={{ "--f": g.color }}>
              <div className={styles.groupHead}>
                <span className={styles.groupDot} />
                <h2 className={styles.groupTitle}>{g.label}</h2>
                <span className={styles.groupCount}>{g.tasks.length}</span>
              </div>
              <div className={styles.grid}>
                {g.tasks.map(t => {
                  const nx = nextInfo(t.due_date);
                  return (
                    <button key={t.id} className={styles.card} onClick={() => setEditTask(t)} title="Abrir tarefa">
                      <span className={styles.projBar} style={{ background: PROJ_COLORS[t._project_id] || "#555" }} />
                      <span className={styles.cardInfo}>
                        <span className={styles.cardName}>{t.name}</span>
                        <span className={styles.cardMeta}>
                          <span className={styles.rule}>↻ {recPt(t._recurrence_string) || g.label.toLowerCase()}</span>
                          {t._sub_client_label && <span className={styles.brand}>{niceName(t._sub_client_label)}</span>}
                        </span>
                      </span>
                      {nx && (
                        <span className={`${styles.next} ${nx.diff <= 0 ? styles.nextNow : nx.diff === 1 ? styles.nextSoon : ""}`}>
                          <span className={styles.nextRel}>{nx.rel}</span>
                          <span className={styles.nextDay}>{nx.day}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {editTask && (
        <TaskEditModal
          task={editTask}
          clients={clients}
          onClose={() => setEditTask(null)}
          onSuccess={() => { setEditTask(null); setTimeout(load, 700); }}
        />
      )}
      <Navigation />
    </div>
  );
}
