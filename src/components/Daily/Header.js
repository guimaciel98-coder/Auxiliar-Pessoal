"use client";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import styles from "./Header.module.css";
import QuickAddModal from "./QuickAddModal";

export default function Header({
  day, dateLabel,
  filter, setFilter,
  search, setSearch,
  completedCount, totalCount,
  onRefresh, syncing,
  activeProject,
  clients,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [hasFired, setHasFired] = useState(false);
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (progressPercent === 100 && totalCount > 0 && !hasFired) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ["#10b981","#3b82f6","#f59e0b","#ec4899","#8b5cf6"] });
      setHasFired(true);
    } else if (progressPercent < 100) {
      setHasFired(false);
    }
  }, [progressPercent, hasFired, totalCount]);

  return (
    <div className={styles.header}>

      {/* Data + progresso + botão nova */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.dayText}>{day}</span>
          <span className={styles.sep}>·</span>
          <span className={styles.dateText}>{dateLabel}</span>
          {totalCount > 0 && (
            <span className={styles.progressInline}>{completedCount}/{totalCount}</span>
          )}
        </div>
        <button onClick={() => setIsModalOpen(true)} className={styles.btnNova}>
          + Nova
        </button>
      </div>

      {/* Barra de progresso fina */}
      {totalCount > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {/* Filtros rápidos + busca */}
      <div className={styles.filterRow}>
        <div className={styles.chips}>
          {[
            { key: "all",    label: "Todas" },
            { key: "urgent", label: "Urgentes" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.chip} ${filter === key ? styles.chipActive : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {searchOpen ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tarefa..."
                autoFocus
                style={{
                  width: 140, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)", color: "#f0f0f8", fontSize: 12,
                  fontFamily: "inherit", outline: "none",
                }}
              />
              <button
                onClick={() => { setSearchOpen(false); setSearch(""); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 14, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: "4px", lineHeight: 1, display: "flex", alignItems: "center" }}
              title="Buscar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </button>
          )}
          <button onClick={() => onRefresh()} disabled={syncing} className={styles.refreshBtn} title="Sincronizar">
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={syncing ? styles.spinning : ""}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.05l5.67-5.67"/>
            </svg>
          </button>
        </div>
      </div>

      {isModalOpen && (
        <QuickAddModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={(msg) => { setIsModalOpen(false); onRefresh(msg); }}
          initialProjectId={activeProject}
          clients={clients}
        />
      )}
    </div>
  );
}
