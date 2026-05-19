"use client";

import { useState, useEffect } from "react";
import styles from "./Performance.module.css";

export default function PerformancePage() {
  const [stats, setStats] = useState({ total: 0, vca: 0, pdv: 0, personal: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks?mode=history")
      .then(r => r.json())
      .then(data => {
        const tasks = Array.isArray(data) ? data : (data.tasks || []);
        const s = { total: tasks.length, vca: 0, pdv: 0, personal: 0 };
        tasks.forEach(t => {
          if (t._project_id === 'vca') s.vca++;
          else if (t._project_id === 'pdv') s.pdv++;
          else s.personal++;
        });
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Métricas de Performance</h1>
        <p>Visão geral de produtividade por projeto.</p>
      </header>

      {loading ? (
        <div className={styles.loading}>Calculando impacto...</div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.mainStat}>
            <div className={styles.val}>{stats.total}</div>
            <div className={styles.lab}>Tarefas Concluídas</div>
          </div>

          <div className={styles.secondaryGrid}>
            <div className={styles.secStat} style={{ borderLeftColor: 'var(--accent-primary)' }}>
              <div className={styles.sVal}>{stats.vca}</div>
              <div className={styles.sLab}>VCA Brasil</div>
            </div>
            <div className={styles.secStat} style={{ borderLeftColor: 'var(--accent-secondary)' }}>
              <div className={styles.sVal}>{stats.pdv}</div>
              <div className={styles.sLab}>Ponto de Vista</div>
            </div>
            <div className={styles.secStat} style={{ borderLeftColor: 'var(--text-muted)' }}>
              <div className={styles.sVal}>{stats.personal}</div>
              <div className={styles.sLab}>Pessoal</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
