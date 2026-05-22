"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, pointerWithin,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import Toast from "@/components/ui/Toast";
import styles from "./Board.module.css";
import QuickAddModal from "@/components/Daily/QuickAddModal";
import TaskEditModal from "@/components/Daily/TaskEditModal";

const OCUPE_PROJECT_ID = "6fCfcJvXv6MjF6Pq";

// Seções que pertencem ao sub-projeto Ocupe (IDs do Todoist)
const OCUPE_SECTION_IDS = new Set([
  "6fCv5mWg8f4Pwh8q",
  "6fCgCF2xj4wCxfpq",
  "6fCgCH498pvWhMMH",
  "6fCgCHjGHrq376xH",
  "6fCgCG9j79R5Q3Jq",
  "6fCgCFQr4v7q4mWH",
]);

const MONTHS   = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WEEKDAYS = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

// ─── Helpers de data ────────────────────────────────────────────────────────

function getDateInfo(ms) {
  if (!ms) return null;
  const now       = new Date();
  const todayMs   = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0);
  const tomMs     = todayMs + 86400000;
  const taskMs    = Number(ms);

  if (taskMs < todayMs)  return { label: formatShort(taskMs), color: "var(--status-late)" };
  if (taskMs < tomMs)    return { label: "Hoje",   color: "var(--accent-primary)" };
  if (taskMs < tomMs + 86400000) return { label: "Amanhã", color: "var(--accent-warning)" };

  const d = new Date(taskMs - 3 * 3600 * 1000);
  const diff = taskMs - todayMs;
  if (diff < 6 * 86400000) {
    const SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    return { label: `${SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, color: "rgba(255,255,255,0.4)" };
  }
  return { label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, color: "rgba(255,255,255,0.35)" };
}

function formatShort(ms) {
  const d = new Date(Number(ms) - 3 * 3600 * 1000);
  const SHORT_DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  return `${SHORT_DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function formatTime(ms) {
  const d = new Date(Number(ms) - 3 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

// Formata o header de coluna no modo "Por Dia": "8 mai · Hoje"
function getDayColLabel(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const day   = d.getDate();
  const month = MONTHS[d.getMonth()];
  if (dayOffset === 0) return `${day} ${month} · Hoje`;
  if (dayOffset === 1) return `${day} ${month} · Amanhã`;
  return `${day} ${month} · ${WEEKDAYS[d.getDay()]}`;
}

// ─── Círculo de prioridade / botão de concluir ───────────────────────────────

// Cores das bordas por prioridade — círculo nunca preenchido por padrão
const PRIO_COLORS = {
  p1: "#f87171",              // urgente
  p2: "#fb923c",              // alta
  p3: "#60a5fa",              // normal
  p4: "rgba(255,255,255,0.2)", // baixa
};

function PriorityCircle({ prio, onClick }) {
  const color = PRIO_COLORS[prio] || "rgba(255,255,255,0.22)";
  return (
    <button
      className={styles.circle}
      onClick={onClick}
      title="Marcar como concluída"
      style={{ borderColor: color }}
    />
  );
}

// ─── Card de tarefa ──────────────────────────────────────────────────────────

function SortableTaskCard({ t, onComplete, onReschedule, onEdit, columnId, showSection }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: t.id, data: { column: columnId } });

  const dateInfo = getDateInfo(t.due_date);

  return (
    <div
      ref={setNodeRef}
      data-nodrag
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className={styles.card}
    >
      {/* Drag handle — aparece só no hover via CSS */}
      <div className={styles.dragArea} {...attributes} {...listeners}>
        <span className={styles.dragDots}>⠿</span>
      </div>

      {/* Círculo prioridade / concluir */}
      <PriorityCircle prio={t._priority} onClick={() => onComplete(t.id)} />

      {/* Conteúdo */}
      <div
        className={styles.cardBody}
        onClick={() => onEdit && onEdit(t)}
        style={{ cursor: onEdit ? "pointer" : "default" }}
      >
        <span className={styles.cardName}>{t.name}</span>

        <div className={styles.cardMeta}>
          {dateInfo && (
            <span className={styles.cardDate} style={{ color: dateInfo.color }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="3" width="14" height="12" rx="2"/>
                <path d="M5 1v4M11 1v4M1 7h14"/>
              </svg>
              {dateInfo.label}
              {t.due_date_time && t.due_date && (
                <span style={{ opacity: 0.85 }}> · {formatTime(t.due_date)}</span>
              )}
              {t._repeat_forever && <span className={styles.recIcon}>↻</span>}
            </span>
          )}
          {showSection && t._sub_client_label && (
            <span className={styles.sectionLabel}>/{t._sub_client_label}</span>
          )}
        </div>
      </div>

      {/* Reagendar — aparece no hover via CSS */}
      <button
        className={styles.rescheduleBtn}
        onClick={() => onReschedule(t.id)}
        title="Amanhã"
      >
        →
      </button>
    </div>
  );
}

function DragGhostCard({ t }) {
  return (
    <div className={`${styles.card} ${styles.dragGhost}`}>
      <div className={styles.circle} style={{ borderColor: "rgba(255,255,255,0.2)" }} />
      <div className={styles.cardBody}>
        <span className={styles.cardName}>{t?.name || "..."}</span>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [tasks, setTasks]               = useState([]);
  const [clients, setClients]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeProject, setActiveProject] = useState("vca");
  const [vcaSubFilter, setVcaSubFilter] = useState("interno");
  const [viewMode, setViewMode]         = useState("detailed");
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [maxDays, setMaxDays]           = useState(7);
  const [activeTask, setActiveTask]     = useState(null);
  const [editTask, setEditTask]         = useState(null);
  const [toast, setToast]               = useState(null);
  const boardRef = useRef(null);

  function showToast(message, type = "success") {
    const key = Date.now();
    setToast({ message, type, key });
    setTimeout(() => setToast(t => t?.key === key ? null : t), 2500);
  }

  // Scroll horizontal por roda do mouse (não conflita com dnd-kit)
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e) => {
      // Se já há scroll horizontal nativo (trackpad), não interfere
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag-to-scroll: funciona porque boardWrap está FORA do DndContext
  const handleBoardPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.tagName === 'BUTTON' || e.target.closest('[data-nodrag]')) return;
    const el = boardRef.current;
    if (!el) return;
    const startX      = e.clientX;
    const startScroll = el.scrollLeft;
    // Injeta style global para forçar cursor em todos os filhos
    const styleEl = document.createElement('style');
    styleEl.textContent = '* { cursor: grabbing !important; user-select: none !important; }';
    document.head.appendChild(styleEl);
    const onMove = (ev) => { el.scrollLeft = startScroll - (ev.clientX - startX); };
    const onUp   = ()   => {
      styleEl.remove();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  async function load() {
    try {
      const [tRes, cRes] = await Promise.all([
        fetch("/api/tasks?mode=all"),
        fetch("/api/clients"),
      ]);
      const tData = await tRes.json();
      setTasks(Array.isArray(tData) ? tData : tData.tasks || []);
      setClients(await cRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // Auto-refresh ao voltar para a aba ou ganhar foco (usuário edita no Todoist e volta)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    const onFocus   = () => load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Pull-to-refresh no mobile (swipe down a partir do topo)
  useEffect(() => {
    let startY = 0;
    const onStart = (e) => { startY = e.touches[0].clientY; };
    const onEnd   = (e) => {
      if (e.changedTouches[0].clientY - startY > 80 && window.scrollY === 0) load();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend",   onEnd);
    };
  }, []);

  async function handleComplete(taskId) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (navigator.vibrate) navigator.vibrate(50);
      showToast("✓ Tarefa concluída");
      setTimeout(load, 1500);
    } catch (e) {
      console.error("Erro ao concluir tarefa:", e);
      showToast("⚠️ Erro ao concluir. Tente novamente.", "error");
      load();
    }
  }

  async function handleReschedule(taskId) {
    const now = new Date();
    const tomorrowBRT = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 3, 0, 0);
    try {
      await fetch("/api/tasks/reschedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, dueDate: tomorrowBRT, timed: false }) });
      showToast("→ Reagendado");
    } catch (e) {
      console.error("Erro ao reagendar:", e);
      showToast("⚠️ Erro ao reagendar.", "error");
    }
    load();
  }

  const filteredTasks = tasks.filter(t => {
    if (t._project_id !== activeProject) return false;
    if (activeProject === "vca" && viewMode === "detailed") {
      const isOcupe = t.list?.id === OCUPE_PROJECT_ID;
      return vcaSubFilter === "ocupe" ? isOcupe : !isOcupe;
    }
    return true;
  });

  const projectClients = clients.filter(c => c.project_id === activeProject);

  // Para VCA em modo "Por Marca": filtrar seções pelo sub-projeto ativo
  const columnsToShow = (() => {
    if (activeProject !== "vca" || viewMode === "day") return projectClients;
    return projectClients.filter(c =>
      vcaSubFilter === "ocupe"
        ? OCUPE_SECTION_IDS.has(c.cf_value)
        : !OCUPE_SECTION_IDS.has(c.cf_value)
    );
  })();

  function getTasksForClient(sectionId) {
    return filteredTasks.filter(t => t._section_id === sectionId);
  }

  const unassignedTasks = filteredTasks.filter(t => activeProject === "pessoal" || !t._section_id);

  function handleDragStart(e) { setActiveTask(tasks.find(t => t.id === e.active.id) || null); }

  // Converte ID de coluna do modo "Por Dia" em timestamp BRT
  function dayGroupToMs(groupId) {
    const n = new Date();
    if (groupId === "overdue") return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 3, 0, 0);
    if (groupId.startsWith("day-")) {
      const offset = parseInt(groupId.split("-")[1], 10);
      return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + offset, 3, 0, 0);
    }
    return null; // "future" / "nodate" — sem data definida
  }

  async function handleDragEnd(e) {
    const { active, over } = e;
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    const src = active.data.current?.column;
    const dst = over.data.current?.column ?? over.id;

    // Reorder na mesma coluna — apenas visual, Todoist não tem ordem garantida via REST
    if (src === dst) {
      setTasks(prev => {
        const ids = prev.filter(t => t._section_id === src).map(t => t.id);
        const oi = ids.indexOf(active.id), ni = ids.indexOf(over.id);
        if (oi === -1 || ni === -1) return prev;
        const reordered = new Set(arrayMove(ids, oi, ni));
        return [...prev.filter(t => !reordered.has(t.id)), ...[...reordered].map(id => prev.find(t => t.id === id))];
      });
      return;
    }

    const task = tasks.find(t => t.id === active.id);
    if (!task) return;

    if (viewMode === "day") {
      // ── Vista "Por Dia": arrastar entre colunas = mudar due_date ──────────
      const targetDayMs = dayGroupToMs(dst);
      if (targetDayMs === null) return; // não arrasta para "Futuras" ou "Sem data"

      // Para tarefas com horário: preserva o offset de tempo no novo dia
      let targetMs = targetDayMs;
      if (task.due_date_time) {
        const taskMs = Number(task.due_date);
        const d = new Date(taskMs - 3 * 3600 * 1000);
        const taskDayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 0, 0);
        targetMs = targetDayMs + (taskMs - taskDayStart);
      }

      // Optimistic: move para a nova coluna de dia
      setTasks(prev => prev.map(t =>
        t.id === active.id ? { ...t, due_date: String(targetMs) } : t
      ));

      try {
        await fetch("/api/tasks/reschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId:      active.id,
            dueDate:     targetMs,
            timed:       task.due_date_time ?? false,
            isRecurring: task._repeat_forever ?? false,
            recurrence:  task._recurrence ?? null,
          }),
        });
        setTimeout(load, 1000);
      } catch { load(); }

    } else {
      // ── Vista "Por Marca/Cliente": arrastar entre colunas = mudar seção ──
      setTasks(prev => prev.map(t =>
        t.id === active.id ? { ...t, _section_id: dst } : t
      ));

      try {
        await fetch("/api/tasks/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: active.id, subClient: dst }),
        });
        setTimeout(load, 1000);
      } catch { load(); }
    }
  }

  function getTasksByDay() {
    // Início do dia em BRT (UTC-3) = 3h UTC, igual à visão Hoje
    const now = new Date();
    const todayBRT = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0);
    const groups = [];

    const overdue = filteredTasks.filter(t => t.due_date && Number(t.due_date) < todayBRT);
    if (overdue.length) groups.push({ id: "overdue", label: "Atrasada", tasks: overdue, isOverdue: true });

    for (let i = 0; i < maxDays; i++) {
      const cur  = todayBRT + i * 86400000;
      const next = cur + 86400000;
      const dayTasks = filteredTasks.filter(t => {
        if (!t.due_date) return false;
        const ms = Number(t.due_date);
        return ms >= cur && ms < next;
      });
      groups.push({ id: `day-${i}`, label: getDayColLabel(i), tasks: dayTasks, dayOffset: i });
    }

    const limitBRT = todayBRT + maxDays * 86400000;
    const future = filteredTasks.filter(t => t.due_date && Number(t.due_date) >= limitBRT);
    if (future.length) groups.push({ id: "future", label: "Futuras", tasks: future, canExpand: true });

    const noDate = filteredTasks.filter(t => !t.due_date);
    if (noDate.length) groups.push({ id: "nodate", label: "Sem data", tasks: noDate });

    return groups;
  }

  if (loading) return <div className={styles.loading}>Carregando...</div>;

  const dayGroups = getTasksByDay();
  const isDay     = viewMode === "day";

  const PROJ_ACCENT = { vca: "#5b9fd6", pdv: "#818cf8", pessoal: "#94a3b8" };
  const accent = PROJ_ACCENT[activeProject] || "#06b6d4";

  const COLOR_LEGEND = [
    { color: 'var(--accent-primary)', label: 'No prazo' },
    { color: 'var(--accent-warning)', label: 'Vence amanhã' },
    { color: 'var(--status-late)',    label: 'Atrasada' },
  ];

  return (
    <div className={styles.container}>
        <Toast message={toast?.message} type={toast?.type} />
        <ModuleHeader title="Projetos" showConfig />

        {/* Tabs de projeto + toggle de visão */}
        <header className={styles.header}>
          <div className={styles.topNav}>
            <div className={styles.projectTabs}>
              {["pessoal","vca","pdv"].map(p => (
                <button key={p}
                  className={`${styles.tabBtn} ${activeProject === p ? styles.tabActive : ""}`}
                  style={activeProject === p ? { color: PROJ_ACCENT[p], borderColor: PROJ_ACCENT[p] + "55", background: PROJ_ACCENT[p] + "18" } : {}}
                  onClick={() => { setActiveProject(p); setViewMode("detailed"); setVcaSubFilter("interno"); }}
                >
                  {p === "pessoal" ? "Pessoal" : p === "vca" ? "VCA Brasil" : "Ponto de Vista"}
                </button>
              ))}
            </div>
            <div className={styles.viewToggle}>
              <button className={`${styles.toggleBtn} ${!isDay ? styles.toggleActive : ""}`} onClick={() => setViewMode("detailed")}>
                {activeProject === "vca" ? "Por Marca" : activeProject === "pdv" ? "Por Cliente" : "Lista"}
              </button>
              <button className={`${styles.toggleBtn} ${isDay ? styles.toggleActive : ""}`} onClick={() => setViewMode("day")}>
                Por Dia
              </button>
            </div>
          </div>

          {activeProject === "vca" && !isDay && (
            <div className={styles.subFilterBar}>
              <button className={`${styles.subBtn} ${vcaSubFilter === "interno" ? styles.subActive : ""}`} onClick={() => setVcaSubFilter("interno")}>Gestão Interna</button>
              <button className={`${styles.subBtn} ${vcaSubFilter === "ocupe" ? styles.subActive : ""}`}   onClick={() => setVcaSubFilter("ocupe")}>Agência Ocupe</button>
            </div>
          )}

          {/* Legenda de cores */}
          <div className={styles.colorLegend}>
            {COLOR_LEGEND.map(({ color, label }) => (
              <span key={label} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </header>

        {/* Board — boardWrap fora do DndContext para drag-to-scroll funcionar */}
        <div className={styles.boardWrap} ref={boardRef} onPointerDown={handleBoardPointerDown}>
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={styles.columns}>

            {!isDay && (
              <>
                {activeProject !== "pessoal" && columnsToShow.map(client => {
                  const ct = getTasksForClient(client.cf_value);
                  const pct = filteredTasks.length > 0 ? Math.round((ct.length / Math.max(filteredTasks.length / columnsToShow.length, 1)) * 100) : 0;
                  return (
                    <SortableContext key={client.id} id={client.cf_value} items={ct.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      <div className={styles.column}>
                        <div className={styles.colHead}>
                          <span className={styles.colName} style={{ color: accent }} title={client.name}>
                            {client.name.toUpperCase()}
                          </span>
                          <span className={styles.colCount}>{ct.length}</span>
                        </div>
                        {/* Barra de progresso por coluna */}
                        <div className={styles.colProgress}>
                          <div
                            className={styles.colProgressFill}
                            style={{ width: `${Math.min(pct, 100)}%`, background: accent }}
                          />
                        </div>
                        <div className={styles.taskSlot}>
                          {ct.map(t => <SortableTaskCard key={t.id} t={t} columnId={client.cf_value} onComplete={handleComplete} onReschedule={handleReschedule} onEdit={setEditTask} showSection={false} />)}
                          {ct.length === 0 && <div className={styles.emptySlot}>Sem tarefas</div>}
                        </div>
                        <button className={styles.addTaskBtn} onClick={() => { setSelectedClient(client); setIsModalOpen(true); }}>
                          + Adicionar tarefa
                        </button>
                      </div>
                    </SortableContext>
                  );
                })}

                {/* Pessoal ou tarefas sem seção */}
                {(activeProject === "pessoal" || unassignedTasks.length > 0) && (
                  <SortableContext items={unassignedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className={styles.column}>
                      <div className={styles.colHead}>
                        <span className={styles.colName} style={{ color: accent }}>
                          {activeProject === "pessoal" ? "PESSOAL" : "GERAL"}
                        </span>
                        <span className={styles.colCount}>{unassignedTasks.length}</span>
                      </div>
                      <div className={styles.taskSlot}>
                        {unassignedTasks.map(t => <SortableTaskCard key={t.id} t={t} columnId="unassigned" onComplete={handleComplete} onReschedule={handleReschedule} onEdit={setEditTask} showSection={false} />)}
                      </div>
                      <button className={styles.addTaskBtn} onClick={() => { setSelectedClient(null); setIsModalOpen(true); }}>
                        + Adicionar tarefa
                      </button>
                    </div>
                  </SortableContext>
                )}
              </>
            )}

            {/* ── Vista Por Dia ── */}
            {isDay && dayGroups.map(group => (
              <SortableContext key={group.id} items={group.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.column}>
                  <div className={`${styles.colHead} ${group.isOverdue ? styles.colHeadOverdue : ""}`}>
                    <div className={styles.colHeadDay}>
                      <span className={styles.colName}>{group.label}</span>
                      <span className={`${styles.colCount} ${group.dayOffset === 0 ? styles.colCountToday : ""} ${group.isOverdue ? styles.colCountOverdue : ""}`}>
                        {group.tasks.length}
                      </span>
                    </div>
                    {group.isOverdue && (
                      <button className={styles.rescheduleAllBtn} onClick={() => group.tasks.forEach(t => handleReschedule(t.id))}>
                        Reagendar
                      </button>
                    )}
                  </div>
                  {/* Barra indicadora do dia */}
                  {group.dayOffset === 0 && (
                    <div className={styles.colProgress}>
                      <div className={styles.colProgressFill} style={{ width: '100%', background: 'var(--accent-primary)' }} />
                    </div>
                  )}
                  <div className={styles.taskSlot}>
                    {group.tasks.map(t => <SortableTaskCard key={t.id} t={t} columnId={group.id} onComplete={handleComplete} onReschedule={handleReschedule} onEdit={setEditTask} showSection={activeProject !== "pessoal"} />)}
                    {group.tasks.length === 0 && <div className={styles.emptySlot}>Livre 🎉</div>}
                    {group.canExpand && group.tasks.length > 0 && (
                      <button className={styles.expandBtn} onClick={() => setMaxDays(p => p + 7)}>Ver mais 7 dias</button>
                    )}
                  </div>
                  {group.dayOffset === 0 && (
                    <button className={styles.addTaskBtn} onClick={() => setIsModalOpen(true)}>
                      + Adicionar tarefa
                    </button>
                  )}
                </div>
              </SortableContext>
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 150 }}>
            {activeTask ? <DragGhostCard t={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
        </div>

        {isModalOpen && (
          <QuickAddModal
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => { setIsModalOpen(false); load(); }}
            initialProjectId={activeProject}
            initialSubClientId={selectedClient?.cf_value}
          />
        )}
        {editTask && (
          <TaskEditModal
            task={editTask}
            clients={clients}
            onClose={() => setEditTask(null)}
            onSuccess={() => { setEditTask(null); load(); }}
          />
        )}
        <Navigation />
    </div>
  );
}
