"use client";
import { useState, useEffect, useMemo } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "./Database.module.css";

const PROJ_COLORS = {
  vca: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)", text: "#818cf8" },
  pdv: { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.25)", text: "#fb923c" },
  pessoal: { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.25)", text: "#34d399" },
};

const PRIO_COLORS = {
  p1: "#f87171", p2: "#fbbf24", p3: "#06b6d4", p4: "rgba(255,255,255,0.2)",
};

export default function DatabasePage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projFilter, setProjFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("recent"); // recent | name | proj

  async function load() {
    try {
      const res = await fetch("/api/tasks?mode=all");
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : (data.tasks || []));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (search.trim()) list = list.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()));
    if (projFilter !== "all") list = list.filter(t => (t._project_id || t.proj || "pessoal") === projFilter);
    if (statusFilter === "open") list = list.filter(t => t.status?.type !== "closed");
    if (statusFilter === "done") list = list.filter(t => t.status?.type === "closed");
    if (sort === "recent") list.sort((a, b) => Number(b.due_date || 0) - Number(a.due_date || 0));
    if (sort === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sort === "proj") list.sort((a, b) => (a._project_id || "").localeCompare(b._project_id || ""));
    return list;
  }, [tasks, search, projFilter, statusFilter, sort]);

  const stats = useMemo(() => ({
    total: tasks.length,
    open: tasks.filter(t => t.status?.type !== "closed").length,
    done: tasks.filter(t => t.status?.type === "closed").length,
    today: tasks.filter(t => {
      if (!t.due_date) return false;
      const d = new Date(Number(t.due_date));
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  }), [tasks]);

  const exportCSV = () => {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["ID", "Nome", "Projeto", "Prioridade", "Vencimento", "Status", "Recorrência"];
    const rows = filtered.map(t => [
      t.id, t.name,
      t._project_id || t.proj || "pessoal",
      t._priority || t.prio || "—",
      t.due_date ? new Date(Number(t.due_date)).toLocaleDateString("pt-BR") : "—",
      t.status?.status || "aberta",
      t.recurrence || "—"
    ].map(esc));
    const csv = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(";") + "\n" + rows.map(r => r.join(";")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `daily_tarefas_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = new Date(Number(ts));
    const now = new Date();
    const diff = Math.floor((d - now) / 86400000);
    const locale = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    if (diff === 0) return "Hoje";
    if (diff === 1) return "Amanhã";
    if (diff === -1) return "Ontem";
    if (diff < 0) return `${locale} ⚠`;
    return locale;
  };

  const isOverdue = (ts) => ts && new Date(Number(ts)) < new Date() && new Date(Number(ts)).toDateString() !== new Date().toDateString();

  return (
    <div className={styles.container}>
      <ModuleHeader title="Dados" />

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: "#06b6d4" }}>{stats.total}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: "#fbbf24" }}>{stats.open}</span>
          <span className={styles.statLabel}>Abertas</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: "#34d399" }}>{stats.done}</span>
          <span className={styles.statLabel}>Concluídas</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: "#f87171" }}>{stats.today}</span>
          <span className={styles.statLabel}>Vencem hoje</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="🔍  Buscar tarefa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.toolbarRight}>
          <select className={styles.sel} value={projFilter} onChange={e => setProjFilter(e.target.value)}>
            <option value="all">Todos projetos</option>
            <option value="pessoal">Pessoal</option>
            <option value="vca">VCA Brasil</option>
            <option value="pdv">Ponto de Vista</option>
          </select>
          <select className={styles.sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos status</option>
            <option value="open">Abertas</option>
            <option value="done">Concluídas</option>
          </select>
          <select className={styles.sel} value={sort} onChange={e => setSort(e.target.value)}>
            <option value="recent">Mais recente</option>
            <option value="name">Nome A–Z</option>
            <option value="proj">Projeto</option>
          </select>
          <button onClick={exportCSV} className={styles.exportBtn}>↓ CSV</button>
        </div>
      </div>

      {/* Count */}
      <div className={styles.resultCount}>
        {loading ? "Carregando..." : `${filtered.length} tarefa${filtered.length !== 1 ? "s" : ""}`}
      </div>

      {/* Table */}
      {!loading && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "42%" }}>Tarefa</th>
                <th>Projeto</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Prio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const proj = t._project_id || t.proj || "pessoal";
                const pcolor = PROJ_COLORS[proj] || PROJ_COLORS.pessoal;
                const prio = t._priority || t.prio;
                const isDone = t.status?.type === "closed";
                const overdue = !isDone && isOverdue(t.due_date);
                return (
                  <tr key={t.id} className={isDone ? styles.rowDone : overdue ? styles.rowOverdue : ""}>
                    <td className={styles.taskName}>
                      {isDone && <span className={styles.checkMark}>✓</span>}
                      {t.name}
                    </td>
                    <td>
                      <span className={styles.tag} style={{ background: pcolor.bg, borderColor: pcolor.border, color: pcolor.text }}>
                        {proj === "vca" ? "VCA" : proj === "pdv" ? "PDV" : "PESSOAL"}
                      </span>
                    </td>
                    <td className={`${styles.mono} ${overdue ? styles.overdueText : ""}`}>
                      {formatDate(t.due_date)}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${isDone ? styles.statusDone : ""}`}>
                        {isDone ? "Concluída" : "Aberta"}
                      </span>
                    </td>
                    <td>
                      {prio && <span className={styles.prioDot} style={{ background: PRIO_COLORS[prio] }} title={prio} />}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className={styles.emptyRow}>Nenhuma tarefa encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Navigation />
    </div>
  );
}
