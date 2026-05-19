"use client";

import { useState, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import { historyGet, historyTotal } from "@/lib/historyStore";
import styles from "./History.module.css";

const DAY_MS      = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const DAYS   = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const PROJ_COLOR = { pessoal: "#94a3b8", vca: "#5b9fd6", pdv: "#818cf8" };
const PROJ_LABEL = { pessoal: "Pessoal", vca: "VCA Brasil", pdv: "Ponto de Vista" };

// BRT: subtrai 3h do UTC
function brtDate(ms) {
  return new Date(Number(ms) - 3 * 3600 * 1000);
}

function dayKey(ms) {
  if (!ms) return null;
  const d = brtDate(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  const now = brtDate(Date.now());
  const tk  = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")}`;
  const yk  = dayKey(Date.now() - DAY_MS);
  if (key === tk) return "Hoje";
  if (key === yk) return "Ontem";
  const date = new Date(`${key}T12:00:00Z`);
  return `${DAYS[date.getUTCDay()]}, ${String(d).padStart(2,"0")} ${MONTHS[m-1]} ${y}`;
}

// Converte registro do localStorage para o shape usado pela UI
function toTask(r) {
  return {
    uid:               r.uid,
    id:                r.id,
    name:              r.name,
    due_date:          String(r.completed_at), // agrupa por data de conclusão
    _project_id:       r._project_id,
    _sub_client_label: r._sub_client_label,
  };
}

export default function HistoryPage() {
  const [tasks,       setTasks]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [daysLoaded,  setDaysLoaded]  = useState(WINDOW_DAYS);
  const [hasMore,     setHasMore]     = useState(true);
  const [filter,      setFilter]      = useState("all");
  const [search,      setSearch]      = useState("");
  const [totalStored, setTotalStored] = useState(0);

  // Carrega na montagem (client-only — localStorage não existe no servidor)
  useEffect(() => {
    const until = Date.now();
    const since = until - WINDOW_DAYS * DAY_MS;
    const loaded = historyGet(since, until).map(toTask);
    setTasks(loaded);
    setTotalStored(historyTotal());
    setLoading(false);
  }, []);

  function loadMore() {
    const until = Date.now() - daysLoaded * DAY_MS;
    const since = until - WINDOW_DAYS * DAY_MS;
    const more  = historyGet(since, until).map(toTask);
    if (more.length === 0) {
      setHasMore(false);
    } else {
      const seen = new Set(tasks.map(t => t.uid));
      setTasks(prev => [...prev, ...more.filter(t => !seen.has(t.uid))]);
    }
    setDaysLoaded(d => d + WINDOW_DAYS);
  }

  // ── Filtragem e agrupamento ──────────────────────────────────────────────────

  const visible = tasks
    .filter(t => filter === "all" || t._project_id === filter)
    .filter(t => !search || t.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.due_date || 0) - Number(a.due_date || 0));

  const byDay = {};
  for (const t of visible) {
    const k = dayKey(t.due_date) ?? "sem-data";
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(t);
  }
  const dayEntries = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));

  const todayKey   = dayKey(Date.now());
  const todayCount = tasks.filter(t => dayKey(t.due_date) === todayKey).length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      <ModuleHeader title="Histórico" />

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1>Concluídas</h1>
          <span className={styles.totalBadge}>{tasks.length}</span>
        </div>

        {!loading && tasks.length > 0 && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue} style={{ color: "var(--accent-primary)" }}>{todayCount}</span>
              <span className={styles.statLabel}>Hoje</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} style={{ color: "#60A5FA" }}>{totalStored}</span>
              <span className={styles.statLabel}>No total</span>
            </div>
          </div>
        )}

        <div className={styles.searchBar}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" className={styles.searchInput}
            placeholder="Buscar tarefa..." value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className={styles.searchClear} onClick={() => setSearch("")}>×</button>}
        </div>

        <div className={styles.filters}>
          {["all","pessoal","vca","pdv"].map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
              onClick={() => setFilter(f)}
              style={filter === f && f !== "all"
                ? { borderColor: PROJ_COLOR[f], color: PROJ_COLOR[f], background: PROJ_COLOR[f] + "15" }
                : {}}
            >
              {f === "all" ? "Todos" : PROJ_LABEL[f]}
            </button>
          ))}
        </div>
      </header>

      {/* Conteúdo */}
      {loading ? (
        <div className={styles.loading}>Carregando…</div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          <span style={{ fontSize: 40, opacity: 0.6 }}>📭</span>
          <h3>
            {search
              ? `Nenhum resultado para "${search}"`
              : tasks.length === 0
                ? "Nenhuma tarefa concluída registrada ainda"
                : "Nenhuma tarefa neste período"}
          </h3>
          <p>
            {tasks.length === 0
              ? "As próximas tarefas que você concluir pelo app aparecerão aqui."
              : "Tente ampliar o período ou limpar os filtros."}
          </p>
        </div>
      ) : (
        <div className={styles.groups}>
          {dayEntries.map(([key, dayTasks]) => (
            <div key={key} className={styles.group}>
              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>
                  {key === "sem-data" ? "Sem data" : dayLabel(key)}
                </span>
                <span className={styles.dateLine} />
                <span className={styles.dateCount}>{dayTasks.length}</span>
              </div>

              {["pessoal","vca","pdv"].map(proj => {
                const projTasks = dayTasks.filter(t => t._project_id === proj);
                if (!projTasks.length) return null;
                return (
                  <div key={proj} style={{ marginBottom: 4 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 16px 4px",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: PROJ_COLOR[proj], flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: PROJ_COLOR[proj], opacity: 0.8 }}>
                        {PROJ_LABEL[proj]}
                      </span>
                    </div>
                    <div className={styles.list}>
                      {projTasks.map(t => (
                        <div key={t.uid} className={styles.row}>
                          <div className={styles.projBar} style={{ background: PROJ_COLOR[proj] }} />
                          <div className={styles.mainInfo}>
                            <span className={styles.name}>{t.name}</span>
                            {t._sub_client_label && (
                              <span className={styles.sub}>{t._sub_client_label}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {hasMore ? (
            <button className={styles.loadMoreBtn} onClick={loadMore}>
              Carregar mais {WINDOW_DAYS} dias
            </button>
          ) : (
            <p className={styles.endLabel}>Fim do histórico carregado.</p>
          )}
        </div>
      )}

      <Navigation />
    </div>
  );
}
