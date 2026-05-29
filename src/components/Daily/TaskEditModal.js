"use client";
import { useState, useEffect } from "react";
import styles from "./TaskEditModal.module.css";

const PROJ_LABELS = { pessoal: "Pessoal", vca: "VCA Brasil", pdv: "Ponto de Vista" };
const PRIO_META   = {
  p1: { label: "P1 — Urgente", color: "var(--status-p1)", bg: "rgba(255,77,77,0.12)", border: "rgba(255,77,77,0.25)" },
  p2: { label: "P2 — Alta",    color: "var(--status-p2)", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)" },
  p3: { label: "P3 — Normal",  color: "var(--status-p3)", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)"  },
  p4: { label: "P4 — Baixa",   color: "var(--status-p4)", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.15)" },
};

function fmtDate(ms) {
  if (!ms) return null;
  const d = new Date(Number(ms) - 3 * 3600 * 1000);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function TaskEditModal({ task, onClose, onSuccess, clients: clientsProp }) {
  const [mode, setMode]       = useState("view");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [localClients, setLocalClients] = useState([]);
  const clients = clientsProp ?? localClients;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (clientsProp) return;
    fetch("/api/clients").then(r => r.json()).then(setLocalClients).catch(console.error);
  }, [clientsProp]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const vcaBrands  = clients.filter(c => c.project_id === "vca");
  const pdvClients = clients.filter(c => c.project_id === "pdv");

  const brtDate    = task.due_date ? new Date(Number(task.due_date) - 3 * 3600 * 1000) : null;
  const initialDate = brtDate
    ? `${brtDate.getUTCFullYear()}-${String(brtDate.getUTCMonth() + 1).padStart(2, "0")}-${String(brtDate.getUTCDate()).padStart(2, "0")}`
    : "";
  const initialTime = task.due_date_time && brtDate
    ? `${String(brtDate.getUTCHours()).padStart(2, "0")}:${String(brtDate.getUTCMinutes()).padStart(2, "0")}`
    : "";

  const [formData, setFormData] = useState({
    title:       task.name        || "",
    description: task.description || "",
    project:     task._project_id || "pessoal",
    subClient:   task._section_id ?? "",
    dueDate:     initialDate,
    time:        initialTime,
    priority:    task._priority   || "",
    recurrence:  task._recurrence || "none",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, ...formData }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao salvar");
      }
      onSuccess("✓ Tarefa atualizada");
      onClose();
    } catch (err) {
      setError(err.message || "Falha ao salvar. Tente novamente.");
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    onClose();
    fetch("/api/tasks/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    }).then(res => { if (res.ok) onSuccess("🗑 Tarefa excluída"); });
  };

  const PRIORITY_OPTIONS = [
    { value: '', label: 'Sem prioridade', cls: styles.priorityNone },
    { value: 'p1', label: 'P1 — Urgente',  cls: styles.priorityP1 },
    { value: 'p2', label: 'P2 — Alta',     cls: styles.priorityP2 },
    { value: 'p3', label: 'P3 — Normal',   cls: styles.priorityP3 },
    { value: 'p4', label: 'P4 — Baixa',    cls: styles.priorityP4 },
  ];

  const prioMeta = PRIO_META[task._priority];

  // ── View mode ──────────────────────────────────────────────────────────────
  if (mode === "view") {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>

          {/* Cabeçalho */}
          <div className={styles.viewHeader}>
            <span className={styles.viewProj}>{PROJ_LABELS[task._project_id] ?? task._project_id}</span>
            <button onClick={onClose} className={styles.closeBtn} aria-label="Fechar">✕</button>
          </div>

          {/* Nome da tarefa */}
          <h2 className={styles.viewTitle}>{task.name}</h2>

          {/* Sub-cliente */}
          {task._sub_client_label && (
            <div className={styles.viewSub}>{task._sub_client_label}</div>
          )}

          {/* Chips de metadados */}
          <div className={styles.viewChips}>
            {task.due_date && (
              <span className={styles.chip}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                  <rect x="1" y="3" width="14" height="12" rx="2"/><path d="M5 1v4M11 1v4M1 7h14"/>
                </svg>
                {fmtDate(task.due_date)}
                {task.due_date_time && brtDate && (
                  <> — {String(brtDate.getUTCHours()).padStart(2,"0")}:{String(brtDate.getUTCMinutes()).padStart(2,"0")}</>
                )}
              </span>
            )}
            {prioMeta && (
              <span className={styles.chip} style={{ color: prioMeta.color, background: prioMeta.bg, borderColor: prioMeta.border }}>
                {prioMeta.label}
              </span>
            )}
            {task._recurrence && task._recurrence !== "none" && (
              <span className={`${styles.chip} ${styles.chipRecurrence}`}>
                ↻ {task._recurrence_string || task._recurrence}
              </span>
            )}
          </div>

          {/* Descrição */}
          {task.description ? (
            <div className={styles.viewDesc}>
              <div className={styles.viewDescLabel}>Descrição</div>
              <div className={styles.viewDescText}>{task.description}</div>
            </div>
          ) : (
            <div className={styles.viewDescEmpty} onClick={() => setMode("edit")}>
              + Adicionar descrição
            </div>
          )}

          {/* Footer */}
          <div className={styles.viewFooter}>
            <div className={styles.deleteArea}>
              {!showDeleteConfirm ? (
                <button type="button" onClick={() => setShowDeleteConfirm(true)} className={styles.btnDelete}>
                  Excluir
                </button>
              ) : (
                <div className={styles.deleteConfirmRow}>
                  <span className={styles.deleteConfirmLabel}>Tem certeza?</span>
                  <button type="button" onClick={handleDelete} className={styles.btnDeleteConfirm}>Sim</button>
                  <button type="button" onClick={() => setShowDeleteConfirm(false)} className={styles.btnDeleteCancel}>Não</button>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setMode("edit")} className={styles.btnEdit}>
              Editar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" onClick={() => setMode("view")} className={styles.backBtn}>← Voltar</button>
          <h2 className={styles.title}>Editar Tarefa</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>NOME DA TAREFA</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>DESCRIÇÃO (Opcional)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={styles.input}
              placeholder="Detalhes, links, contexto..."
              rows={3}
              style={{ resize: "vertical", minHeight: 72, lineHeight: 1.5 }}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>PROJETO / LISTA</label>
            <select
              name="project"
              value={formData.project}
              onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value, subClient: "" }))}
              className={styles.select}
            >
              <option value="pessoal">Pessoal</option>
              <option value="vca">VCA Brasil</option>
              <option value="pdv">Ponto de Vista</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>PRIORIDADE</label>
            <div className={styles.priorityPicker}>
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: opt.value }))}
                  className={`${styles.priorityOption} ${opt.cls} ${formData.priority === opt.value ? styles.selected : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {formData.project === "vca" && (
            <div className={styles.formGroup}>
              <label className={styles.label}>MARCA (VCA)</label>
              <select name="subClient" value={formData.subClient} onChange={handleChange} className={styles.select}>
                <option value="">Sem marca</option>
                {vcaBrands.map(b => <option key={b.id} value={b.cf_value}>{b.name}</option>)}
              </select>
            </div>
          )}

          {formData.project === "pdv" && (
            <div className={styles.formGroup}>
              <label className={styles.label}>CLIENTE (PDV)</label>
              <select name="subClient" value={formData.subClient} onChange={handleChange} className={styles.select}>
                <option value="">Sem cliente</option>
                {pdvClients.map(c => <option key={c.id} value={c.cf_value}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className={styles.formGroup} style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label className={styles.label}>DATA DE VENCIMENTO</label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                className={styles.input}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className={styles.label}>HORÁRIO (Opcional)</label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>RECORRÊNCIA</label>
            {task._recurrence && task._recurrence !== "none" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "5px 10px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 7, fontSize: 12, color: "#a5b4fc" }}>
                <span>↻</span>
                <span>{task._recurrence_string || formData.recurrence}</span>
              </div>
            )}
            <select name="recurrence" value={formData.recurrence} onChange={handleChange} className={styles.select}>
              <option value="none">Nenhuma (Tarefa única)</option>
              <option value="daily">Todo dia</option>
              <option value="weekdays">Dias úteis</option>
              <option value="weekly">Toda semana</option>
              <option value="biweekly">A cada 2 semanas</option>
              <option value="monthly">Todo mês</option>
              <option value="yearly">Todo ano</option>
              <option value="recurring">Recorrente (outra)</option>
            </select>
          </div>

          {error && (
            <p style={{ color: "#f87171", fontSize: "13px", marginTop: "8px", textAlign: "center" }}>
              {error}
            </p>
          )}

          <div className={styles.footerDivider} />
          <div className={styles.footerDelete}>
            {!showDeleteConfirm ? (
              <button type="button" onClick={() => setShowDeleteConfirm(true)} className={styles.btnDelete}>
                Excluir tarefa
              </button>
            ) : (
              <div className={styles.deleteConfirmRow}>
                <span className={styles.deleteConfirmLabel}>Tem certeza?</span>
                <button type="button" onClick={handleDelete} className={styles.btnDeleteConfirm}>Sim, excluir</button>
                <button type="button" onClick={() => setShowDeleteConfirm(false)} className={styles.btnDeleteCancel}>Cancelar</button>
              </div>
            )}
          </div>
          <div className={styles.footer}>
            <button type="button" onClick={() => setMode("view")} className={styles.btnCancel}>Cancelar</button>
            <button type="submit" disabled={loading} className={styles.btnSubmit}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
