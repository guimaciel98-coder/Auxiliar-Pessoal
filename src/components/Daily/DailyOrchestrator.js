"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  const [rescheduleOpen, setRescheduleOpen] = useState(null);
  const [editingTask, setEditingTask]  = useState(null);
  const [clients, setClients]         = useState([]);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(setClients).catch(console.error);
  }, []);

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

  const completedCount = completed.size;
  const totalCount = all.length + completedCount;

  const dayOffset = mode === "tomorrow" ? 86400000 : 0;
  const now = new Date(clockNow - 3 * 3600 * 1000 + dayOffset);
  const dl  = `${String(now.getUTCDate()).padStart(2, "0")} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const day = DAYS[now.getUTCDay()];

  const cnt = {};
  for (const p of Object.keys(PROJ)) {
    cnt[p] = all.filter(t => t.proj === p).length;
  }

  function visible(t) {
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
      <Toast message={toast?.message} />

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          clients={clients}
          onClose={() => setEditingTask(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      <Header
        day={day}
        dateLabel={dl}
        filter={filter}
        setFilter={setFilter}
        completedCount={completedCount}
        totalCount={totalCount}
        onRefresh={(msg) => { sync(); if (msg) showToast(msg); }}
        syncing={syncing}
        activeProject={activeProject}
        clients={clients}
      />

      {/* Navegação Hoje ↔ Amanhã */}
      <div style={{ display:"flex", gap:6, padding:"0 16px 8px", marginTop:-4 }}>
        <Link
          href="/daily"
          style={{
            fontSize:11, fontWeight:700, letterSpacing:"0.04em",
            padding:"4px 10px", borderRadius:6, textDecoration:"none",
            background: mode === "today" ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.04)",
            color:       mode === "today" ? "#00e5a0"              : "var(--text-muted)",
            border:`1px solid ${mode === "today" ? "rgba(0,229,160,0.35)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          Hoje
        </Link>
        <Link
          href="/tomorrow"
          style={{
            fontSize:11, fontWeight:700, letterSpacing:"0.04em",
            padding:"4px 10px", borderRadius:6, textDecoration:"none",
            background: mode === "tomorrow" ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.04)",
            color:       mode === "tomorrow" ? "#00e5a0"              : "var(--text-muted)",
            border:`1px solid ${mode === "tomorrow" ? "rgba(0,229,160,0.35)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          Amanhã
        </Link>
      </div>

      {/* Layout 2 colunas no desktop */}
      <div className={styles.body}>
        {/* Coluna principal: listas de tarefas */}
        <div className={styles.mainCol}>
          {/* Métricas ficam inline no mobile; no desktop ficam no sideCol */}
          <div className={styles.metricsInline}>
            <Metrics metrics={metrics} filter={filter} setFilter={setFilter} />
          </div>

          {nothingToday && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✅</span>
              <p>Nenhuma tarefa para hoje!</p>
              <span className={styles.emptyHint}>Use "+ Nova" para adicionar uma tarefa.</span>
            </div>
          )}

          {(() => {
            // Conta tarefas VISÍVEIS (após filtro) para controlar os dividers
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

        {/* Coluna lateral: métricas + resumo (desktop only) */}
        <div className={styles.sideCol}>
          {/* Painel de contadores por projeto */}
          <div className={styles.sidePanel}>
            <div className={styles.sidePanelTitle}>Projetos</div>
            <div className={styles.metricsList}>
              {metrics.map(m => (
                <div
                  key={m.key}
                  className={`${styles.metricItem} ${filter === m.key ? styles.metricItemActive : ""}`}
                  onClick={() => setFilter(m.key)}
                  style={m.cor ? { "--dot-color": m.cor } : {}}
                >
                  <span className={styles.metricLabel}>
                    {m.cor && (
                      <span style={{
                        display: "inline-block", width: 7, height: 7,
                        borderRadius: "50%", background: m.cor,
                        marginRight: 8, verticalAlign: "middle",
                      }} />
                    )}
                    {m.label}
                  </span>
                  <span className={styles.metricCount}>{m.num}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Painel de progresso do dia */}
          <div className={styles.sidePanel}>
            <div className={styles.sidePanelTitle}>Progresso</div>
            <div style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>
                  {completedCount}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ {totalCount} concluídas</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}%` : "0%",
                  background: "linear-gradient(90deg, var(--accent-primary), var(--accent-success))",
                  borderRadius: 99,
                  transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
                  boxShadow: "0 0 8px rgba(0,229,160,0.4)",
                }} />
              </div>
              {totalCount > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "right" }}>
                  {Math.round((completedCount / totalCount) * 100)}% do dia
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
