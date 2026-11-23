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
    completed, completing, fading, rescheduling,
    rescheduleTask, completeTask,
    toast, showToast,
  } = useTasks(mode);

  const [filter, setFilter]           = useState("all");
  const [search, setSearch]           = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(null);
  const [editingTask, setEditingTask]  = useState(null);
  const [clients, setClients]         = useState([]);
  const [doneApiIds, setDoneApiIds]   = useState([]); // concluídas hoje segundo o Todoist (fonte real)

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(setClients).catch(console.error);
  }, []);

  // Concluídas hoje direto do Todoist (inclui recorrentes e as feitas em outro aparelho)
  const loadDoneToday = useCallback(() => {
    if (mode !== "today") return;
    fetch("/api/tasks/completed-today")
      .then(r => r.json())
      .then(d => { if (d.ok) setDoneApiIds(d.ids); })
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
  const doneIds        = new Set([...doneApiIds, ...[...completed].map(String)].filter(id => !openIds.has(id)));
  const completedCount = doneIds.size;
  const totalCount     = all.length + completedCount;
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
    if (filter === "urgent") return t.urgent || t.high;
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

  const nothingToday = overdueTasks.length === 0 && currentTasks.filter(visible).length === 0;

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
          </div>

          {nothingToday && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✓</span>
              <p>{mode === "today" ? "Nada pendente pra hoje" : "Nada marcado pra amanhã"}</p>
              <span className={styles.emptyHint}>Use "Nova tarefa" para adicionar.</span>
            </div>
          )}

          {(() => {
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

          {/* Resumo em números */}
          <div className={styles.statGrid}>
            <div className={styles.statBox}>
              <span className={styles.statNum} style={{ color: overdueCount ? "#fb7185" : undefined }}>{overdueCount}</span>
              <span className={styles.statLbl}>atrasadas</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNum} style={{ color: urgentCount ? "#fb923c" : undefined }}>{urgentCount}</span>
              <span className={styles.statLbl}>urgentes</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNum}>{timedCount}</span>
              <span className={styles.statLbl}>com horário</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNum} style={{ color: "#34d399" }}>{completedCount}</span>
              <span className={styles.statLbl}>feitas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
