"use client";
// Financeiro > Ganhos — mesmo padrão visual de Gastos (big numbers, listas por grupo, painel lateral).
import { useState, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import Ring from "@/components/ui/Ring";
import ex from "../expenses/Expenses.module.css";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const MES_ABBR_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function fmtPrazo(prazo) {
  if (!prazo) return null;
  const [m, y] = String(prazo).split("/").map(Number);
  if (!m || !y) return null;
  return `até ${MES_ABBR_PT[m - 1]}/${String(y).slice(2)}`;
}

// Cores de cada fonte de renda
const FONTE = {
  "CLT":         { key: "CLT",         color: "#38bdf8", hint: "salário" },
  "PDV":         { key: "PDV",         color: "#34d399", hint: "Ponto de Vista" },
  "Empréstimos": { key: "EMPRESTIMOS", color: "#fbbf24", hint: "a receber de terceiros" },
};
const TOOLTIP_BOX = { background: "#15161f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12, padding: "8px 12px" };

const lbl = { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8 };
const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12,
  padding: "11px 14px", color: "#f4f5f7", fontSize: 14, outline: "none", fontFamily: "inherit", colorScheme: "dark", boxSizing: "border-box",
};

const EDIT_ICON  = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>;
const TRASH_ICON = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>;
const CHECK_ICON = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;

export default function IncomePage() {
  const { data, loading, error, hideNumbers, refetch } = useFinance();
  const fmt = (v) => fmtFin(v, hideNumbers);
  const [toggling, setToggling] = useState(new Set());

  const [modal, setModal]       = useState(false);
  const [editingItem, setEditingItem] = useState(null); // nome do item quando editando
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [form, setForm]         = useState({ grupo: "PDV", item: "", valor: "", confirmado: false, prazo: "" });

  const [deleting, setDeleting]           = useState(null); // item sendo excluído
  const [deleteConfirm, setDeleteConfirm] = useState(null); // item aguardando confirmação

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  async function handleDelete(itemName) {
    if (deleteConfirm !== itemName) { setDeleteConfirm(itemName); return; }
    setDeleteConfirm(null);
    setDeleting(itemName);
    try {
      const res = await fetch("/api/finance/ganho/add", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemName }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      showToast("✓ Ganho removido");
      refetch(true);
    } catch (err) {
      showToast(`⚠ ${err.message}`);
    } finally {
      setDeleting(null);
    }
  }

  function openAdd() {
    setEditingItem(null);
    setForm({ grupo: "PDV", item: "", valor: "", confirmado: false, prazo: "" });
    setModal(true);
  }

  function openEdit(item, grupoLabel) {
    setEditingItem(item.item);
    setForm({ grupo: FONTE[grupoLabel]?.key ?? "PDV", item: item.item, valor: String(item.valor), confirmado: item.confirmado, prazo: item.prazo ?? "" });
    setModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.item.trim() || !form.valor || parseFloat(form.valor) <= 0) return;
    setSaving(true);
    try {
      const isEdit = editingItem !== null;
      const prazo  = form.grupo === "EMPRESTIMOS" ? form.prazo.trim() : "";
      const res = await fetch("/api/finance/ganho/add", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit
          ? { itemAtual: editingItem, grupo: form.grupo, item: form.item.trim(), valor: parseFloat(form.valor), confirmado: form.confirmado, prazo }
          : { grupo: form.grupo, item: form.item.trim(), valor: parseFloat(form.valor), confirmado: form.confirmado, prazo }
        ),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      showToast(isEdit ? "✓ Ganho atualizado!" : "✓ Ganho adicionado!");
      setModal(false);
      refetch(true);
    } catch (err) {
      showToast(`⚠ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const handleToggle = useCallback(async (item) => {
    if (toggling.has(item.item)) return;
    setToggling(p => new Set(p).add(item.item));
    try {
      const res = await fetch("/api/finance/ganho/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: item.item, confirmado: !item.confirmado }),
      });
      const j = await res.json();
      if (j.ok) refetch(true);
    } finally {
      setToggling(p => { const s = new Set(p); s.delete(item.item); return s; });
    }
  }, [toggling, refetch]);

  const ganhos = data?.ganhos ?? {};
  const allGroups = [
    { label: "CLT",         items: ganhos.items?.clt         ?? [], total: ganhos.clt         ?? 0 },
    { label: "PDV",         items: ganhos.items?.pdv         ?? [], total: ganhos.pdv         ?? 0 },
    { label: "Empréstimos", items: ganhos.items?.emprestimos ?? [], total: ganhos.emprestimos ?? 0 },
  ];
  const incomeGroups = allGroups.filter(g => g.items.length > 0);
  const grandTotal   = incomeGroups.reduce((s, g) => s + g.total, 0);

  const todos      = incomeGroups.flatMap(g => g.items);
  // Os totais da planilha só somam o que já foi recebido; aqui o previsto soma todos os itens.
  const recebido   = todos.filter(i => i.confirmado).reduce((s, i) => s + (i.valor || 0), 0);
  const aReceber   = todos.filter(i => !i.confirmado).reduce((s, i) => s + (i.valor || 0), 0);
  const previsto   = recebido + aReceber;
  const pctRec     = previsto > 0 ? Math.round((recebido / previsto) * 100) : 0;
  const corRec     = pctRec >= 80 ? "#34d399" : pctRec >= 40 ? "#fbbf24" : "#fb7185";
  const donut      = incomeGroups.map(g => ({ name: g.label, value: g.total })).filter(d => d.value > 0);

  return (
    <div className={ex.page} style={{ background: "radial-gradient(50% 35% at 85% 0%, rgba(52,211,153,0.10), transparent 70%), #07080c" }}>
      <ModuleHeader title="Ganhos" hideOnDesktop />
      <Navigation />

      {toast && <div className={ex.toast}>{toast}</div>}

      {/* Janela de novo / editar ganho */}
      {modal && (
        <div className={ex.overlay} onClick={() => setModal(false)}>
          <div className={ex.modal} onClick={e => e.stopPropagation()}>
            <div className={ex.modalTop}>
              <h3 className={ex.modalTitle}>{editingItem ? "Editar ganho" : "Novo ganho"}</h3>
              <button type="button" className={ex.closeBtn} onClick={() => setModal(false)} title="Fechar">✕</button>
            </div>
            <p className={ex.modalSub}>{editingItem ? "Altere o que precisar e salve." : "Adicione uma nova fonte de renda do mês."}</p>
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lbl}>Fonte</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(FONTE).map(([label, f]) => {
                    const on = form.grupo === f.key;
                    return (
                      <button key={f.key} type="button" onClick={() => setForm(x => ({ ...x, grupo: f.key }))} style={{
                        display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", borderRadius: 99,
                        fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .15s",
                        color: on ? "#fff" : "rgba(255,255,255,0.65)",
                        background: on ? `${f.color}2e` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${on ? `${f.color}8c` : "rgba(255,255,255,0.08)"}`,
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.color, boxShadow: `0 0 8px ${f.color}` }} />{label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={lbl}>Nome</label>
                <input value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} placeholder="Ex: Freela XYZ" required style={inputStyle} />
              </div>
              <div>
                <label style={lbl}>Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" required
                  style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }} />
              </div>
              {form.grupo === "EMPRESTIMOS" && (
                <div>
                  <label style={lbl}>Prazo final (M/AAAA)</label>
                  <input value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} placeholder="Ex: 4/2027" required style={inputStyle} />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>Mês em que esse recebimento termina e sai da projeção.</p>
                </div>
              )}
              {/* Já recebido — interruptor */}
              <button type="button" onClick={() => setForm(f => ({ ...f, confirmado: !f.confirmado }))} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                padding: "12px 14px", borderRadius: 14, fontFamily: "inherit", cursor: "pointer", transition: "all .2s",
                background: form.confirmado ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${form.confirmado ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)"}`,
              }}>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#fff" }}>✓ Já recebido</span>
                  <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>O dinheiro já caiu na conta este mês</span>
                </span>
                <span style={{ width: 42, height: 24, borderRadius: 99, padding: 3, flexShrink: 0, background: form.confirmado ? "#34d399" : "rgba(255,255,255,0.15)", transition: "all .2s" }}>
                  <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: "#fff", transform: form.confirmado ? "translateX(18px)" : "none", transition: "transform .2s" }} />
                </span>
              </button>
              <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <button type="button" onClick={() => setModal(false)}
                  style={{ height: 42, padding: "0 18px", borderRadius: 99, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", background: "transparent", border: "none", fontFamily: "inherit", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !form.item || !form.valor}
                  style={{ height: 42, padding: "0 24px", borderRadius: 99, fontSize: 14, fontWeight: 700, color: "#0b0b10", background: "#fff", border: "none", fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 24px rgba(255,255,255,0.12)", opacity: (saving || !form.item || !form.valor) ? 0.5 : 1 }}>
                  {saving ? "Salvando…" : editingItem ? "Salvar" : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <header className={ex.top}>
        <div className={ex.topLeft}>
          <span className={ex.eyebrow}>Financeiro · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
          <h1 className={ex.title}>Ganhos</h1>
        </div>
        <div className={ex.topRight}>
          <FinanceOcultarBtn className={ex.pillBtn} />
          <button className={ex.primaryBtn} onClick={openAdd}>
            <span className={ex.plus}>+</span> Registrar
          </button>
        </div>
      </header>

      {loading && <div className={ex.loading}>Carregando…</div>}
      {error && !loading && (
        <div className={ex.errorBox}>
          <p><b>Erro ao carregar.</b> {error}</p>
          <button onClick={refetch} className={ex.retryBtn}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Big numbers */}
          <div className={ex.tabs}>
            {[
              ...allGroups.map(g => ({ label: g.label, value: g.total, color: FONTE[g.label].color, hint: FONTE[g.label].hint })),
              { label: "Total", value: grandTotal, color: "#a78bfa", hint: "somando tudo" },
            ].map(s => (
              <div key={s.label} className={ex.tabBox} style={{ "--t": s.color }}>
                <span className={ex.tabLabel}><span className={ex.tabDot} />{s.label}</span>
                <span className={ex.tabValue} style={{ color: s.color }}>{fmt(s.value)}</span>
                <span className={ex.tabHint}>{s.hint}</span>
              </div>
            ))}
          </div>

          <div className={ex.layout}>
            <div className={ex.mainArea}>
              {incomeGroups.length === 0 ? (
                <p className={ex.empty}>Nenhuma fonte de renda encontrada para este mês.</p>
              ) : incomeGroups.map(group => {
                const gc    = FONTE[group.label].color;
                const recQt = group.items.filter(i => i.confirmado).length;
                return (
                  <section key={group.label} className={ex.listPanel}>
                    <div className={ex.sectionHead}>
                      <span className={ex.sectionDot} style={{ background: gc, boxShadow: `0 0 10px ${gc}` }} />
                      <span className={ex.sectionName}>{group.label}</span>
                      <span className={ex.sectionCount}>{recQt}/{group.items.length} recebidos</span>
                      <span className={ex.sectionTotal}>{fmt(group.total)}</span>
                    </div>
                    <div className={ex.rows}>
                      {group.items.map(item => {
                        const busy   = toggling.has(item.item);
                        const prazo  = fmtPrazo(item.prazo);
                        const isConf = deleteConfirm === item.item;
                        return (
                          <div key={item.item} className={`${ex.uRow} ${item.confirmado ? ex.rowDone : ""}`} style={{ "--c": gc }}>
                            <span className={ex.uLead}>
                              <button onClick={() => handleToggle(item)}
                                className={`${ex.check} ${item.confirmado ? ex.checkOn : ""} ${busy ? ex.checkBusy : ""}`}
                                title={item.confirmado ? "Desmarcar recebimento" : "Marcar como recebido"}>{CHECK_ICON}</button>
                            </span>
                            <div className={`${ex.uName} ${ex.uWide}`}>
                              <span className={`${ex.rowName} ${item.confirmado ? ex.struck : ""}`}>{item.item}</span>
                              <span className={ex.uSub} style={{ color: item.confirmado ? "#34d399" : "#fbbf24" }}>
                                {item.confirmado ? "recebido" : "a receber"}{prazo ? <em style={{ color: "rgba(255,255,255,0.45)" }}> · {prazo}</em> : null}
                              </span>
                            </div>
                            <span className={ex.uAux} />
                            <span className={ex.uVal}><b>{fmt(item.valor)}</b></span>
                            <div className={ex.uActs}>
                              <button onClick={() => openEdit(item, group.label)} title="Editar" className={ex.iconBtn}>{EDIT_ICON}</button>
                              {isConf ? (
                                <button onClick={() => handleDelete(item.item)} disabled={deleting === item.item} className={ex.confirmBtn}
                                  onBlur={() => setTimeout(() => setDeleteConfirm(v => v === item.item ? null : v), 200)}>
                                  {deleting === item.item ? "…" : "Excluir?"}
                                </button>
                              ) : (
                                <button onClick={() => handleDelete(item.item)} title="Excluir" className={`${ex.iconBtn} ${ex.dangerBtn}`}>{TRASH_ICON}</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className={ex.side}>
              {/* Recebido no mês */}
              <div className={ex.panel}>
                <div className={ex.panelTitle}>Recebido no mês</div>
                <div className={ex.ringPanel}>
                  <Ring pct={pctRec} color={corRec} size={108} stroke={10}>
                    <span className={ex.ringPct}>{pctRec}%</span>
                    <span className={ex.ringSub}>recebido</span>
                  </Ring>
                  <div className={ex.ringInfo}>
                    <span className={ex.bigValue} style={{ color: "#34d399" }}>{fmt(recebido)}</span>
                    <span className={ex.muted}>já caiu na conta</span>
                    <div className={ex.pair}>
                      <div><span className={ex.pairLbl}>Previsto</span><span className={ex.pairVal}>{fmt(previsto)}</span></div>
                      <div><span className={ex.pairLbl}>A receber</span><span className={ex.pairVal} style={{ color: "#fbbf24" }}>{fmt(aReceber)}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Por fonte */}
              <div className={ex.panel}>
                <div className={ex.panelTitle}>Por fonte</div>
                {donut.length === 0 ? <p className={ex.empty}>Sem dados</p> : (
                  <>
                    <div style={{ position: "relative" }}>
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                          <Pie data={donut} cx="50%" cy="50%" innerRadius={60} outerRadius={84} paddingAngle={2} cornerRadius={4} dataKey="value" stroke="none">
                            {donut.map(d => <Cell key={d.name} fill={FONTE[d.name].color} />)}
                          </Pie>
                          <Tooltip formatter={v => [fmt(v)]} contentStyle={TOOLTIP_BOX} itemStyle={{ color: "#e5e7eb" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{fmt(grandTotal)}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>total</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                      {donut.map(d => (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 4, background: FONTE[d.name].color }} />
                          <span style={{ flex: 1, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{d.name}</span>
                          <span style={{ color: "#fff", fontWeight: 700 }}>{fmt(d.value)}</span>
                          <span style={{ minWidth: 38, textAlign: "right", fontWeight: 800, color: FONTE[d.name].color }}>{grandTotal > 0 ? Math.round(d.value / grandTotal * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
