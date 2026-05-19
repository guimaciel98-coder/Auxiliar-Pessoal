"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Finance.module.css";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import {
  PieChart, Pie, Cell, Label, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316", "#ef4444"];
const TOOLTIP_BOX  = {
  background: "#1f2937", border: "1px solid rgba(55,65,81,0.7)",
  borderRadius: 10, color: "#f9fafb", fontSize: 12, padding: "8px 12px",
};

function toSheetMonth(input) {
  if (!input) return "";
  const [y, m] = input.split("-");
  return `${m}/${y}`;
}
const ABBRS_PARC = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function fmtMonthYear(mmyyyy) {
  if (!mmyyyy) return "—";
  const [m, y] = mmyyyy.split("/");
  return `${ABBRS_PARC[parseInt(m,10)-1] ?? m}/${String(y ?? "").slice(-2)}`;
}
const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  padding: "10px 12px", color: "#f0f0f8", fontSize: 14, outline: "none",
  fontFamily: "inherit",
};
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function budgetBarColor(pct) {
  if (pct >= 100) return "#ef4444";
  if (pct >= 70)  return "#f59e0b";
  return "#10b981";
}
function groupByGrupo(items) {
  return items.reduce((acc, item) => {
    const g = item.grupo || "Outros";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});
}

const GROUP_COLOR = {
  casa:    "#3b82f6",
  pessoal: "#10b981",
  outros:  "#8b5cf6",
};
function grpColor(grupo) {
  return GROUP_COLOR[String(grupo).toLowerCase()] ?? "#6b7280";
}

function DonutCenter({ viewBox, total }) {
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 8}  textAnchor="middle" fill="#6b7280" fontSize={10} fontWeight={600}>TOTAL</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#f9fafb" fontSize={13} fontWeight={800}>{total}</text>
    </g>
  );
}

function renderDonutLabel({ cx, cy, midAngle, outerRadius, percent, name }) {
  if (percent < 0.04) return null;
  const r = outerRadius + 14;
  const x = cx + r * Math.cos(-(midAngle * Math.PI) / 180);
  const y = cy + r * Math.sin(-(midAngle * Math.PI) / 180);
  return (
    <text x={x} y={y} textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central" fill="#9ca3af" fontSize={9.5} fontWeight={500}>
      {`${name} ${Math.round(percent * 100)}%`}
    </text>
  );
}

export default function ExpensesPage() {
  const { data, loading, error, refetch, hideNumbers } = useFinance();
  const fmt = (v) => fmtFin(v, hideNumbers);
  const [tab, setTab]               = useState("variaveis");
  const [openGroups, setOpenGroups] = useState({});
  const [createModal, setCreateModal] = useState(false);
  const [createTab, setCreateTab]     = useState("variavel");
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm]   = useState({ nome: "", grupo: "Pessoal", previsao: "" });
  const [toast, setToast]           = useState(null);
  // Overrides otimistas para o ctrl dos fixos (item → boolean)
  const [ctrlOvr, setCtrlOvr]       = useState({});
  const [toggling, setToggling]     = useState(new Set());

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  async function toggleCtrl(itemName, currentCtrl) {
    if (toggling.has(itemName)) return;
    const newCtrl = !currentCtrl;
    // Update otimista
    setCtrlOvr(p => ({ ...p, [itemName]: newCtrl }));
    setToggling(p => new Set(p).add(itemName));
    try {
      const res  = await fetch("/api/finance/fixo/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemName, ctrl: newCtrl }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
    } catch (err) {
      // Reverte em caso de erro
      setCtrlOvr(p => ({ ...p, [itemName]: currentCtrl }));
      showToast(`⚠ Erro ao atualizar: ${err.message}`);
    } finally {
      setToggling(p => { const s = new Set(p); s.delete(itemName); return s; });
    }
  }


  const variaveis  = data?.gastos?.variaveis?.items ?? [];
  const fixos      = data?.gastos?.fixos?.items     ?? [];
  const fixoGroups = useMemo(() => groupByGrupo(fixos), [fixos]);

  // ── Parcelas — dados ricos do endpoint próprio ──────────────────────────────
  const [parcItems,        setParcItems]        = useState([]);
  const [parcLoading,      setParcLoading]      = useState(false);
  const [parcRemoving,     setParcRemoving]     = useState(new Set());
  const [parcConfirm,      setParcConfirm]      = useState(null);
  const [parcSaving,       setParcSaving]       = useState(false);
  const [parcApplying,     setParcApplying]     = useState(false);
  const [parcForm,         setParcForm]         = useState({
    nome: "", valorTotal: "",
    dataInicio: new Date().toISOString().slice(0, 7),
    dataFim:    new Date().toISOString().slice(0, 7),
  });

  const loadParcelas = useCallback(async () => {
    setParcLoading(true);
    try {
      const r = await fetch("/api/finance/installments", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setParcItems(d.items);
    } finally { setParcLoading(false); }
  }, []);

  useEffect(() => { if (tab === "parcelas") loadParcelas(); }, [tab, loadParcelas]);

  const [parcPaying, setParcPaying] = useState(new Set());

  async function handleParcPay(item) {
    if (parcPaying.has(item.sheetRow)) return;
    setParcPaying(p => new Set(p).add(item.sheetRow));
    try {
      const res  = await fetch("/api/finance/installments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetRow: item.sheetRow }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast(`✓ Parcela paga — ${json.newPagas}/${item.totalParcelas}`);
      loadParcelas();
    } catch (e) { showToast(`⚠ ${e.message}`, true); }
    finally { setParcPaying(p => { const s = new Set(p); s.delete(item.sheetRow); return s; }); }
  }

  async function handleParcReset(item) {
    if (parcPaying.has(item.sheetRow)) return;
    setParcPaying(p => new Set(p).add(item.sheetRow));
    try {
      const res  = await fetch("/api/finance/installments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetRow: item.sheetRow, action: "reset" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast("↺ Contagem zerada");
      loadParcelas();
    } catch (e) { showToast(`⚠ ${e.message}`, true); }
    finally { setParcPaying(p => { const s = new Set(p); s.delete(item.sheetRow); return s; }); }
  }

  async function handleParcRemove(item) {
    if (parcConfirm !== item.sheetRow) { setParcConfirm(item.sheetRow); return; }
    setParcConfirm(null);
    setParcRemoving(p => new Set(p).add(item.sheetRow));
    try {
      const res  = await fetch("/api/finance/installments/remove", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetRow: item.sheetRow }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setParcItems(p => p.filter(i => i.sheetRow !== item.sheetRow));
      showToast(`🗑 ${item.nome} removido`);
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setParcRemoving(p => { const s = new Set(p); s.delete(item.sheetRow); return s; }); }
  }

  async function handleParcSubmit(e) {
    e.preventDefault();
    setParcSaving(true);
    try {
      const res  = await fetch("/api/finance/installments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome:       parcForm.nome,
          valorTotal: parseFloat(parcForm.valorTotal),
          dataInicio: toSheetMonth(parcForm.dataInicio),
          dataFim:    toSheetMonth(parcForm.dataFim),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast(`✓ ${parcForm.nome} adicionado`);
      setCreateModal(false);
      setParcForm({ nome: "", valorTotal: "", dataInicio: new Date().toISOString().slice(0, 7), dataFim: new Date().toISOString().slice(0, 7) });
      loadParcelas();
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setParcSaving(false); }
  }

  async function handleParcFormulas() {
    setParcApplying(true);
    try {
      const res  = await fetch("/api/finance/installments", { method: "PUT" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast(`✓ Fórmulas aplicadas em ${json.rowsUpdated} linha(s)`);
      loadParcelas();
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setParcApplying(false); }
  }

  // Totais para o sumário
  const totalVariaveis = data?.gastos?.variaveis?.realTotal ?? 0;
  const totalFixos     = data?.gastos?.fixos?.realTotal     ?? 0;
  const totalParcelas  = (data?.compromissos?.items ?? []).reduce((s, c) => s + c.valorMensal, 0);
  const totalGeral     = totalVariaveis + totalFixos + totalParcelas;

  // Donut — gastos por grupo (fixos + variáveis)
  const donutData = useMemo(() => {
    const byGrupo = {};
    for (const item of [...fixos, ...variaveis]) {
      const g = item.grupo || "Outros";
      byGrupo[g] = (byGrupo[g] || 0) + item.real;
    }
    return Object.entries(byGrupo)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [fixos, variaveis]);
  const totalGastoDonut = donutData.reduce((s, d) => s + d.value, 0);

  // Donut exclusivo de fixos — usado na aba Gastos Fixos
  const fixosDonutData = useMemo(() => {
    const byGrupo = {};
    for (const item of fixos) {
      const g = item.grupo || "Outros";
      byGrupo[g] = (byGrupo[g] || 0) + item.real;
    }
    return Object.entries(byGrupo)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [fixos]);
  const fixosDonutTotal = fixosDonutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className={styles.container}>
      <ModuleHeader title="Gastos" />
      <Navigation />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: "rgba(17,24,39,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#f0f0f8", padding: "10px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}

      {/* Header — único ponto de entrada para o modal */}
      <header className={styles.header}>
        <div>
          <h1>Gastos</h1>
          <p>{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
        </div>
        <button className={styles.addBtn} onClick={() => { setCreateModal(true); setCreateTab("variavel"); setCreateForm({ nome: "", grupo: "Pessoal", previsao: "" }); }}>+ Registrar</button>
      </header>

      {loading && <div className={styles.loading}>Carregando...</div>}
      {error && !loading && (
        <div className={styles.errorCard}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Erro ao carregar</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{error}</p>
          <button onClick={refetch} className={styles.retryBtn}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── Big Numbers — clicáveis, associados às abas ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "0 28px", marginBottom: 20 }}>
            {[
              { label: "Variáveis", value: totalVariaveis, color: "#f59e0b", icon: "💸", tabKey: "variaveis" },
              { label: "Fixos",     value: totalFixos,     color: "#3b82f6", icon: "📋", tabKey: "fixos"     },
              { label: "Parcelas",  value: totalParcelas,  color: "#8b5cf6", icon: "💳", tabKey: "parcelas"  },
              { label: "Total",     value: totalGeral,     color: "#ef4444", icon: "🧾", tabKey: null         },
            ].map(s => {
              const isActive = s.tabKey && tab === s.tabKey;
              return (
                <div
                  key={s.label}
                  onClick={() => s.tabKey && setTab(s.tabKey)}
                  className="fin-stat-card"
                  style={{
                    cursor: s.tabKey ? "pointer" : "default",
                    border: isActive
                      ? `1px solid ${s.color}55`
                      : "1px solid rgba(255,255,255,0.07)",
                    background: isActive
                      ? `rgba(${s.color === "#f59e0b" ? "245,158,11" : s.color === "#3b82f6" ? "59,130,246" : s.color === "#8b5cf6" ? "139,92,246" : "239,68,68"},0.08)`
                      : undefined,
                    boxShadow: isActive ? `0 0 18px ${s.color}20` : undefined,
                    transition: "all 0.2s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Indicador inferior colorido quando ativo */}
                  {isActive && (
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      height: 3, background: s.color, borderRadius: "0 0 99px 99px",
                    }} />
                  )}
                  <span className="fin-stat-icon">{s.icon}</span>
                  <span className="fin-stat-value" style={{ color: s.color }}>{fmt(s.value)}</span>
                  <span className="fin-stat-label">{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* ════ Tab: Variáveis ════ */}
          {tab === "variaveis" && (
            <div className={styles.body}>
              {/* ── Coluna principal: cards de progresso ── */}
              <div className={styles.mainCol}>
                <div className={styles.content} style={{ paddingBottom: 80 }}>
                  {variaveis.length === 0 ? (
                    <p style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>
                      Nenhum gasto variável cadastrado.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {variaveis.map(item => {
                        const pct        = item.previsao > 0 ? Math.round((item.real / item.previsao) * 100) : 0;
                        const overBudget = item.real > item.previsao;
                        const diff       = Math.abs(item.real - item.previsao);
                        const barColor   = budgetBarColor(pct);
                        return (
                          <div key={item.item} style={{
                            padding: "14px 18px",
                            borderRadius: 14,
                            background: overBudget ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.03)",
                            border: overBudget ? "1px solid rgba(239,68,68,0.15)" : "1px solid rgba(255,255,255,0.07)",
                            borderLeft: `3px solid ${barColor}`,
                          }}>
                            {/* Linha topo: nome + valores */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{item.item}</span>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 4, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: overBudget ? "#f87171" : "var(--text-primary)" }}>{fmt(item.real)}</span>
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ {fmt(item.previsao)}</span>
                              </div>
                            </div>
                            {/* Barra */}
                            <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                              <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 99, transition: "width 0.6s ease" }} />
                            </div>
                            {/* Linha rodapé: status + % */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: overBudget ? "#f87171" : "#10b981" }}>
                                {overBudget ? `↑ Ultrapassado ${fmt(diff)}` : `✓ Disponível ${fmt(diff)}`}
                              </span>
                              <span style={{
                                fontSize: 11, fontWeight: 800, fontFamily: "var(--font-mono)",
                                padding: "2px 9px", borderRadius: 99,
                                background: overBudget ? "rgba(239,68,68,0.15)" : pct >= 70 ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                                color: barColor,
                              }}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Coluna lateral: gráfico de barras ── */}
              <div className={styles.sideCol}>
                <div className={styles.sidePanel}>
                  <div className={styles.sidePanelTitle}>Previsto vs Real</div>
                  <div style={{ padding: "16px 8px 12px" }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={variaveis.map(i => ({
                          name: i.item,
                          Previsto: i.previsao,
                          Real:     i.real,
                        }))}
                        margin={{ top: 8, right: 20, left: 12, bottom: 52 }}
                        barGap={3}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 13, fontWeight: 600 }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={TOOLTIP_BOX}
                          formatter={(v, name) => [fmt(v), name]}
                          itemStyle={{ color: "#d1d5db" }}
                        />
                        <Bar dataKey="Previsto" fill="rgba(255,255,255,0.12)" radius={[4,4,0,0]} />
                        <Bar dataKey="Real" radius={[4,4,0,0]}>
                          {variaveis.map((item, i) => (
                            <Cell key={i} fill={budgetBarColor(item.previsao > 0 ? Math.round((item.real / item.previsao) * 100) : 0)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Legenda */}
                    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
                        Previsto
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }} />
                        Real
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Saldo Disponível ── */}
                <div className={styles.sidePanel} style={{ marginTop: 12 }}>
                  <div className={styles.sidePanelTitle}>Saldo Disponível</div>
                  <div style={{ padding: "16px 14px" }}>
                    {(() => {
                      const prevTotal = data?.gastos?.variaveis?.previsaoTotal
                        ?? variaveis.reduce((s, i) => s + (i.previsao || 0), 0);
                      const saldo  = prevTotal - totalVariaveis;
                      const rawPct = prevTotal > 0 ? Math.round((totalVariaveis / prevTotal) * 100) : 0;
                      const barPct = Math.min(rawPct, 100);
                      const color  = saldo < 0 ? "#ef4444" : rawPct >= 70 ? "#f59e0b" : "#10b981";
                      return (
                        <>
                          {/* Número principal */}
                          <div style={{ textAlign: "center", marginBottom: 18 }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>
                              {saldo < 0 ? "-" : ""}{fmt(Math.abs(saldo))}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                              {saldo < 0 ? "acima do previsto" : "disponível para gastar"}
                            </div>
                          </div>

                          {/* Barra de progresso */}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 10, color: "var(--text-muted)" }}>
                              <span>0%</span>
                              <span style={{ color, fontWeight: 700 }}>{rawPct}% utilizado</span>
                              <span>100%</span>
                            </div>
                            <div style={{ height: 7, background: "rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${barPct}%`, background: color, borderRadius: 8 }} />
                            </div>
                          </div>

                          {/* Stats */}
                          <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            {[
                              { label: "Previsto", value: prevTotal,      col: "rgba(255,255,255,0.45)" },
                              { label: "Gasto",    value: totalVariaveis, col: color },
                            ].map(s => (
                              <div key={s.label} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  {s.label}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: s.col }}>
                                  {fmt(s.value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ Tab: Fixos — cards visuais por grupo ════ */}
          {tab === "fixos" && (() => {
            const totalPagos   = fixos.filter(i => ctrlOvr[i.item] ?? i.ctrl).length;
            const pctPagos     = fixos.length > 0 ? Math.round((totalPagos / fixos.length) * 100) : 0;
            return (
              <div className={styles.body}>
                <div className={styles.mainCol}>
                  <div className={styles.content} style={{ paddingBottom: 80 }}>

                    {/* ── Grupos ── */}
                    {Object.keys(fixoGroups).length === 0 ? (
                      <p style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>
                        Nenhum gasto fixo encontrado.
                      </p>
                    ) : Object.entries(fixoGroups).map(([grupo, items]) => {
                      const gc         = grpColor(grupo);
                      const groupTotal = items.reduce((s, i) => s + i.real, 0);
                      const grpPagos   = items.filter(i => ctrlOvr[i.item] ?? i.ctrl).length;
                      return (
                        <div key={grupo} style={{ marginBottom: 32 }}>
                          {/* Label do grupo */}
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            marginBottom: 14, paddingBottom: 12,
                            borderBottom: `1.5px solid ${gc}30`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 5, height: 22, borderRadius: 2, background: gc }} />
                              <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: gc }}>
                                {grupo}
                              </span>
                              <span style={{
                                fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                                background: `${gc}15`, color: gc, border: `1px solid ${gc}30`,
                              }}>
                                {grpPagos}/{items.length}
                              </span>
                            </div>
                            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                              {fmt(groupTotal)}
                            </span>
                          </div>

                          {/* Cards dos itens */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {items.map(item => {
                              const prazoMatch  = item.item.match(/\((Até [^)]+)\)$/i);
                              const prazo       = prazoMatch ? prazoMatch[1] : null;
                              const nomeLimpo   = prazo ? item.item.replace(/\s*\(Até [^)]+\)$/i, "").trim() : item.item;
                              const isCommit    = !!prazo;
                              const ctrl        = ctrlOvr[item.item] ?? item.ctrl;
                              const isToggling  = toggling.has(item.item);

                              return (
                                <div key={item.item} style={{
                                  display: "flex", alignItems: "center", gap: 14,
                                  padding: "13px 16px",
                                  borderRadius: 14,
                                  background: ctrl
                                    ? "rgba(255,255,255,0.02)"
                                    : isCommit
                                      ? "rgba(251,191,36,0.05)"
                                      : "rgba(255,255,255,0.05)",
                                  border: ctrl
                                    ? "1px solid rgba(255,255,255,0.05)"
                                    : isCommit
                                      ? "1px solid rgba(251,191,36,0.15)"
                                      : `1px solid ${gc}20`,
                                  borderLeft: `3px solid ${ctrl ? `${isCommit ? "#f59e0b" : gc}55` : isCommit ? "#f59e0b" : gc}`,
                                  transition: "background 0.2s, border 0.2s",
                                }}>
                                  {/* Ícone de status — clicável */}
                                  <div
                                    onClick={() => toggleCtrl(item.item, ctrl)}
                                    style={{
                                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 16, fontWeight: 900,
                                      background: ctrl ? "rgba(16,185,129,0.12)" : `${gc}18`,
                                      color:      ctrl ? "#10b981"               : gc,
                                      border:     `1.5px solid ${ctrl ? "rgba(16,185,129,0.3)" : `${gc}40`}`,
                                      cursor:  isToggling ? "wait" : "pointer",
                                      opacity: isToggling ? 0.4 : 1,
                                      transition: "all 0.2s",
                                    }}
                                  >
                                    {ctrl ? "✓" : "○"}
                                  </div>

                                  {/* Nome + prazo */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      fontSize: 15, fontWeight: ctrl ? 400 : 600,
                                      color: ctrl ? "rgba(255,255,255,0.35)" : "var(--text-primary)",
                                      textDecoration: ctrl ? "line-through" : "none",
                                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                      transition: "all 0.2s",
                                    }}>
                                      {nomeLimpo}
                                    </div>
                                    {prazo && (
                                      <div style={{
                                        display: "inline-flex", alignItems: "center", gap: 3,
                                        marginTop: 4, fontSize: 11, fontWeight: 700,
                                        color: "#f59e0b",
                                      }}>
                                        ⏱ {prazo}
                                      </div>
                                    )}
                                  </div>

                                  {/* Valor */}
                                  <div style={{
                                    fontSize: 15, fontWeight: 700,
                                    fontFamily: "var(--font-mono)", flexShrink: 0,
                                    color: ctrl ? "rgba(255,255,255,0.28)" : "#e5e7eb",
                                    transition: "color 0.2s",
                                  }}>
                                    {fmt(item.real)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Coluna lateral */}
                <div className={styles.sideCol}>

                  {/* ── Gastos por Grupo (apenas fixos) ── */}
                  <div className={styles.sidePanel}>
                    <div className={styles.sidePanelTitle}>Gastos por Grupo</div>
                    <div style={{ padding: "8px 0 12px", position: "relative" }}>
                      {fixosDonutData.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "var(--text-muted)" }}>Sem dados</div>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={360}>
                            <PieChart margin={{ top: 34, right: 68, bottom: 34, left: 68 }}>
                              <Pie
                                data={fixosDonutData} cx="50%" cy="50%"
                                innerRadius={82} outerRadius={112}
                                paddingAngle={3} dataKey="value"
                                labelLine={false}
                                label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                                  if (percent < 0.04) return null;
                                  const R = Math.PI / 180;
                                  const r = outerRadius + 24;
                                  const x = cx + r * Math.cos(-midAngle * R);
                                  const y = cy + r * Math.sin(-midAngle * R);
                                  return (
                                    <text
                                      x={x} y={y}
                                      textAnchor={x > cx ? "start" : "end"}
                                      dominantBaseline="central"
                                      fill="#d1d5db" fontSize={13} fontWeight={700}
                                    >
                                      {`${name} ${Math.round(percent * 100)}%`}
                                    </text>
                                  );
                                }}
                              >
                                {fixosDonutData.map((d) => (
                                  <Cell key={d.name} fill={grpColor(d.name)} stroke="none" />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={v => [`${fmt(v)} (${fixosDonutTotal > 0 ? Math.round(v / fixosDonutTotal * 100) : 0}%)`]}
                                contentStyle={TOOLTIP_BOX} itemStyle={{ color: "#d1d5db" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>

                          {/* Centro do donut via CSS — evita o artefato "-" do recharts Label */}
                          <div style={{
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none",
                          }}>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 9, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>TOTAL</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb" }}>{fmt(fixosDonutTotal)}</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Confirmados ── */}
                  <div className={styles.sidePanel} style={{ marginTop: 12 }}>
                    <div className={styles.sidePanelTitle}>Confirmados</div>
                    <div style={{ padding: "16px 14px" }}>
                      {(() => {
                        const valorConfirmado = fixos
                          .filter(i => ctrlOvr[i.item] ?? i.ctrl)
                          .reduce((s, i) => s + i.real, 0);
                        const cor = pctPagos >= 80 ? "#10b981" : pctPagos >= 50 ? "#f59e0b" : "#ef4444";
                        return (
                          <>
                            {/* Número principal */}
                            <div style={{ textAlign: "center", marginBottom: 18 }}>
                              <div style={{ fontSize: 22, fontWeight: 900, color: cor, lineHeight: 1 }}>
                                {totalPagos}
                                <span style={{ fontSize: 16, color: "var(--text-muted)", fontWeight: 400 }}> / {fixos.length}</span>
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                                itens confirmados
                              </div>
                            </div>

                            {/* Barra de progresso */}
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 10, color: "var(--text-muted)" }}>
                                <span>0%</span>
                                <span style={{ color: cor, fontWeight: 700 }}>{pctPagos}% confirmado</span>
                                <span>100%</span>
                              </div>
                              <div style={{ height: 10, background: "rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pctPagos}%`, background: cor, borderRadius: 8, transition: "width 0.8s ease" }} />
                              </div>
                            </div>

                            {/* Stats */}
                            <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                              {[
                                { label: "Total Fixo",  value: totalFixos,      col: "rgba(255,255,255,0.45)" },
                                { label: "Confirmado",  value: valorConfirmado, col: cor },
                              ].map(s => (
                                <div key={s.label} style={{ textAlign: "center" }}>
                                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    {s.label}
                                  </div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: s.col, fontFamily: "var(--font-mono)" }}>
                                    {fmt(s.value)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ════ Tab: Parcelas ════ */}
          {tab === "parcelas" && (() => {
            const totalMensal  = parcItems.reduce((s, i) => s + i.valorMensal, 0);
            const totalDivida  = parcItems.reduce((s, i) => s + i.restante,    0);
            const automaticos  = parcItems.filter(i => i.auto);
            const manuais      = parcItems.filter(i => !i.auto);

            const parcPrev = (() => {
              if (!parcForm.dataInicio || !parcForm.dataFim) return null;
              const [ys, ms] = parcForm.dataInicio.split("-").map(Number);
              const [ye, me] = parcForm.dataFim.split("-").map(Number);
              const n = (ye - ys) * 12 + (me - ms) + 1;
              return n > 0 ? n : null;
            })();
            const parcMensalPreview = parcForm.valorTotal && parcPrev
              ? Math.round((parseFloat(parcForm.valorTotal) / parcPrev) * 100) / 100
              : null;

            const ParcCard = ({ item }) => {
              const pct    = item.totalParcelas > 0 ? Math.round((item.parcelasPagas / item.totalParcelas) * 100) : 0;
              const cor    = pct >= 80 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
              const isConf = parcConfirm === item.sheetRow;
              const isRem  = parcRemoving.has(item.sheetRow);
              const isPaying = parcPaying.has(item.sheetRow);
              return (
                <div style={{
                  padding: "13px 16px", borderRadius: 14,
                  background: item.auto ? "rgba(16,185,129,0.03)" : "rgba(139,92,246,0.04)",
                  border: item.auto ? "1px solid rgba(16,185,129,0.12)" : "1px solid rgba(139,92,246,0.15)",
                  borderLeft: `3px solid ${cor}`,
                  display: "flex", alignItems: "flex-start", gap: 14,
                }}>
                  {/* Círculo de pagar + reset — só manuais */}
                  {!item.auto && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, marginTop: 1 }}>
                      <div
                        onClick={() => !isPaying && handleParcPay(item)}
                        style={{
                          width: 34, height: 34, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 15, fontWeight: 900,
                          background: "rgba(139,92,246,0.12)",
                          color: "#a78bfa",
                          border: "1.5px solid rgba(139,92,246,0.35)",
                          cursor: isPaying ? "wait" : "pointer",
                          opacity: isPaying ? 0.4 : 1,
                          transition: "all 0.2s",
                        }}
                      >
                        {isPaying ? "…" : "○"}
                      </div>
                      {item.parcelasPagas > 0 && (
                        <div
                          onClick={() => !isPaying && handleParcReset(item)}
                          title="Zerar contagem"
                          style={{
                            fontSize: 10, color: "rgba(255,255,255,0.2)",
                            cursor: isPaying ? "wait" : "pointer",
                            lineHeight: 1, userSelect: "none",
                            transition: "color 0.15s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
                        >
                          ↺
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conteúdo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Linha 1: nome + auto badge + valor */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.nome}
                      </span>
                      {item.auto && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", flexShrink: 0 }}>
                          auto
                        </span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                        {fmt(item.valorMensal)}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>/mês</span>
                      </span>
                    </div>

                    {/* Barra */}
                    <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: cor, borderRadius: 99, transition: "width 0.6s ease" }} />
                    </div>

                    {/* Linha 3: X/Y + encerra + restante + remover */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
                          {item.parcelasPagas + 1}/{item.totalParcelas}
                        </span>
                        {item.dataFim && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>encerra {fmtMonthYear(item.dataFim)}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {item.restante > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#fca5a5", fontFamily: "var(--font-mono)" }}>{fmt(item.restante)}</span>
                        )}
                        <button
                          onClick={() => handleParcRemove(item)}
                          disabled={isRem}
                          onBlur={() => setTimeout(() => setParcConfirm(v => v === item.sheetRow ? null : v), 200)}
                          style={{
                            padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                            border: `1px solid ${isConf ? "rgba(239,68,68,0.5)" : "rgba(239,68,68,0.2)"}`,
                            background: isConf ? "rgba(239,68,68,0.15)" : "transparent",
                            color: isConf ? "#ef4444" : "rgba(239,68,68,0.45)",
                            cursor: "pointer", opacity: isRem ? 0.5 : 1,
                          }}
                        >
                          {isRem ? "…" : isConf ? "Confirmar?" : "✕"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div className={styles.body}>
                <div className={styles.mainCol}>
                  <div className={styles.content} style={{ paddingBottom: 80 }}>

                    {parcLoading ? (
                      <p style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>Carregando...</p>
                    ) : parcItems.length === 0 ? (
                      <p style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>Nenhuma parcela ativa.</p>
                    ) : (
                      <>
                        {/* Manuais primeiro — em destaque, com botão de pagamento */}
                        {manuais.length > 0 && (
                          <div style={{ marginBottom: 32 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 12, borderBottom: "1.5px solid rgba(139,92,246,0.3)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 5, height: 22, borderRadius: 2, background: "#8b5cf6" }} />
                                <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a78bfa" }}>Manuais</span>
                                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                                  {manuais.length}
                                </span>
                              </div>
                              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                                {fmt(manuais.reduce((s, i) => s + i.valorMensal, 0))}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>/mês</span>
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {manuais.map(i => <ParcCard key={i.sheetRow} item={i} />)}
                            </div>
                          </div>
                        )}
                        {automaticos.length > 0 && (
                          <div style={{ marginBottom: 32 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 12, borderBottom: "1.5px solid rgba(16,185,129,0.2)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 5, height: 22, borderRadius: 2, background: "#10b981" }} />
                                <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#10b981" }}>Automáticos</span>
                                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                                  {automaticos.length}
                                </span>
                              </div>
                              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                                {fmt(automaticos.reduce((s, i) => s + i.valorMensal, 0))}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>/mês</span>
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {automaticos.map(i => <ParcCard key={i.sheetRow} item={i} />)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Lateral */}
                <div className={styles.sideCol}>
                  <div className={styles.sidePanel}>
                    <div className={styles.sidePanelTitle}>Distribuição Mensal</div>
                    <div style={{ padding: "16px 8px 12px" }}>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={parcItems.map(i => ({ name: i.nome, Mensal: i.valorMensal, Restante: i.restante }))}
                          margin={{ top: 8, right: 20, left: 12, bottom: 56 }}
                          barGap={3}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0} />
                          <YAxis hide />
                          <Tooltip contentStyle={TOOLTIP_BOX} formatter={(v, name) => [fmt(v), name]} itemStyle={{ color: "#d1d5db" }} />
                          <Bar dataKey="Mensal"   fill="#f59e0b"              radius={[4,4,0,0]} />
                          <Bar dataKey="Restante" fill="rgba(239,68,68,0.45)" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
                        {[{ color: "#f59e0b", label: "Mensal" }, { color: "rgba(239,68,68,0.7)", label: "Restante" }].map(l => (
                          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} /> {l.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Resumo ── */}
                  <div className={styles.sidePanel} style={{ marginTop: 12 }}>
                    <div className={styles.sidePanelTitle}>Resumo</div>
                    <div style={{ padding: "16px 14px" }}>
                      {/* Contagem */}
                      <div style={{ textAlign: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#f59e0b", lineHeight: 1 }}>
                          {parcItems.length}
                          <span style={{ fontSize: 16, color: "var(--text-muted)", fontWeight: 400 }}> ativas</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                          {automaticos.length} auto · {manuais.length} manual
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
                        {[
                          { label: "Desembolso Mensal", value: fmt(totalMensal),   col: "var(--text-primary)" },
                          { label: "Total em Dívida",   value: fmt(totalDivida),   col: "#ef4444" },
                        ].map(s => (
                          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: s.col, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Progresso geral das parcelas */}
                      {(() => {
                        const totalPagas = parcItems.reduce((s, i) => s + i.parcelasPagas, 0);
                        const totalAll   = parcItems.reduce((s, i) => s + i.totalParcelas, 0);
                        const pct = totalAll > 0 ? Math.round((totalPagas / totalAll) * 100) : 0;
                        return (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
                              <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Parcelas pagas</span>
                              <span style={{ fontWeight: 700, color: pct >= 70 ? "#10b981" : "#f59e0b" }}>{pct}%</span>
                            </div>
                            <div style={{ height: 10, background: "rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: pct >= 70 ? "#10b981" : "#f59e0b", borderRadius: 8, transition: "width 0.8s ease" }} />
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 5, textAlign: "right" }}>
                              {totalPagas} de {totalAll} parcelas
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

        </>
      )}

      {/* Modal unificado de criação */}
      {createModal && (() => {
        const lbl = { fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };
        const btnCancel = { flex: 1, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "inherit", cursor: "pointer" };
        const btnSubmit = { flex: 2, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", border: "none", fontFamily: "inherit", cursor: "pointer", background: "linear-gradient(135deg,#10b981,#059669)" };
        const grupoSelect = (
          <div>
            <label style={lbl}>Grupo</label>
            <select value={createForm.grupo} onChange={e => setCreateForm(f => ({ ...f, grupo: e.target.value }))} style={inputStyle}>
              <option value="Casa">Casa</option>
              <option value="Pessoal">Pessoal</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
        );
        const previsaoInput = (label) => (
          <div>
            <label style={lbl}>{label}</label>
            <input required type="number" step="0.01" min="0" value={createForm.previsao} onChange={e => setCreateForm(f => ({ ...f, previsao: e.target.value }))} placeholder="Ex: 500" style={inputStyle} />
          </div>
        );
        async function submitRegister(type) {
          setCreateSaving(true);
          try {
            const res = await fetch("/api/finance/register", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type, grupo: createForm.grupo, nome: createForm.nome, previsao: parseFloat(createForm.previsao) || 0 }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error);
            showToast(`✓ ${createForm.nome} adicionado`);
            setCreateModal(false); refetch();
          } catch (err) { showToast(`⚠ ${err.message}`); }
          finally { setCreateSaving(false); }
        }
        const parcPrevModal = (() => {
          if (!parcForm.dataInicio || !parcForm.dataFim) return null;
          const [ys, ms] = parcForm.dataInicio.split("-").map(Number);
          const [ye, me] = parcForm.dataFim.split("-").map(Number);
          const n = (ye - ys) * 12 + (me - ms) + 1;
          return n > 0 ? n : null;
        })();
        const parcMensalPrevModal = parcForm.valorTotal && parcPrevModal
          ? Math.round((parseFloat(parcForm.valorTotal) / parcPrevModal) * 100) / 100
          : null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}
            onClick={() => setCreateModal(false)}>
            <div style={{ background: "rgba(17,24,39,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "32px 28px", width: "90%", maxWidth: 520, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Novo Registro</h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>Adicione um novo item às suas despesas.</p>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 3, marginBottom: 24, padding: "3px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                {[{ k: "variavel", l: "Gasto Variável" }, { k: "fixo", l: "Gasto Fixo" }, { k: "parcela", l: "Parcela" }].map(t => (
                  <button key={t.k} type="button" onClick={() => setCreateTab(t.k)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: createTab === t.k ? "rgba(255,255,255,0.09)" : "transparent", color: createTab === t.k ? "#fff" : "rgba(255,255,255,0.35)", border: "none", cursor: "pointer", transition: "all 0.2s" }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* Tab Gasto Variável */}
              {createTab === "variavel" && (
                <form onSubmit={e => { e.preventDefault(); submitRegister("variavel"); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div><label style={lbl}>Nome da Categoria</label><input autoFocus required type="text" value={createForm.nome} onChange={e => setCreateForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Academia, Streaming…" style={inputStyle} /></div>
                  {grupoSelect}
                  {previsaoInput("Previsão Mensal (R$)")}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={() => setCreateModal(false)} style={btnCancel}>Cancelar</button>
                    <button type="submit" disabled={createSaving || !createForm.nome} style={{ ...btnSubmit, opacity: (createSaving || !createForm.nome) ? 0.5 : 1 }}>{createSaving ? "Salvando..." : "Adicionar Variável"}</button>
                  </div>
                </form>
              )}

              {/* Tab Gasto Fixo */}
              {createTab === "fixo" && (
                <form onSubmit={e => { e.preventDefault(); submitRegister("fixo"); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div><label style={lbl}>Nome do Item</label><input autoFocus required type="text" value={createForm.nome} onChange={e => setCreateForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Aluguel, Internet…" style={inputStyle} /></div>
                  {grupoSelect}
                  {previsaoInput("Valor (R$)")}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={() => setCreateModal(false)} style={btnCancel}>Cancelar</button>
                    <button type="submit" disabled={createSaving || !createForm.nome} style={{ ...btnSubmit, background: "linear-gradient(135deg,#3b82f6,#2563eb)", opacity: (createSaving || !createForm.nome) ? 0.5 : 1 }}>{createSaving ? "Salvando..." : "Adicionar Fixo"}</button>
                  </div>
                </form>
              )}

              {/* Tab Parcela */}
              {createTab === "parcela" && (
                <form onSubmit={handleParcSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div><label style={lbl}>Nome da Compra</label><input autoFocus required type="text" value={parcForm.nome} onChange={e => setParcForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: iPhone 14, Notebook…" style={inputStyle} /></div>
                  <div><label style={lbl}>Valor Total (R$)</label><input required type="number" step="0.01" min="1" value={parcForm.valorTotal} onChange={e => setParcForm(p => ({ ...p, valorTotal: e.target.value }))} placeholder="Ex: 3600" style={inputStyle} /></div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>Início</label><input required type="month" value={parcForm.dataInicio} onChange={e => setParcForm(p => ({ ...p, dataInicio: e.target.value }))} style={inputStyle} /></div>
                    <div style={{ flex: 1 }}><label style={lbl}>Fim</label><input required type="month" value={parcForm.dataFim} onChange={e => setParcForm(p => ({ ...p, dataFim: e.target.value }))} style={inputStyle} /></div>
                  </div>
                  {parcPrevModal && parcMensalPrevModal && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", fontSize: 13, color: "#3b82f6", fontWeight: 600 }}>
                      → {parcPrevModal}x de {fmt(parcMensalPrevModal)}/mês
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={() => setCreateModal(false)} style={btnCancel}>Cancelar</button>
                    <button type="submit" disabled={parcSaving || !parcForm.nome || !parcForm.valorTotal || !parcPrevModal} style={{ ...btnSubmit, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", opacity: (parcSaving || !parcForm.nome || !parcForm.valorTotal || !parcPrevModal) ? 0.5 : 1 }}>{parcSaving ? "Salvando..." : "Adicionar Parcela"}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
