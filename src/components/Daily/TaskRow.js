import { getHeat, getNextDueDate } from "../../utils/helpers";
import { HEAT_COLOR, MONTHS } from "../../config/constants";
import DatePickerButton from "../ui/DatePickerButton";
import styles from "./TaskRow.module.css";

export default function TaskRow({ 
  t, 
  od, 
  clockNow, 
  rescheduleOpen, 
  setRescheduleOpen, 
  rescheduling, 
  completing, 
  fading, 
  rescheduleTask, 
  completeTask,
  onEdit,
  showContext
}) {
  const busy = completing.has(t.id) || rescheduling.has(t.id);
  const fadingOut = fading.has(t.id);
  const heat = t.timed && !od ? getHeat(t.ts, clockNow) : null;
  const timeColor = heat ? HEAT_COLOR[heat] : "var(--text-secondary)";
  const isOpen = rescheduleOpen === t.id;

  const startOfTodayBRT = (() => {
    const n = new Date(clockNow - 3*3600*1000);
    return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 3, 0, 0);
  })();
  
  const taskDayStartBRT = (() => {
    const d = new Date(Number(t.ts) - 3*3600*1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 0, 0);
  })();
  
  const timeOffset = t.timed ? (t.ts - taskDayStartBRT) : 0;

  // Label de atraso: "15 mai" ou "15 mai 19:40" para tarefas com horário
  const overdueLabel = od && t.ts ? (() => {
    const d = new Date(Number(t.ts) - 3 * 3600 * 1000);
    const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    return t.timed ? `${base} ${t.hm}` : base;
  })() : null;

  const rescheduleOptions = [
    { label: "hoje",   ms: startOfTodayBRT               + timeOffset },
    { label: "amanhã", ms: startOfTodayBRT + 1*86400000  + timeOffset },
    { label: "semana", ms: startOfTodayBRT + 7*86400000  + timeOffset },
  ];

  // Estilos da linha
  let rowClass = styles.taskRow;
  if (od)       rowClass += ` ${styles.overdue}`;
  else if (t.urgent) rowClass += ` ${styles.urgent}`;
  else if (t.high)   rowClass += ` ${styles.high}`;

  const taskBorderLeft = heat
    ? `3px solid ${HEAT_COLOR[heat]}`
    : undefined;

  let contextLabel = null;
  let contextColor = "linear-gradient(135deg, #333, #555)";
  
  if (showContext && t.proj) {
    if (t.proj === "vca") {
      contextLabel = "VCA Brasil";
      contextColor = "linear-gradient(135deg, #3b82f6, #8b5cf6)";
    } else if (t.proj === "pdv") {
      contextLabel = "Ponto de Vista";
      contextColor = "linear-gradient(135deg, #f59e0b, #ec4899)";
    } else if (t.proj === "pessoal") {
      contextLabel = "Pessoal";
      contextColor = "linear-gradient(135deg, #94a3b8, #475569)";
    }
  }

  return (
    <div 
      className={`${styles.taskContainer} ${fadingOut ? styles.fadingOut : ""} ${busy ? styles.busy : ""}`}
    >
      <div 
        className={rowClass}
        style={taskBorderLeft ? { borderLeft: taskBorderLeft } : {}}
      >
        <div
          onClick={() => onEdit && onEdit(t)}
          className={styles.taskLink}
          style={{ cursor: "pointer" }}
        >
          {od && overdueLabel ? (
            <span className={styles.taskTime} style={{ color: "var(--status-late)", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                <rect x="1" y="3" width="14" height="12" rx="2"/>
                <path d="M5 1v4M11 1v4M1 7h14"/>
              </svg>
              {overdueLabel}
            </span>
          ) : (
            t.timed && <span className={styles.taskTime} style={{ color: timeColor }}>{t.hm}</span>
          )}
          <div className={styles.taskMeta}>
            <span className={styles.taskName}>{t.name}</span>
            {t._sub_client_label && (
              <span className={styles.taskSub}>{t._sub_client_label}</span>
            )}
          </div>
        </div>
        
        <div className={styles.badges}>
          {showContext && contextLabel && (
            <span className={`${styles.badge} ${styles.badgeContext}`} style={{ background: contextColor }}>
              {contextLabel}
            </span>
          )}
          {t.prio === "p1" && <span className={`${styles.badge} ${styles.badgeUrgent}`}>P1</span>}
          {t.prio === "p2" && <span className={`${styles.badge} ${styles.badgeHigh}`}>P2</span>}
          {t.prio === "p3" && <span className={`${styles.badge} ${styles.badgeNormal}`}>P3</span>}
          {t.prio === "p4" && <span className={`${styles.badge} ${styles.badgeLow}`}>P4</span>}
        </div>
        
        <button
          onClick={() => setRescheduleOpen(isOpen ? null : t.id)}
          disabled={busy || fadingOut}
          className={`${styles.actionBtn} ${isOpen ? styles.rescheduleOpenBtn : styles.rescheduleBtn}`}
          title="Reagendar"
        >
          {rescheduling.has(t.id) ? "…" : "→"}
        </button>
        
        <button
          onClick={() => completeTask(t.id)}
          disabled={busy || fadingOut}
          className={`${styles.actionBtn} ${styles.completeBtn}`}
          title="Concluir tarefa"
        >
          {completing.has(t.id) ? "…" : "✓"}
        </button>
      </div>
      
      {isOpen && (
        <div className={styles.reschedulePanel}>
          {t._recurrence && t._recurrence !== "none" && (
            <button
              onClick={() => { setRescheduleOpen(null); completeTask(t.id); }}
              className={styles.rescheduleChip}
              style={{ background: "rgba(99,102,241,0.25)", borderColor: "rgba(99,102,241,0.5)" }}
            >
              próxima
            </button>
          )}
          {rescheduleOptions.map(opt => (
            <button
              key={opt.label}
              onClick={() => rescheduleTask(t.id, opt.ms, t.timed, t._repeat_forever, t._recurrence)}
              className={styles.rescheduleChip}
            >
              {opt.label}
            </button>
          ))}
          <DatePickerButton onSelect={dateStr => {
            const [y,m,d] = dateStr.split("-").map(Number);
            rescheduleTask(t.id, Date.UTC(y, m-1, d, 3, 0, 0) + timeOffset, t.timed, t._repeat_forever, t._recurrence);
          }} />
        </div>
      )}
    </div>
  );
}
