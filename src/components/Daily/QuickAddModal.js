"use client";
import { useState, useEffect } from "react";
import styles from "./QuickAddModal.module.css";

const MODES = [
  { key: "task", label: "Tarefa" },
  { key: "pdv",  label: "Cliente PDV" },
  { key: "vca",  label: "Marca VCA" },
];

const MODAL_TITLE = {
  task: "Nova Tarefa Rápida",
  pdv:  "Novo Cliente PDV",
  vca:  "Nova Marca VCA",
};

export default function QuickAddModal({ onClose, onSuccess, initialProjectId, initialSubClientId, clients: clientsProp }) {
  const [mode, setMode]       = useState("task");
  const [fading, setFading]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [localClients, setLocalClients] = useState([]);
  const clients = clientsProp ?? localClients;

  // ── Estado: Tarefa ────────────────────────────────────────────────────────
  const [taskData, setTaskData] = useState({
    title: "",
    project: initialProjectId || "pessoal",
    subClient: initialSubClientId || "",
    dueDate: (() => {
      const b = new Date(Date.now() - 3 * 3600 * 1000);
      return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${String(b.getUTCDate()).padStart(2, "0")}`;
    })(),
    time: "",
    priority: "",
    recurrence: "none",
  });

  // ── Estado: Cliente PDV ───────────────────────────────────────────────────
  const [pdvData, setPdvData] = useState({ name: "", canal: "meta", observacoes: "" });

  // ── Estado: Marca VCA ─────────────────────────────────────────────────────
  const [vcaData, setVcaData] = useState({ name: "", vertical: "", observacoes: "" });

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

  function switchMode(newMode) {
    if (newMode === mode) return;
    setError(null);
    setFading(true);
    setTimeout(() => {
      setMode(newMode);
      setFading(false);
    }, 150);
  }

  // ── Submit: Tarefa ────────────────────────────────────────────────────────
  async function handleTaskSubmit(e) {
    e.preventDefault();
    if (!taskData.title.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao criar tarefa");
      }
      onSuccess("✓ Tarefa criada");
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao criar tarefa. Tente novamente.");
      setLoading(false);
    }
  }

  // ── Submit: Cliente PDV ───────────────────────────────────────────────────
  async function handlePdvSubmit(e) {
    e.preventDefault();
    if (!pdvData.name.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pdv", ...pdvData }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao adicionar cliente");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao adicionar cliente. Tente novamente.");
      setLoading(false);
    }
  }

  // ── Submit: Marca VCA ─────────────────────────────────────────────────────
  async function handleVcaSubmit(e) {
    e.preventDefault();
    if (!vcaData.name.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "vca", ...vcaData }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao adicionar marca");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao adicionar marca. Tente novamente.");
      setLoading(false);
    }
  }

  const canSubmit = {
    task: !loading && !!taskData.title.trim(),
    pdv:  !loading && !!pdvData.name.trim(),
    vca:  !loading && !!vcaData.name.trim(),
  };
  const submitLabel = {
    task: loading ? "Criando..."  : "Criar Tarefa",
    pdv:  loading ? "Salvando..." : "Adicionar Cliente",
    vca:  loading ? "Salvando..." : "Adicionar Marca",
  };

  // ── Estilos inline para os tabs ───────────────────────────────────────────
  function tabStyle(key) {
    const active = mode === key;
    return {
      padding: "4px 11px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "inherit",
      cursor: "pointer",
      transition: "all 0.18s",
      border: active ? "1px solid rgba(0,229,160,0.3)" : "1px solid rgba(255,255,255,0.08)",
      background: active ? "rgba(0,229,160,0.1)" : "rgba(255,255,255,0.04)",
      color: active ? "var(--accent-primary)" : "rgba(255,255,255,0.35)",
    };
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* ── Mode tabs ── */}
        <div style={{
          display: "flex", gap: 5, marginBottom: 16,
          paddingBottom: 13, borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          {MODES.map(m => (
            <button key={m.key} type="button" onClick={() => switchMode(m.key)} style={tabStyle(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        <h2 className={styles.title}>{MODAL_TITLE[mode]}</h2>

        {/* ── Área animada com fade ao trocar de modo ── */}
        <div style={{ transition: "opacity 0.15s ease", opacity: fading ? 0 : 1 }}>

          {/* ════ Formulário: Tarefa ════ */}
          {mode === "task" && (
            <form onSubmit={handleTaskSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>NOME DA TAREFA</label>
                <input
                  autoFocus
                  type="text"
                  value={taskData.title}
                  onChange={e => setTaskData(p => ({ ...p, title: e.target.value }))}
                  className={styles.input}
                  placeholder="Ex: Pagar boleto"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>PROJETO / LISTA</label>
                <select
                  value={taskData.project}
                  onChange={e => setTaskData(p => ({ ...p, project: e.target.value, subClient: "" }))}
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
                  {[
                    { value: '',   label: "Sem prioridade", cls: styles.priorityNone },
                    { value: "p1", label: "P1 — Urgente",   cls: styles.priorityP1 },
                    { value: "p2", label: "P2 — Alta",      cls: styles.priorityP2 },
                    { value: "p3", label: "P3 — Normal",    cls: styles.priorityP3 },
                    { value: "p4", label: "P4 — Baixa",     cls: styles.priorityP4 },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTaskData(p => ({ ...p, priority: opt.value }))}
                      className={`${styles.priorityOption} ${opt.cls} ${taskData.priority === opt.value ? styles.selected : ""}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {taskData.project === "vca" && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>MARCA (VCA)</label>
                  <select
                    value={taskData.subClient}
                    onChange={e => setTaskData(p => ({ ...p, subClient: e.target.value }))}
                    className={styles.select}
                  >
                    <option value="">Selecione uma marca...</option>
                    {vcaBrands.map(b => <option key={b.id} value={b.cf_value}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {taskData.project === "pdv" && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>CLIENTE (PDV)</label>
                  <select
                    value={taskData.subClient}
                    onChange={e => setTaskData(p => ({ ...p, subClient: e.target.value }))}
                    className={styles.select}
                  >
                    <option value="">Selecione um cliente...</option>
                    {pdvClients.map(c => <option key={c.id} value={c.cf_value}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className={styles.formGroup} style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label className={styles.label}>DATA DE VENCIMENTO</label>
                  <input
                    type="date"
                    value={taskData.dueDate}
                    onChange={e => setTaskData(p => ({ ...p, dueDate: e.target.value }))}
                    className={styles.input}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className={styles.label}>HORÁRIO (Opcional)</label>
                  <input
                    type="time"
                    value={taskData.time}
                    onChange={e => setTaskData(p => ({ ...p, time: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>RECORRÊNCIA</label>
                <select
                  value={taskData.recurrence}
                  onChange={e => setTaskData(p => ({ ...p, recurrence: e.target.value }))}
                  className={styles.select}
                >
                  <option value="none">Nenhuma (Tarefa única)</option>
                  <option value="daily">Todo dia</option>
                  <option value="weekdays">Dias úteis</option>
                  <option value="weekly">Toda semana</option>
                  <option value="biweekly">A cada 2 semanas</option>
                  <option value="monthly">Todo mês</option>
                  <option value="yearly">Todo ano</option>
                </select>
              </div>

              {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8, textAlign: "center" }}>{error}</p>}

              <div className={styles.footer}>
                <button type="button" onClick={onClose} className={styles.btnCancel}>Cancelar</button>
                <button type="submit" disabled={!canSubmit.task} className={styles.btnSubmit}>
                  {submitLabel.task}
                </button>
              </div>
            </form>
          )}

          {/* ════ Formulário: Cliente PDV ════ */}
          {mode === "pdv" && (
            <form onSubmit={handlePdvSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>NOME DO CLIENTE</label>
                <input
                  autoFocus
                  type="text"
                  value={pdvData.name}
                  onChange={e => setPdvData(p => ({ ...p, name: e.target.value }))}
                  className={styles.input}
                  placeholder="Ex: Farmácia Central"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>CANAL</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { value: "meta",   label: "Meta" },
                    { value: "google", label: "Google" },
                    { value: "ambos",  label: "Ambos" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPdvData(p => ({ ...p, canal: opt.value }))}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        border: pdvData.canal === opt.value
                          ? "1px solid rgba(59,130,246,0.45)"
                          : "1px solid rgba(255,255,255,0.08)",
                        background: pdvData.canal === opt.value
                          ? "rgba(59,130,246,0.14)"
                          : "rgba(255,255,255,0.03)",
                        color: pdvData.canal === opt.value
                          ? "#3b82f6"
                          : "rgba(255,255,255,0.35)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>OBSERVAÇÕES</label>
                <textarea
                  value={pdvData.observacoes}
                  onChange={e => setPdvData(p => ({ ...p, observacoes: e.target.value }))}
                  className={styles.input}
                  placeholder="Informações adicionais..."
                  rows={3}
                  style={{ resize: "vertical", minHeight: 72 }}
                />
              </div>

              {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8, textAlign: "center" }}>{error}</p>}

              <div className={styles.footer}>
                <button type="button" onClick={onClose} className={styles.btnCancel}>Cancelar</button>
                <button type="submit" disabled={!canSubmit.pdv} className={styles.btnSubmit}>
                  {submitLabel.pdv}
                </button>
              </div>
            </form>
          )}

          {/* ════ Formulário: Marca VCA ════ */}
          {mode === "vca" && (
            <form onSubmit={handleVcaSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>NOME DA MARCA</label>
                <input
                  autoFocus
                  type="text"
                  value={vcaData.name}
                  onChange={e => setVcaData(p => ({ ...p, name: e.target.value }))}
                  className={styles.input}
                  placeholder="Ex: Hospital São Lucas"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>VERTICAL</label>
                <input
                  type="text"
                  value={vcaData.vertical}
                  onChange={e => setVcaData(p => ({ ...p, vertical: e.target.value }))}
                  className={styles.input}
                  placeholder="Ex: hospital, clínica, farmácia..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>OBSERVAÇÕES</label>
                <textarea
                  value={vcaData.observacoes}
                  onChange={e => setVcaData(p => ({ ...p, observacoes: e.target.value }))}
                  className={styles.input}
                  placeholder="Informações adicionais..."
                  rows={3}
                  style={{ resize: "vertical", minHeight: 72 }}
                />
              </div>

              {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8, textAlign: "center" }}>{error}</p>}

              <div className={styles.footer}>
                <button type="button" onClick={onClose} className={styles.btnCancel}>Cancelar</button>
                <button type="submit" disabled={!canSubmit.vca} className={styles.btnSubmit}>
                  {submitLabel.vca}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
