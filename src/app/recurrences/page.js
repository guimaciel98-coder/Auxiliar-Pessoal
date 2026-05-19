"use client";

import { useState, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "./Recurrences.module.css";

const REC_LABELS = {
  daily:     "Todo dia",
  weekdays:  "Dias úteis",
  weekly:    "Toda semana",
  biweekly:  "Quinzenal",
  monthly:   "Todo mês",
  yearly:    "Anual",
  recurring: "Recorrente",
};

const REC_CLASS = {
  daily:     "freqDaily",
  weekdays:  "freqWeekdays",
  weekly:    "freqWeekly",
  biweekly:  "freqBiweekly",
  monthly:   "freqMonthly",
  yearly:    "freqYearly",
  recurring: "freqRecurring",
};

const PROJ_COLORS = { pessoal: "#94a3b8", vca: "#5b9fd6", pdv: "#818cf8" };
const MONTHS_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function formatDate(ms) {
  if (!ms) return null;
  const d = new Date(Number(ms) - 3 * 3600 * 1000);
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

export default function RecurrencesPage() {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");

  function load() {
    setLoading(true); setError(null);
    fetch("/api/tasks?mode=recurrences")
      .then(r => r.json())
      .then(data => setTasks(Array.isArray(data) ? data : (data.tasks || [])))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = tasks
    .filter(t => filter === "all" || t._project_id === filter)
    .filter(t => !search || t.name?.toLowerCase().includes(search.toLowerCase()));

  // Agrupa por tipo de recorrência
  const groups = {};
  for (const t of filtered) {
    const key = t._recurrence || "recurring";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  return (
    <div className={styles.container}>
      <ModuleHeader title="Repetir" showConfig />

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1>Tarefas Recorrentes</h1>
          <span className={styles.countBadge}>{tasks.length}</span>
        </div>
        <p className={styles.subtitle}>{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""} com recorrência ativa</p>

        {/* Barra de busca */}
        <div className={styles.searchBar}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar tarefa recorrente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch("")}>×</button>
          )}
        </div>

        {/* Filtros de projeto */}
        <div className={styles.filterBar}>
          {["all","pessoal","vca","pdv"].map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`}
              onClick={() => setFilter(f)}
              style={filter === f && f !== "all" ? { borderColor: PROJ_COLORS[f], color: PROJ_COLORS[f], background: PROJ_COLORS[f] + '15' } : {}}
            >
              {f === "all" ? "Todas" : f === "pessoal" ? "Pessoal" : f.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div style={{ padding: "20px", borderRadius: 14, background: "rgba(248,113,113,0.06)",
          border: "1px solid rgba(248,113,113,0.2)", color: "rgba(255,255,255,0.8)",
          fontSize: 13, marginBottom: 16 }}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Erro ao carregar</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{error}</p>
          <button onClick={load} style={{ marginTop: 10, padding: "5px 14px", borderRadius: 8,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Tentar novamente
          </button>
        </div>
      )}
      {loading ? (
        <div className={styles.loading}>Mapeando padrões...</div>
      ) : error ? null : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔄</div>
          <p>{search ? `Nenhum resultado para "${search}"` : "Nenhuma tarefa recorrente encontrada."}</p>
        </div>
      ) : (
        <div className={styles.groups}>
          {Object.entries(groups).map(([recType, groupTasks]) => (
            <div key={recType} className={styles.group}>
              <div className={styles.groupHead}>
                <span className={`${styles.freqBadge} ${styles[REC_CLASS[recType] || 'freqWeekly']}`}>
                  {REC_LABELS[recType] ?? recType}
                </span>
                <span className={styles.groupCount}>{groupTasks.length}</span>
              </div>
              <div className={styles.list}>
                {groupTasks.map(t => (
                  <div key={t.id} className={styles.card}>
                    <div className={styles.cardLeft}>
                      <div className={styles.projDot} style={{ background: PROJ_COLORS[t._project_id] || "#555" }} />
                      <div className={styles.cardInfo}>
                        <strong className={styles.cardName}>{t.name}</strong>
                        <div className={styles.cardMeta}>
                          {t._sub_client_label && (
                            <span className={styles.cardSub}>{t._sub_client_label}</span>
                          )}
                          {t._recurrence_string && (
                            <span className={styles.recHint}>{t._recurrence_string}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.cardRight}>
                      {t._repeat_forever && (
                        <span className={styles.foreverBadge}>↻ sempre</span>
                      )}
                      {formatDate(t.due_date) && (
                        <div className={styles.dateInfo}>
                          <span className={styles.dateLabel}>Próxima</span>
                          <span className={styles.dueDate}>{formatDate(t.due_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Navigation />
    </div>
  );
}
