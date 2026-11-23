"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import Ring from "../ui/Ring";
import styles from "./Header.module.css";
import QuickAddModal from "./QuickAddModal";

export default function Header({
  mode = "today",
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

      {/* ── Topo: título + data | anel de progresso + nova tarefa ── */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>{day} · {dateLabel}</span>
          <h1 className={styles.title}>{mode === "tomorrow" ? "Amanhã" : "Hoje"}</h1>
        </div>

        <div className={styles.heroRight}>
          {totalCount > 0 && (
            <div className={styles.progressBlock}>
              <Ring pct={progressPercent} color={progressPercent === 100 ? "#34d399" : "#a78bfa"} size={68} stroke={7}>
                <span className={styles.ringPct}>{progressPercent}%</span>
              </Ring>
              <div className={styles.progressNums}>
                <span className={styles.bigNum}>{completedCount}<span className={styles.bigOf}>/{totalCount}</span></span>
                <span className={styles.bigLbl}>feitas</span>
              </div>
            </div>
          )}
          <button onClick={() => setIsModalOpen(true)} className={styles.btnNova}>
            <span className={styles.btnPlus}>+</span> Nova tarefa
          </button>
        </div>
      </div>

      {/* ── Abas Hoje/Amanhã + filtros + busca/sincronizar ── */}
      <div className={styles.filterRow}>
        <div className={styles.leftGroup}>
          <div className={styles.segment}>
            <Link href="/daily"    className={`${styles.segBtn} ${mode === "today"    ? styles.segActive : ""}`}>Hoje</Link>
            <Link href="/tomorrow" className={`${styles.segBtn} ${mode === "tomorrow" ? styles.segActive : ""}`}>Amanhã</Link>
          </div>
        </div>

        <div className={styles.tools}>
          {searchOpen ? (
            <div className={styles.searchBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tarefa..."
                autoFocus
                className={styles.searchInput}
              />
              <button onClick={() => { setSearchOpen(false); setSearch(""); }} className={styles.searchClose} title="Fechar busca">✕</button>
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} className={styles.iconBtn} title="Buscar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </button>
          )}
          <button onClick={() => onRefresh()} disabled={syncing} className={styles.iconBtn} title="Sincronizar">
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              className={syncing ? styles.spinning : ""}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>
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
