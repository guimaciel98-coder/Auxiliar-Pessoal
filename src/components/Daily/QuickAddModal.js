"use client";
import { useState, useEffect } from "react";
import styles from "./QuickAddModal.module.css";
import { PROJ } from "@/config/constants";
import { validateRecurrence } from "@/lib/recurrenceValidation";

const VCA_MAIN_ID = PROJ.vca.id;

const VCA_AGENCIES = [
  { id: PROJ.vca.extraIds[0], label: "Ocupe"          },
  { id: PROJ.vca.extraIds[1], label: "Carol Macarone" },
  { id: PROJ.vca.extraIds[2], label: "Santé"          },
  { id: PROJ.vca.extraIds[3], label: "Hive"           },
];

const MODES = [
  { key: "task", label: "Tarefa" },
  { key: "pdv",  label: "Cliente PDV" },
  { key: "vca",  label: "Marca VCA" },
];

export default function QuickAddModal({ onClose, onSuccess, initialProjectId, initialVcaProjectId, initialSubClientId, clients: clientsProp }) {
  const [mode, setMode]       = useState("task");
  const [fading, setFading]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [localClients, setLocalClients] = useState([]);
  const clients = clientsProp ?? localClients;

  // ── Estado: Tarefa ────────────────────────────────────────────────────────
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    project: initialProjectId || "pessoal",
    vcaProjectId: initialVcaProjectId || "",
    subClient: initialSubClientId || "",
    dueDate: (() => {
      const b = new Date(Date.now() - 3 * 3600 * 1000);
      return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${String(b.getUTCDate()).padStart(2, "0")}`;
    })(),
    time: "",
    priority: "",
    recurrence: "",
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao criar tarefa");
      const recText = taskData.recurrence?.trim();
      if (recText && data.due?.is_recurring === false) {
        onSuccess("✓ Tarefa criada (recorrência não reconhecida — verifique no Todoist)");
      } else {
        onSuccess("✓ Tarefa criada");
      }
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

  // ── Atalhos de data (BRT) ───────────────────────────────────────────────
  const isoBRT = (offsetDays) => {
    const b = new Date(Date.now() - 3 * 3600 * 1000 + offsetDays * 86400000);
    return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${String(b.getUTCDate()).padStart(2, "0")}`;
  };
  const todayDow = new Date(Date.now() - 3 * 3600 * 1000).getUTCDay();
  const DATE_QUICK = [
    { label: "Hoje",          value: isoBRT(0) },
    { label: "Amanhã",        value: isoBRT(1) },
    { label: "Próx. segunda", value: isoBRT(((8 - todayDow) % 7) || 7) },
  ];
  const REC_QUICK = ["todo dia", "todo dia útil", "toda semana", "todo mês"];
  const PROJECTS = [
    { value: "pessoal", label: "Pessoal",        color: PROJ.pessoal.cor },
    { value: "vca",     label: "VCA Brasil",     color: PROJ.vca.cor },
    { value: "pdv",     label: "Ponto de Vista", color: PROJ.pdv.cor },
  ];
  const PRIORITIES = [
    { value: "",   label: "Nenhuma", color: "rgba(255,255,255,0.35)" },
    { value: "p1", label: "P1",      color: "#ff5a5f" },
    { value: "p2", label: "P2",      color: "#fb923c" },
    { value: "p3", label: "P3",      color: "#fbbf24" },
    { value: "p4", label: "P4",      color: "#94a3b8" },
  ];
  const recState = validateRecurrence(taskData.recurrence);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* ── Topo: tipo de cadastro + fechar ── */}
        <div className={styles.topRow}>
          <div className={styles.segment}>
            {MODES.map(m => (
              <button key={m.key} type="button" onClick={() => switchMode(m.key)}
                className={`${styles.segBtn} ${mode === m.key ? styles.segActive : ""}`}>
                {m.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} title="Fechar (Esc)">✕</button>
        </div>

        {/* ── Área animada com fade ao trocar de modo ── */}
        <div style={{ transition: "opacity 0.15s ease", opacity: fading ? 0 : 1 }}>

          {/* ════ Formulário: Tarefa ════ */}
          {mode === "task" && (
            <form onSubmit={handleTaskSubmit}>
              {/* Nome grande + descrição logo abaixo (estilo Todoist) */}
              <div className={styles.titleBlock}>
                <input
                  autoFocus
                  type="text"
                  value={taskData.title}
                  onChange={e => setTaskData(p => ({ ...p, title: e.target.value }))}
                  className={styles.bigInput}
                  placeholder="O que precisa ser feito?"
                  required
                />
                <textarea
                  value={taskData.description}
                  onChange={e => setTaskData(p => ({ ...p, description: e.target.value }))}
                  className={styles.descInput}
                  placeholder="Descrição (opcional)"
                  rows={2}
                />
              </div>

              {/* Projeto */}
              <div className={styles.field}>
                <span className={styles.label}>Projeto</span>
                <div className={styles.chipRow}>
                  {PROJECTS.map(p => (
                    <button key={p.value} type="button"
                      onClick={() => setTaskData(d => ({ ...d, project: p.value, vcaProjectId: "", subClient: "" }))}
                      className={`${styles.chip} ${taskData.project === p.value ? styles.chipActive : ""}`}
                      style={{ "--c": p.color }}>
                      <span className={styles.dot} />{p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* VCA: Gestão Interna ou agência */}
              {taskData.project === "vca" && (
                <div className={styles.field}>
                  <span className={styles.label}>Projeto VCA</span>
                  <div className={styles.chipRow}>
                    {[{ id: VCA_MAIN_ID, label: "Gestão Interna" }, ...VCA_AGENCIES].map(a => (
                      <button key={a.id} type="button"
                        onClick={() => setTaskData(p => ({ ...p, vcaProjectId: a.id, subClient: "" }))}
                        className={`${styles.chip} ${taskData.vcaProjectId === a.id ? styles.chipActive : ""}`}
                        style={{ "--c": PROJ.vca.cor }}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {taskData.project === "vca" && taskData.vcaProjectId && (
                <div className={styles.field}>
                  <span className={styles.label}>Marca / seção</span>
                  <select
                    value={taskData.subClient}
                    onChange={e => setTaskData(p => ({ ...p, subClient: e.target.value }))}
                    className={styles.select}
                  >
                    <option value="">Sem seção específica</option>
                    {vcaBrands
                      .filter(b => b.source_project_id === taskData.vcaProjectId)
                      .map(b => <option key={b.id} value={b.cf_value}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {taskData.project === "pdv" && (
                <div className={styles.field}>
                  <span className={styles.label}>Cliente</span>
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

              {/* Quando: atalhos + data + horário */}
              <div className={styles.field}>
                <span className={styles.label}>Quando</span>
                <div className={styles.chipRow}>
                  {DATE_QUICK.map(d => (
                    <button key={d.label} type="button"
                      onClick={() => setTaskData(p => ({ ...p, dueDate: d.value }))}
                      className={`${styles.chip} ${taskData.dueDate === d.value ? styles.chipActive : ""}`}
                      style={{ "--c": "#a78bfa" }}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className={styles.dateRow}>
                  <label className={styles.inlineInput}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
                    <input type="date" value={taskData.dueDate}
                      onChange={e => setTaskData(p => ({ ...p, dueDate: e.target.value }))} required />
                  </label>
                  <label className={styles.inlineInput}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                    <input type="time" value={taskData.time}
                      onChange={e => setTaskData(p => ({ ...p, time: e.target.value }))} />
                    {taskData.time && (
                      <button type="button" className={styles.clearBtn} title="Sem horário"
                        onClick={(e) => { e.preventDefault(); setTaskData(p => ({ ...p, time: "" })); }}>✕</button>
                    )}
                  </label>
                </div>
              </div>

              {/* Prioridade */}
              <div className={styles.field}>
                <span className={styles.label}>Prioridade</span>
                <div className={styles.chipRow}>
                  {PRIORITIES.map(o => (
                    <button key={o.value || "none"} type="button"
                      onClick={() => setTaskData(p => ({ ...p, priority: o.value }))}
                      className={`${styles.chip} ${taskData.priority === o.value ? styles.chipActive : ""}`}
                      style={{ "--c": o.color }}>
                      <span className={styles.dot} />{o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Repetir */}
              <div className={styles.field}>
                <span className={styles.label}>Repetir</span>
                <div className={styles.chipRow}>
                  {REC_QUICK.map(r => (
                    <button key={r} type="button"
                      onClick={() => setTaskData(p => ({ ...p, recurrence: p.recurrence === r ? "" : r }))}
                      className={`${styles.chip} ${taskData.recurrence === r ? styles.chipActive : ""}`}
                      style={{ "--c": "#38bdf8" }}>
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={taskData.recurrence}
                  onChange={e => setTaskData(p => ({ ...p, recurrence: e.target.value }))}
                  className={`${styles.input} ${recState === "valid" ? styles.inputOk : recState === "unknown" ? styles.inputWarn : ""}`}
                  placeholder="ou escreva: toda segunda, a cada 2 semanas…"
                />
                {recState === "unknown" && <p className={styles.hintWarn}>Padrão não reconhecido: o Todoist pode ignorar a recorrência</p>}
              </div>

              {error && <p className={styles.error}>{error}</p>}

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
              <div className={styles.titleBlock}>
                <input
                  autoFocus
                  type="text"
                  value={pdvData.name}
                  onChange={e => setPdvData(p => ({ ...p, name: e.target.value }))}
                  className={styles.bigInput}
                  placeholder="Nome do cliente"
                  required
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Canal</span>
                <div className={styles.chipRow}>
                  {[
                    { value: "meta",   label: "Meta" },
                    { value: "google", label: "Google" },
                    { value: "ambos",  label: "Ambos" },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setPdvData(p => ({ ...p, canal: opt.value }))}
                      className={`${styles.chip} ${pdvData.canal === opt.value ? styles.chipActive : ""}`}
                      style={{ "--c": PROJ.pdv.cor }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Observações</span>
                <textarea
                  value={pdvData.observacoes}
                  onChange={e => setPdvData(p => ({ ...p, observacoes: e.target.value }))}
                  className={styles.input}
                  placeholder="Informações adicionais..."
                  rows={3}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

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
              <div className={styles.titleBlock}>
                <input
                  autoFocus
                  type="text"
                  value={vcaData.name}
                  onChange={e => setVcaData(p => ({ ...p, name: e.target.value }))}
                  className={styles.bigInput}
                  placeholder="Nome da marca"
                  required
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Vertical</span>
                <input
                  type="text"
                  value={vcaData.vertical}
                  onChange={e => setVcaData(p => ({ ...p, vertical: e.target.value }))}
                  className={styles.input}
                  placeholder="Ex: hospital, clínica, farmácia..."
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Observações</span>
                <textarea
                  value={vcaData.observacoes}
                  onChange={e => setVcaData(p => ({ ...p, observacoes: e.target.value }))}
                  className={styles.input}
                  placeholder="Informações adicionais..."
                  rows={3}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

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
