import { getHeat, getNextDueDate } from "../../utils/helpers";
import { HEAT_COLOR, MONTHS } from "../../config/constants";
import DatePickerButton from "../ui/DatePickerButton";
import styles from "./TaskRow.module.css";

const PRIO_RING = { p1: "#ff5a5f", p2: "#fb923c", p3: "#fbbf24" };
const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
// "ter 24" a partir de um instante (dia em BRT)
function fmtDay(ms) {
  const d = new Date(Number(ms) - 3 * 3600 * 1000);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()}`;
}

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
    { label: "hoje",   toastLabel: "hoje",           ms: startOfTodayBRT               + timeOffset },
    { label: "amanhã", toastLabel: "amanhã",         ms: startOfTodayBRT + 1*86400000  + timeOffset },
    { label: "semana", toastLabel: "semana que vem", ms: startOfTodayBRT + 7*86400000  + timeOffset },
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
        style={taskBorderLeft ? { "--heat": HEAT_COLOR[heat] } : {}}
      >
        <button
          onClick={() => completeTask(t.id, t.name)}
          disabled={busy || fadingOut}
          className={styles.checkBtn}
          style={{ "--prio": PRIO_RING[t.prio] ?? "rgba(255,255,255,0.28)" }}
          title="Concluir tarefa"
        >
          {completing.has(t.id) ? <span className={styles.checkDots}>…</span> : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
          )}
        </button>
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
          {t.description && (
            <span className={`${styles.badge} ${styles.badgeDesc}`} title="Tem descrição">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="3" width="14" height="2" rx="1"/><rect x="1" y="7" width="10" height="2" rx="1"/><rect x="1" y="11" width="12" height="2" rx="1"/>
              </svg>
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
          {rescheduling.has(t.id) ? "…" : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M10 15.5h5M13 13l2.5 2.5L13 18"/></svg>
          )}
        </button>
        
      </div>
      
      {isOpen && (
        <div className={styles.reschedulePanel}>
          <span className={styles.panelLabel}>Mover para</span>
          <div className={styles.panelChips}>
            {t._recurrence && t._recurrence !== "none" && (
              <button
                onClick={() => { setRescheduleOpen(null); completeTask(t.id, t.name); }}
                className={`${styles.rescheduleChip} ${styles.chipNext}`}
                title="Conclui esta e o Todoist agenda a próxima repetição"
              >
                <span className={styles.chipMain}>Próxima ocorrência</span>
                <span className={styles.chipSub}>recorrente</span>
              </button>
            )}
            {rescheduleOptions.map(opt => (
              <button
                key={opt.label}
                onClick={() => rescheduleTask(t.id, opt.ms, t.timed, t._repeat_forever, t._recurrence, opt.toastLabel)}
                className={styles.rescheduleChip}
              >
                <span className={styles.chipMain}>{opt.label === "semana" ? "Em 1 semana" : opt.label.charAt(0).toUpperCase() + opt.label.slice(1)}</span>
                <span className={styles.chipSub}>{fmtDay(opt.ms)}</span>
              </button>
            ))}
            <DatePickerButton onSelect={dateStr => {
              const [y,m,d] = dateStr.split("-").map(Number);
              const label = `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}`;
              rescheduleTask(t.id, Date.UTC(y, m-1, d, 3, 0, 0) + timeOffset, t.timed, t._repeat_forever, t._recurrence, label);
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
