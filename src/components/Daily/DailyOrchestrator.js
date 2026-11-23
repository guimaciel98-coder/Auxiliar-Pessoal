"use client";

import { useState, useEffect, useCallback } from "react";
import { PROJ, MONTHS, DAYS } from "../../config/constants";
import { classify } from "../../utils/helpers";
import { useTasks } from "../../hooks/useTasks";

import Toast from "../ui/Toast";

import Header from "./Header";
import Metrics from "./Metrics";
import { Section, VcaSection, PdvSection } from "./TaskLists";
import TaskEditModal from "./TaskEditModal";

import styles from "./DailyOrchestrator.module.css";

export default function DailyOrchestrator({ mode = "today" }) {
  const {
    data, loading, syncing, clockNow,
    load, sync,
    completed, completing, fading, rescheduling, reopening,
    rescheduleTask, completeTask, reopenCompleted,
    toast, showToast,
  } = useTasks(mode);

  const [filter, setFilter]           = useState("all");
  const [search, setSearch]           = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(null);
  const [editingTask, setEditingTask]  = useState(null);
  const [clients, setClients]         = useState([]);
  const [doneApiItems, setDoneApiItems] = useState([]); // concluídas hoje segundo o Todoist (fonte real)

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(setClients).catch(console.error);
  }, []);

  // Concluídas hoje direto do Todoist (inclui recorrentes e as feitas em outro aparelho)
  const loadDoneToday = useCallback(() => {
    if (mode !== "today") return;
    fetch("/api/tasks/completed-today")
      .then(r => r.json())
      .then(d => { if (d.ok) setDoneApiItems(d.items); })
      .catch(() => {});
  }, [mode]);
  useEffect(() => { loadDoneToday(); }, [loadDoneToday]);

  // Callback para o modal reportar sucesso com mensagem de toast
  const handleEditSuccess = useCallback((message) => {
    setTimeout(() => {
      load();
      if (message) showToast(message);
    }, 700);
  }, [load, showToast]);

  if (loading && !data) {
    return <div className={styles.wrap}><div className={styles.loading}>carregando tarefas...</div></div>;
  }

  if (!data) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loading}>
          Erro ao carregar tarefas.{" "}
          <button
            onClick={load}
            style={{ marginLeft: 8, padding: "4px 14px", background: "rgba(0,229,160,0.12)",
              border: "1px solid rgba(0,229,160,0.3)", borderRadius: 8, color: "#00e5a0",
              cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const apiAllTasks = (data.tasks || []).map(classify);
  const all = apiAllTasks.filter(t => !completed.has(t.id));

  // Início do dia atual em BRT (UTC-3)
  const startOfTodayBRT = (() => {
    const n = new Date(clockNow - 3 * 3600 * 1000);
    return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 3, 0, 0);
  })();

  // Tarefas de dias anteriores = atrasadas (só relevante no modo "hoje")
  const overdueTasks = mode === "today"
    ? all.filter(t => t.ts && Number(t.ts) < startOfTodayBRT)
    : [];
  const currentTasks = mode === "today"
    ? all.filter(t => !t.ts || Number(t.ts) >= startOfTodayBRT)
    : all;

  // Concluídas = Todoist ∪ marcadas neste navegador, sem as que ainda estão abertas
  const openIds        = new Set(all.map(t => String(t.id)));
  const doneIds        = new Set([...doneApiItems.map(i => i.id), ...[...completed].map(String)].filter(id => !openIds.has(id)));
  const completedCount = doneIds.size;
  const totalCount     = all.length + completedCount;
  const doneList = [...doneIds].map(id => {
    const api = doneApiItems.find(i => i.id === id);
    const loc = apiAllTasks.find(t => String(t.id) === id);
    const recurring = api ? !!api.recurring : !!(loc?._recurrence && loc._recurrence !== "none");
    return { id, name: api?.name ?? loc?.name ?? "Tarefa concluída", at: api?.completed_at ?? null, recurring };
  }).sort((x, y) => String(y.at ?? "").localeCompare(String(x.at ?? "")));
  const overdueCount   = overdueTasks.length;
  const timedCount     = all.filter(t => t.timed).length;
  const urgentCount    = all.filter(t => t.urgent || t.high).length;

  const dayOffset = mode === "tomorrow" ? 86400000 : 0;
  const now = new Date(clockNow - 3 * 3600 * 1000 + dayOffset);
  const dl  = `${String(now.getUTCDate()).padStart(2, "0")} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const day = DAYS[now.getUTCDay()];

  const cnt = {};
  for (const p of Object.keys(PROJ)) {
    cnt[p] = all.filter(t => t.proj === p).length;
  }

  function visible(t) {
    if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "urgent")  return t.urgent || t.high;
    if (filter === "overdue") return !!t.ts && Number(t.ts) < startOfTodayBRT;
    if (filter === "timed")   return !!t.timed;
    if (filter === "all")    return true;
    return t.proj === filter;
  }

  const metrics = [
    { key: "all",     label: "Total",         num: all.length,       cor: null },
    { key: "pessoal", label: "Pessoal",        num: cnt.pessoal || 0, cor: PROJ.pessoal.cor },
    { key: "vca",     label: "VCA Brasil",     num: cnt.vca || 0,     cor: PROJ.vca.cor },
    { key: "pdv",     label: "Ponto de Vista", num: cnt.pdv || 0,     cor: PROJ.pdv.cor },
  ];

  const rowProps = {
    clockNow, rescheduleOpen, setRescheduleOpen,
    rescheduling, completing, fading,
    rescheduleTask, completeTask,
    onEdit: setEditingTask,
  };

  const showDone     = filter === "done";
  const nothingToday = !showDone && overdueTasks.filter(visible).length === 0 && currentTasks.filter(visible).length === 0;

  // Big numbers que também são filtros (clicar de novo volta para "todas")
  const statFilters = [
    { key: "overdue", label: "atrasadas",   num: overdueCount,   color: overdueCount ? "#fb7185" : undefined, cor: "#fb7185" },
    { key: "urgent",  label: "urgentes",    num: urgentCount,    color: urgentCount ? "#fb923c" : undefined,  cor: "#fb923c" },
    { key: "timed",   label: "com horário", num: timedCount,     color: undefined,                             cor: "#38bdf8" },
    { key: "done",    label: "feitas",      num: completedCount, color: "#34d399",                             cor: "#34d399" },
  ];
  const toggleFilter = (key) => setFilter(f => (f === key ? "all" : key));

  // Projeto ativo para pré-selecionar no modal "+ Nova"
  const activeProject = ["pessoal", "vca", "pdv"].includes(filter) ? filter : undefined;

  return (
    <div className={styles.wrap}>
      <Toast message={toast?.message} onUndo={toast?.onUndo} />

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          clients={clients}
          onClose={() => setEditingTask(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      <Header
        mode={mode}
        day={day}
        dateLabel={dl}
        filter={filter}
        setFilter={setFilter}
        search={search}
        setSearch={setSearch}
        completedCount={completedCount}
        totalCount={totalCount}
        onRefresh={(msg) => { sync(); loadDoneToday(); if (msg) showToast(msg); }}
        syncing={syncing}
        activeProject={activeProject}
        clients={clients}
      />

      {/* Layout 2 colunas no desktop */}
      <div className={styles.body}>
        {/* Coluna principal: listas de tarefas */}
        <div className={styles.mainCol}>
          {/* Projetos ficam inline no celular; no computador ficam na coluna lateral */}
          <div className={styles.metricsInline}>
            <Metrics metrics={metrics} filter={filter} setFilter={setFilter} />
            <Metrics metrics={statFilters.map(f => ({ ...f, label: f.label.charAt(0).toUpperCase() + f.label.slice(1) }))} filter={filter} setFilter={setFilter} />
          </div>

          {nothingToday && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✓</span>
              <p>{filter !== "all" ? "Nenhuma tarefa nesse filtro" : mode === "today" ? "Nada pendente pra hoje" : "Nada marcado pra amanhã"}</p>
              <span className={styles.emptyHint}>Use "Nova tarefa" para adicionar.</span>
            </div>
          )}

          {showDone && (
            <div className={styles.doneList}>
              {doneList.length === 0 && <div className={styles.emptyHint}>Nenhuma tarefa concluída hoje ainda.</div>}
              {doneList.map(d => (
                <div key={d.id} className={styles.doneRow}>
                  <span className={styles.doneCheck}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  </span>
                  <span className={styles.doneName}>{d.name}</span>
                  {d.at && <span className={styles.doneTime}>{new Date(d.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
                  {d.recurring ? (
                    <span className={styles.doneRecurring} title="Recorrente: o Todoist já agendou a próxima — não dá para desfazer por aqui">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>
                    </span>
                  ) : (
                    <button
                      className={styles.undoBtn}
                      disabled={reopening.has(d.id)}
                      onClick={async () => {
                        const ok = await reopenCompleted(d.id, d.name);
                        if (ok) setDoneApiItems(prev => prev.filter(i => i.id !== d.id));
                      }}
                      title="Desfazer: voltar a tarefa para pendente"
                    >
                      {reopening.has(d.id) ? "…" : "Desfazer"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!showDone && (() => {
            // Conta tarefas VISÍVEIS (após filtro) para controlar os divisores
            const pessoalVisible = [...overdueTasks, ...currentTasks].filter(t => t.proj === "pessoal").filter(visible).length;
            const vcaVisible     = [...overdueTasks, ...currentTasks].filter(t => t.proj === "vca").filter(visible).length;
            const pdvVisible     = [...overdueTasks, ...currentTasks].filter(t => t.proj === "pdv").filter(visible).length;
            return (
              <>
                <Section proj="pessoal" cfg={PROJ.pessoal} overdue={overdueTasks} all={currentTasks} visible={visible} overdueOnly={false} rowProps={rowProps} />
                {pessoalVisible > 0 && vcaVisible > 0 && <hr className={styles.divider} />}

                <VcaSection overdue={overdueTasks} all={currentTasks} visible={visible} overdueOnly={false} rowProps={rowProps} clients={clients} />
                {vcaVisible > 0 && pdvVisible > 0 && <hr className={styles.divider} />}

                <PdvSection overdue={overdueTasks} all={currentTasks} visible={visible} overdueOnly={false} rowProps={rowProps} clients={clients} />
              </>
            );
          })()}
        </div>

        {/* Coluna lateral (computador) */}
        <div className={styles.sideCol}>
          {/* Projetos: número grande + barra proporcional; clicar filtra */}
          <div className={styles.sidePanel}>
            <div className={styles.sidePanelTitle}>Projetos</div>
            <div className={styles.metricsList}>
              {metrics.map(m => (
                <button
                  key={m.key}
                  className={`${styles.metricItem} ${filter === m.key ? styles.metricItemActive : ""}`}
                  onClick={() => setFilter(m.key)}
                  style={{ "--dot-color": m.cor ?? "#a78bfa" }}
                >
                  <span className={styles.metricTop}>
                    <span className={styles.metricLabel}>
                      {m.cor && <span className={styles.metricDot} />}
                      {m.label}
                    </span>
                    <span className={styles.metricCount}>{m.num}</span>
                  </span>
                  {m.key !== "all" && (
                    <span className={styles.metricBar}>
                      <span style={{ width: all.length ? `${(m.num / all.length) * 100}%` : "0%" }} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Big numbers que também filtram a lista */}
          <div className={styles.statGrid}>
            {statFilters.map(f => (
              <button
                key={f.key}
                className={`${styles.statBox} ${filter === f.key ? styles.statBoxActive : ""}`}
                style={{ "--stat-color": f.cor }}
                onClick={() => toggleFilter(f.key)}
                title={filter === f.key ? "Mostrar todas" : `Mostrar só ${f.label}`}
              >
                <span className={styles.statNum} style={{ color: f.num === 0 ? "#fff" : f.color }}>{f.num}</span>
                <span className={styles.statLbl}>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
