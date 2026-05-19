"use client";

import { useState, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "./Calendar.module.css";

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAY_NAMES   = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const PROJ_COLORS = { vca: "#5b9fd6", pdv: "#818cf8", pessoal: "#94a3b8" };

// Heatmap por quantidade de tarefas no dia
function getHeatBg(count) {
  if (count === 0) return 'transparent';
  if (count <= 2)  return 'rgba(0,229,160,0.07)';
  if (count <= 5)  return 'rgba(0,229,160,0.13)';
  if (count <= 10) return 'rgba(251,191,36,0.12)';
  return 'rgba(249,115,22,0.18)';
}
function getHeatBorder(count) {
  if (count === 0) return 'rgba(255,255,255,0.05)';
  if (count <= 5)  return 'rgba(0,229,160,0.18)';
  if (count <= 10) return 'rgba(251,191,36,0.22)';
  return 'rgba(249,115,22,0.3)';
}

export default function CalendarPage() {
  const now = new Date();
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth());
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/tasks?mode=all")
      .then(r => r.json())
      .then(json => setTasks(json.tasks || []))
      .finally(() => setLoading(false));
  }, []);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelected(null); setDrawerOpen(false);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelected(null); setDrawerOpen(false);
  }

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks      = Array.from({ length: firstDay });
  const days        = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function getTasksForDay(d) {
    return tasks.filter(t => {
      if (!t.due_date) return false;
      const td = new Date(Number(t.due_date));
      return td.getUTCFullYear() === year && td.getUTCMonth() === month && td.getUTCDate() === d;
    });
  }

  const isToday = (d) => d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  const selectedTasks = selected ? getTasksForDay(selected) : [];

  function handleDayClick(d) {
    setSelected(d);
    setDrawerOpen(true);
  }

  return (
    <div className={styles.container}>
      <ModuleHeader title="Agenda" showConfig />

      <header className={styles.header}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={prevMonth}>‹</button>
          <h1 className={styles.monthTitle}>{MONTH_NAMES[month]} {year}</h1>
          <button className={styles.navBtn} onClick={nextMonth}>›</button>
        </div>
        <p className={styles.subtitle}>Carga de trabalho mensal</p>
      </header>

      {loading ? (
        <div className={styles.loading}>Mapeando datas...</div>
      ) : (
        <>
          <div className={styles.calendarGrid}>
            {DAY_NAMES.map((d, i) => (
              <div key={d} className={`${styles.dayHead} ${(i === 0 || i === 6) ? styles.weekendHead : ''}`}>{d}</div>
            ))}
            {blanks.map((_, i) => <div key={`b-${i}`} className={styles.blank} />)}
            {days.map(d => {
              const dayTasks = getTasksForDay(d);
              const count = dayTasks.length;
              const absoluteIdx = (firstDay + d - 1) % 7;
              const isWeekend = absoluteIdx === 0 || absoluteIdx === 6;
              return (
                <div
                  key={d}
                  className={`${styles.day} ${isToday(d) ? styles.today : ''} ${selected === d ? styles.selected : ''} ${isWeekend ? styles.weekend : ''}`}
                  style={{ background: getHeatBg(count), borderColor: getHeatBorder(count) }}
                  onClick={() => handleDayClick(d)}
                >
                  <span className={styles.dayNum}>{d}</span>
                  {count > 0 && <span className={styles.dayCount}>{count}</span>}
                </div>
              );
            })}
          </div>

          {/* Legenda de heatmap */}
          <div className={styles.legend}>
            {[
              { bg:'rgba(0,229,160,0.13)', b:'rgba(0,229,160,0.18)', label:'1–5 tarefas' },
              { bg:'rgba(251,191,36,0.12)', b:'rgba(251,191,36,0.22)', label:'6–10 tarefas' },
              { bg:'rgba(249,115,22,0.18)', b:'rgba(249,115,22,0.3)', label:'+10 tarefas' },
            ].map(({ bg, b, label }) => (
              <span key={label} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: bg, borderColor: b }} />
                {label}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Drawer lateral de detalhes do dia */}
      {drawerOpen && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />
          <aside className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.drawerMonthLabel}>{MONTH_NAMES[month]} {year}</p>
                <h2 className={styles.drawerTitle}>Dia {selected}</h2>
              </div>
              <button className={styles.drawerClose} onClick={() => setDrawerOpen(false)}>×</button>
            </div>
            <div className={styles.drawerCount}>
              {selectedTasks.length} tarefa{selectedTasks.length !== 1 ? 's' : ''}
            </div>
            {selectedTasks.length === 0 ? (
              <div className={styles.drawerEmpty}>
                <span style={{ fontSize:36 }}>📭</span>
                <p>Nenhuma tarefa neste dia.</p>
              </div>
            ) : (
              <div className={styles.drawerList}>
                {selectedTasks.map(t => (
                  <div key={t.id} className={styles.drawerItem}>
                    <div className={styles.drawerDot} style={{ background: PROJ_COLORS[t._project_id] || '#555' }} />
                    <div className={styles.drawerInfo}>
                      <span className={styles.drawerName}>{t.name}</span>
                      {t._sub_client_label && <span className={styles.drawerSubLabel}>{t._sub_client_label}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </>
      )}

      <Navigation />
    </div>
  );
}
