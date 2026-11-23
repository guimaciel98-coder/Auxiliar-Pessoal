"use client";
import { useState, useEffect } from "react";
import styles from "./TaskEditModal.module.css";
import { validateRecurrence } from "@/lib/recurrenceValidation";
import { PROJ } from "@/config/constants";
import { niceName } from "@/utils/niceName";
import { recPt } from "@/utils/recurrenceText";

const PROJ_LABELS = { pessoal: "Pessoal", vca: "VCA Brasil", pdv: "Ponto de Vista" };

const PRIO_META   = {
  p1: { label: "P1 · Urgente", color: "#ff5a5f", bg: "rgba(255,77,77,0.12)", border: "rgba(255,77,77,0.25)" },
  p2: { label: "P2 · Alta",    color: "#fb923c", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)" },
  p3: { label: "P3 · Normal",  color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)"  },
  p4: { label: "P4 · Baixa",   color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.15)" },
};

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// "Seg, 23 nov" (ano só quando não é o atual)
function fmtDate(ms) {
  if (!ms) return null;
  const d = new Date(Number(ms) - 3 * 3600 * 1000);
  const y = d.getUTCFullYear() !== new Date().getFullYear() ? ` ${d.getUTCFullYear()}` : "";
  return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MO[d.getUTCMonth()]}${y}`;
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

  // Recorrência: só pré-preenche se a task É de fato recorrente
  const isRecurring = task._repeat_forever === true;
  const currentRecStr = isRecurring ? (task._recurrence_string || "") : "";

  const [formData, setFormData] = useState({
    title:       task.name        || "",
    description: task.description || "",
    project:     task._project_id || "pessoal",
    subClient:   task._section_id ?? "",
    dueDate:     initialDate,
    time:        initialTime,
    priority:    task._priority   || "",
    recurrence:  currentRecStr,
  });

  // Rastreia se o usuário tocou no campo de recorrência nesta sessão de edição.
  // Se não tocou, o backend usa due_date (preserva recorrência existente).
  const [recurrenceModified, setRecurrenceModified] = useState(false);
  // Controla visibilidade do campo de recorrência
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "recurrence") setRecurrenceModified(true);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  function handleRemoveRecurrence() {
    setFormData(prev => ({ ...prev, recurrence: "" }));
    setRecurrenceModified(true);
    setRecurrenceOpen(false);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, ...formData, recurrenceModified }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
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

  // ── Opções visuais ─────────────────────────────────────────────────────────
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

  // Marcas VCA de todos os sub-projetos; as da Ocupe ganham o sufixo para diferenciar ("Geral · Ocupe")
  const brandLabel = (b) => {
    const base = niceName(b.name);
    return b.source_project_id && b.source_project_id !== PROJ.vca.id ? `${base} · Ocupe` : base;
  };

  const projColor = PROJ[task._project_id]?.cor ?? "#a78bfa";
  const prioMeta  = PRIO_META[task._priority];
  const recState  = validateRecurrence(formData.recurrence);

  // ── Visualização ───────────────────────────────────────────────────────────
  if (mode === "view") {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ "--proj": projColor }}>

          <div className={styles.topRow}>
            <div className={styles.crumbs}>
              <span className={styles.projPill}><span className={styles.dot} />{PROJ_LABELS[task._project_id] ?? task._project_id}</span>
              {task._sub_client_label && <span className={styles.crumbSub}>{niceName(task._sub_client_label)}</span>}
            </div>
            <button onClick={onClose} className={styles.closeBtn} aria-label="Fechar">✕</button>
          </div>

          <h2 className={styles.viewTitle}>{task.name}</h2>

          {/* Informações principais */}
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Data</span>
              <span className={styles.infoValue}>
                {task.due_date ? fmtDate(task.due_date) : "Sem data"}
                {task.due_date_time && brtDate && (
                  <span className={styles.infoTime}>{String(brtDate.getUTCHours()).padStart(2, "0")}:{String(brtDate.getUTCMinutes()).padStart(2, "0")}</span>
                )}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Prioridade</span>
              <span className={styles.infoValue} style={prioMeta ? { color: prioMeta.color } : undefined}>
                {prioMeta ? prioMeta.label : "Nenhuma"}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Repete</span>
              <span className={styles.infoValue} style={isRecurring ? { color: "#c4b5fd" } : undefined}>
                {isRecurring ? `↻ ${recPt(task._recurrence_string) || "recorrente"}` : "Não"}
              </span>
            </div>
          </div>

          {/* Descrição */}
          {task.description ? (
            <div className={styles.viewDesc}>
              <div className={styles.infoLabel}>Descrição</div>
              <div className={styles.viewDescText}>{task.description}</div>
            </div>
          ) : (
            <button type="button" className={styles.viewDescEmpty} onClick={() => setMode("edit")}>
              + Adicionar descrição
            </button>
          )}

          <div className={styles.footer}>
            <div className={styles.deleteArea}>
              {!showDeleteConfirm ? (
                <button type="button" onClick={() => setShowDeleteConfirm(true)} className={styles.btnDelete}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                  Excluir
                </button>
              ) : (
                <div className={styles.deleteConfirmRow}>
                  <span className={styles.deleteConfirmLabel}>Excluir de vez?</span>
                  <button type="button" onClick={handleDelete} className={styles.btnDeleteConfirm}>Sim</button>
                  <button type="button" onClick={() => setShowDeleteConfirm(false)} className={styles.btnDeleteCancel}>Não</button>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setMode("edit")} className={styles.btnPrimary}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              Editar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edição ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.topRow}>
          <button type="button" onClick={() => setMode("view")} className={styles.backBtn}>← Voltar</button>
          <span className={styles.editLabel}>Editando tarefa</span>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.titleBlock}>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={styles.bigInput}
              placeholder="Nome da tarefa"
              required
            />
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
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
                  onClick={() => setFormData(prev => ({ ...prev, project: p.value, subClient: "" }))}
                  className={`${styles.chip} ${formData.project === p.value ? styles.chipActive : ""}`}
                  style={{ "--c": p.color }}>
                  <span className={styles.dot} />{p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Marca VCA / Cliente PDV */}
          {(formData.project === "vca" || formData.project === "pdv") && (
            <div className={styles.field}>
              <span className={styles.label}>{formData.project === "vca" ? "Marca" : "Cliente"}</span>
              <div className={styles.chipRow}>
                {[{ id: "none", cf_value: "", name: formData.project === "vca" ? "Nenhuma" : "Nenhum" },
                  ...(formData.project === "vca" ? vcaBrands : pdvClients)].map(c => (
                  <button key={c.id} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, subClient: c.cf_value }))}
                    className={`${styles.chip} ${formData.subClient === c.cf_value ? styles.chipActive : ""}`}
                    style={{ "--c": PROJ[formData.project].cor }}>
                    {c.id === "none" ? c.name : formData.project === "vca" ? brandLabel(c) : niceName(c.name)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quando */}
          <div className={styles.field}>
            <span className={styles.label}>Quando</span>
            <div className={styles.chipRow}>
              {DATE_QUICK.map(d => (
                <button key={d.label} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, dueDate: d.value }))}
                  className={`${styles.chip} ${formData.dueDate === d.value ? styles.chipActive : ""}`}
                  style={{ "--c": "#a78bfa" }}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className={styles.dateRow}>
              <label className={styles.inlineInput}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
                <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
              </label>
              <label className={styles.inlineInput}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                <input type="time" name="time" value={formData.time} onChange={handleChange} />
                {formData.time && (
                  <button type="button" className={styles.clearBtn} title="Sem horário"
                    onClick={(e) => { e.preventDefault(); setFormData(prev => ({ ...prev, time: "" })); }}>✕</button>
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
                  onClick={() => setFormData(prev => ({ ...prev, priority: o.value }))}
                  className={`${styles.chip} ${formData.priority === o.value ? styles.chipActive : ""}`}
                  style={{ "--c": o.color }}>
                  <span className={styles.dot} />{o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Repetir — tarefa recorrente começa mostrando a regra atual */}
          <div className={styles.field}>
            <span className={styles.label}>Repetir</span>

            {isRecurring && !recurrenceOpen && !recurrenceModified ? (
              <div className={styles.recCurrent}>
                <span className={styles.recPill}>↻ {recPt(currentRecStr) || "recorrente"}</span>
                <button type="button" onClick={() => setRecurrenceOpen(true)} className={styles.linkBtn}>Alterar</button>
                <button type="button" onClick={handleRemoveRecurrence} className={`${styles.linkBtn} ${styles.linkDanger}`}>Remover</button>
              </div>
            ) : (
              <>
                <div className={styles.chipRow}>
                  {REC_QUICK.map(r => (
                    <button key={r} type="button"
                      onClick={() => { setRecurrenceModified(true); setFormData(prev => ({ ...prev, recurrence: prev.recurrence === r ? "" : r })); }}
                      className={`${styles.chip} ${formData.recurrence === r ? styles.chipActive : ""}`}
                      style={{ "--c": "#38bdf8" }}>
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  name="recurrence"
                  value={formData.recurrence}
                  onChange={handleChange}
                  className={`${styles.input} ${recState === "valid" ? styles.inputOk : recState === "unknown" ? styles.inputWarn : ""}`}
                  placeholder={isRecurring ? "Nova regra (vazio = sem repetição)" : "ou escreva: toda segunda, a cada 2 semanas…"}
                  autoFocus={recurrenceOpen}
                />
                {recState === "unknown" && <p className={styles.hintWarn}>Padrão não reconhecido: o Todoist pode ignorar</p>}
              </>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.footer}>
            <div className={styles.deleteArea}>
              {!showDeleteConfirm ? (
                <button type="button" onClick={() => setShowDeleteConfirm(true)} className={styles.btnDelete}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                  Excluir
                </button>
              ) : (
                <div className={styles.deleteConfirmRow}>
                  <span className={styles.deleteConfirmLabel}>Excluir de vez?</span>
                  <button type="button" onClick={handleDelete} className={styles.btnDeleteConfirm}>Sim</button>
                  <button type="button" onClick={() => setShowDeleteConfirm(false)} className={styles.btnDeleteCancel}>Não</button>
                </div>
              )}
            </div>
            <div className={styles.footerRight}>
              <button type="button" onClick={() => setMode("view")} className={styles.btnGhost}>Cancelar</button>
              <button type="submit" disabled={loading} className={styles.btnPrimary}>
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
