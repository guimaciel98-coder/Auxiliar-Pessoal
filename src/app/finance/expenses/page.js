"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Finance.module.css";
import ex from "./Expenses.module.css";
import Ring from "@/components/ui/Ring";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import {
  PieChart, Pie, Cell, Label, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
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
  border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12,
  padding: "11px 14px", color: "#f4f5f7", fontSize: 14, outline: "none",
  fontFamily: "inherit", colorScheme: "dark",
};

// Grupo em botões com bolinha de cor (no lugar da lista suspensa)
const GRUPOS = ["Casa", "Casa Nova", "Pessoal", "Outros"];
function GrupoChips({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {GRUPOS.map(g => {
        const on = value === g;
        const c  = grpColor(g);
        return (
          <button key={g} type="button" onClick={() => onChange(g)} style={{
            display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", borderRadius: 99,
            fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .15s",
            color: on ? "#fff" : "rgba(255,255,255,0.65)",
            background: on ? `${c}2e` : "rgba(255,255,255,0.04)",
            border: `1px solid ${on ? `${c}8c` : "rgba(255,255,255,0.08)"}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}` }} />{g}
          </button>
        );
      })}
    </div>
  );
}
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function budgetBarColor(pct) {
  if (pct >= 100) return "#fb7185";
  if (pct >= 70)  return "#fbbf24";
  return "#34d399";
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
  casa:       "#38bdf8",
  "casa nova": "#fbbf24",
  pessoal:    "#34d399",
  outros:     "#a78bfa",
};
const GROUP_ORDER = ["Casa Nova", "Casa", "Pessoal", "Outros"];
function grpColor(grupo) {
  return GROUP_COLOR[String(grupo).toLowerCase()] ?? "#6b7280";
}
function sortGroups(entries) {
  return [...entries].sort(([a], [b]) => {
    const ai = GROUP_ORDER.findIndex(g => g.toLowerCase() === a.toLowerCase());
    const bi = GROUP_ORDER.findIndex(g => g.toLowerCase() === b.toLowerCase());
    const ar = ai === -1 ? 999 : ai;
    const br = bi === -1 ? 999 : bi;
    return ar - br;
  });
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

function AutoToggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
      padding: "12px 14px", borderRadius: 14, fontFamily: "inherit", cursor: "pointer", transition: "all .2s",
      background: value ? "rgba(56,189,248,0.10)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${value ? "rgba(56,189,248,0.4)" : "rgba(255,255,255,0.08)"}`,
    }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#fff" }}>⚡ Pagamento automático</span>
        <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Debitado sozinho, sem precisar marcar todo mês</span>
      </span>
      {/* Interruptor */}
      <span style={{ width: 42, height: 24, borderRadius: 99, padding: 3, flexShrink: 0, background: value ? "#38bdf8" : "rgba(255,255,255,0.15)", transition: "all .2s" }}>
        <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: "#fff", transform: value ? "translateX(18px)" : "none", transition: "transform .2s" }} />
      </span>
    </button>
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
  const [createForm, setCreateForm]   = useState({ nome: "", grupo: "Pessoal", previsao: "", auto: false });
  const [toast, setToast]           = useState(null);
  // Overrides otimistas para o ctrl e auto dos fixos (item → boolean)
  const [ctrlOvr, setCtrlOvr]   = useState({});
  const [autoOvr, setAutoOvr]   = useState({});
  const [fixoRemoving, setFixoRemoving] = useState(new Set());
  const [fixoConfirm,  setFixoConfirm]  = useState(null);

  // Detecta mobile para margens responsivas dos gráficos
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);
  const [toggling, setToggling] = useState(new Set());

  // Modal de edição unificado (variável / fixo / parcela)
  const [editModal,  setEditModal]  = useState(null); // { type, item }
  const [editForm,   setEditForm]   = useState({});
  const [editSaving, setEditSaving] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  function toInputMonth(mmyyyy) {
    if (!mmyyyy) return "";
    const [m, y] = String(mmyyyy).split("/");
    if (!m || !y) return "";
    return `${y}-${String(m).padStart(2, "0")}`;
  }

  function openEdit(type, item) {
    if (type === "variavel") {
      setEditForm({ nome: item.item, grupo: item.grupo || "Pessoal", previsao: String(item.previsao) });
    } else if (type === "fixo") {
      setEditForm({ nome: item.item, grupo: item.grupo || "Casa", real: String(item.real), previsao: String(item.previsao), auto: item.auto ?? false });
    } else {
      setEditForm({
        nome:          item.nome,
        valorTotal:    String(item.valorTotal),
        dataInicio:    toInputMonth(item.dataInicio),
        dataFim:       toInputMonth(item.dataFim),
        auto:          item.auto ?? false,
        parcelasPagas: String(item.parcelasPagas ?? 0),
      });
    }
    setEditModal({ type, item });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (editSaving || !editModal) return;
    setEditSaving(true);
    const { type, item } = editModal;
    try {
      let campos;
      let nomeAtual;
      if (type === "variavel") {
        nomeAtual = item.item;
        campos = { nome: editForm.nome.trim(), grupo: editForm.grupo, previsao: parseFloat(editForm.previsao) || 0 };
      } else if (type === "fixo") {
        nomeAtual = item.item;
        campos = { nome: editForm.nome.trim(), grupo: editForm.grupo, real: parseFloat(editForm.real) || 0, previsao: parseFloat(editForm.previsao) || 0, auto: editForm.auto };
      } else {
        nomeAtual = item.nome;
        campos = {
          nome:          editForm.nome.trim(),
          valorTotal:    parseFloat(editForm.valorTotal) || 0,
          dataInicio:    toSheetMonth(editForm.dataInicio),
          dataFim:       toSheetMonth(editForm.dataFim),
          auto:          editForm.auto,
          parcelasPagas: parseInt(editForm.parcelasPagas) || 0,
        };
      }
      const res  = await fetch("/api/finance/update", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, nomeAtual, campos }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast("✓ Atualizado com sucesso");
      setEditModal(null);
      refetch(true);
      if (type === "parcela") loadParcelas();
    } catch (err) { showToast(`⚠ ${err.message}`); }
    finally { setEditSaving(false); }
  }

  async function toggleCtrl(itemName, currentCtrl) {
    if (toggling.has(itemName)) return;
    const newCtrl = !currentCtrl;
    setCtrlOvr(p => ({ ...p, [itemName]: newCtrl }));
    setToggling(p => new Set(p).add(itemName));
    try {
      const res  = await fetch("/api/finance/fixo/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemName, ctrl: newCtrl }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
    } catch (err) {
      setCtrlOvr(p => ({ ...p, [itemName]: currentCtrl }));
      showToast(`⚠ Erro ao atualizar: ${err.message}`);
    } finally {
      setToggling(p => { const s = new Set(p); s.delete(itemName); return s; });
    }
  }

  async function toggleAuto(itemName, currentAuto) {
    if (toggling.has(`auto:${itemName}`)) return;
    const newAuto = !currentAuto;
    setAutoOvr(p => ({ ...p, [itemName]: newAuto }));
    setToggling(p => new Set(p).add(`auto:${itemName}`));
    try {
      const res  = await fetch("/api/finance/fixo/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemName, ctrl: newAuto, field: "auto" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
    } catch (err) {
      setAutoOvr(p => ({ ...p, [itemName]: currentAuto }));
      showToast(`⚠ Erro ao atualizar: ${err.message}`);
    } finally {
      setToggling(p => { const s = new Set(p); s.delete(`auto:${itemName}`); return s; });
    }
  }


  const editBtnStyle = {
    background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7,
    padding: "3px 7px", cursor: "pointer", color: "rgba(255,255,255,0.3)",
    fontSize: 12, lineHeight: 1, flexShrink: 0, transition: "all 0.15s",
  };

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
    nome: "", valorTotal: "", auto: false,
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
      showToast(`✓ ${item.nome} — parcela paga`);
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

  async function handleFixoRemove(item) {
    if (fixoConfirm !== item.item) { setFixoConfirm(item.item); return; }
    setFixoConfirm(null);
    setFixoRemoving(p => new Set(p).add(item.item));
    try {
      const res  = await fetch("/api/finance/fixo/delete", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: item.item }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      refetch(true);
      showToast(`🗑 ${item.item} removido`);
    } catch (e) { showToast(`⚠ ${e.message}`); }
    finally { setFixoRemoving(p => { const s = new Set(p); s.delete(item.item); return s; }); }
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
          auto:       parcForm.auto,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast(`✓ ${parcForm.nome} adicionado`);
      setCreateModal(false);
      setParcForm({ nome: "", valorTotal: "", auto: false, dataInicio: new Date().toISOString().slice(0, 7), dataFim: new Date().toISOString().slice(0, 7) });
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
    <div className={ex.page}>
      <ModuleHeader title="Gastos" hideOnDesktop />
      <Navigation />

      {/* Toast */}
      {toast && <div className={ex.toast}>{toast}</div>}

      {/* Cabeçalho */}
      <header className={ex.top}>
        <div className={ex.topLeft}>
          <span className={ex.eyebrow}>Financeiro · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
          <h1 className={ex.title}>Gastos</h1>
        </div>
        <div className={ex.topRight}>
          <FinanceOcultarBtn className={ex.pillBtn} />
          <button className={ex.primaryBtn} onClick={() => { setCreateModal(true); setCreateTab(tab === "fixos" ? "fixo" : tab === "parcelas" ? "parcela" : "variavel"); setCreateForm({ nome: "", grupo: "Pessoal", previsao: "" }); }}>
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
          {/* ── Big numbers — clicáveis, cada um abre sua aba ── */}
          <div className={ex.tabs}>
            {[
              { label: "Variáveis", value: totalVariaveis, color: "#fbbf24", tabKey: "variaveis", hint: "do dia a dia" },
              { label: "Fixos",     value: totalFixos,     color: "#38bdf8", tabKey: "fixos",     hint: "contas do mês" },
              { label: "Parcelas",  value: totalParcelas,  color: "#a78bfa", tabKey: "parcelas",  hint: "por mês" },
              { label: "Total",     value: totalGeral,     color: "#fb7185", tabKey: null,        hint: "somando tudo" },
            ].map(s => {
              const isActive = s.tabKey && tab === s.tabKey;
              const Tag = s.tabKey ? "button" : "div";
              return (
                <Tag
                  key={s.label}
                  onClick={s.tabKey ? () => setTab(s.tabKey) : undefined}
                  className={`${ex.tabBox} ${isActive ? ex.tabActive : ""}`}
                  style={{ "--t": s.color }}
                >
                  <span className={ex.tabLabel}><span className={ex.tabDot} />{s.label}</span>
                  <span className={ex.tabValue} style={{ color: s.color }}>{fmt(s.value)}</span>
                  <span className={ex.tabHint}>{s.hint}</span>
                </Tag>
              );
            })}
          </div>

          {/* ════ Tab: Variáveis ════ */}
          {tab === "variaveis" && (() => {
            const prevTotal = data?.gastos?.variaveis?.previsaoTotal ?? variaveis.reduce((s, i) => s + (i.previsao || 0), 0);
            const saldo  = prevTotal - totalVariaveis;
            const rawPct = prevTotal > 0 ? Math.round((totalVariaveis / prevTotal) * 100) : 0;
            const color  = saldo < 0 ? "#fb7185" : rawPct >= 70 ? "#fbbf24" : "#34d399";
            return (
              <div className={ex.layout}>
                <div className={ex.mainArea}>
                  {variaveis.length === 0 ? (
                    <p className={ex.empty}>Nenhum gasto variável cadastrado.</p>
                  ) : (
                    <div className={ex.listPanel}>
                      <div className={ex.sectionHead}>
                        <span className={ex.sectionDot} style={{ background: "#fbbf24", boxShadow: "0 0 10px #fbbf24" }} />
                        <span className={ex.sectionName}>Categorias</span>
                        <span className={ex.sectionCount}>{variaveis.length}</span>
                        <span className={ex.sectionTotal}>{fmt(totalVariaveis)}<small> de {fmt(variaveis.reduce((s, i) => s + (i.previsao || 0), 0))}</small></span>
                      </div>
                      {variaveis.map(item => {
                        const pct        = item.previsao > 0 ? Math.round((item.real / item.previsao) * 100) : 0;
                        const overBudget = item.real > item.previsao;
                        const diff       = Math.abs(item.real - item.previsao);
                        const barColor   = budgetBarColor(pct);
                        return (
                          <div key={item.item} className={ex.uRow} style={{ "--c": barColor }}>
                            <span className={ex.uLead}><i className={ex.uDot} /></span>
                            <div className={ex.uName}>
                              <span className={ex.rowName}>{item.item}</span>
                              <span className={ex.uSub} style={{ color: overBudget ? "#fb7185" : "#34d399" }}>{overBudget ? `↑ ${fmt(diff)} acima` : `${fmt(diff)} livre`}</span>
                            </div>
                            <div className={ex.bar}><span style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} /></div>
                            <span className={ex.uAux} style={{ color: barColor }}>{pct}%</span>
                            <span className={ex.uVal}><b>{fmt(item.real)}</b><small>de {fmt(item.previsao)}</small></span>
                            <div className={ex.uActs}>
                              <button onClick={() => openEdit("variavel", item)} title="Editar" className={ex.iconBtn}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={ex.side}>
                  {/* Saldo disponível */}
                  <div className={ex.panel}>
                    <div className={ex.panelTitle}>Saldo disponível</div>
                    <div className={ex.ringPanel}>
                      <Ring pct={rawPct} color={color} size={108} stroke={10}>
                        <span className={ex.ringPct}>{rawPct}%</span>
                        <span className={ex.ringSub}>usado</span>
                      </Ring>
                      <div className={ex.ringInfo}>
                        <span className={ex.bigValue} style={{ color }}>{fmt(saldo)}</span>
                        <span className={ex.muted}>{saldo < 0 ? "acima do previsto" : "disponível para gastar"}</span>
                        <div className={ex.pair}>
                          <div><span className={ex.pairLbl}>Previsto</span><span className={ex.pairVal}>{fmt(prevTotal)}</span></div>
                          <div><span className={ex.pairLbl}>Gasto</span><span className={ex.pairVal} style={{ color }}>{fmt(totalVariaveis)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Previsto vs real */}
                  <div className={ex.panel}>
                    <div className={ex.panelTitle}>Previsto vs real</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={variaveis.map(i => ({ name: i.item, Previsto: i.previsao, Real: i.real }))}
                        margin={{ top: 8, right: 4, left: 4, bottom: 48 }}
                        barGap={3}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" interval={0} />
                        <YAxis hide />
                        <Tooltip contentStyle={TOOLTIP_BOX} formatter={(v, name) => [fmt(v), name]} itemStyle={{ color: "#e5e7eb" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Bar dataKey="Previsto" fill="rgba(255,255,255,0.14)" radius={[6,6,0,0]} />
                        <Bar dataKey="Real" radius={[6,6,0,0]}>
                          {variaveis.map((item, i) => (
                            <Cell key={i} fill={budgetBarColor(item.previsao > 0 ? Math.round((item.real / item.previsao) * 100) : 0)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className={ex.legendRow}>
                      <span><i style={{ background: "rgba(255,255,255,0.14)" }} />Previsto</span>
                      <span><i style={{ background: "#34d399" }} />Real</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ════ Tab: Fixos — por grupo ════ */}
          {tab === "fixos" && (() => {
            const totalPagos      = fixos.filter(i => ctrlOvr[i.item] ?? i.ctrl).length;
            const pctPagos        = fixos.length > 0 ? Math.round((totalPagos / fixos.length) * 100) : 0;
            const valorConfirmado = fixos.filter(i => ctrlOvr[i.item] ?? i.ctrl).reduce((s, i) => s + i.real, 0);
            const corConf         = pctPagos >= 80 ? "#34d399" : pctPagos >= 50 ? "#fbbf24" : "#fb7185";
            return (
              <div className={ex.layout}>
                <div className={ex.mainArea}>
                  {Object.keys(fixoGroups).length === 0 ? (
                    <p className={ex.empty}>Nenhum gasto fixo encontrado.</p>
                  ) : sortGroups(Object.entries(fixoGroups)).map(([grupo, items]) => {
                    const gc         = grpColor(grupo);
                    const groupTotal = items.reduce((s, i) => s + i.real, 0);
                    const grpPagos   = items.filter(i => ctrlOvr[i.item] ?? i.ctrl).length;
                    return (
                      <section key={grupo} className={ex.listPanel}>
                        <div className={ex.sectionHead}>
                          <span className={ex.sectionDot} style={{ background: gc, boxShadow: `0 0 10px ${gc}` }} />
                          <span className={ex.sectionName}>{grupo}</span>
                          <span className={ex.sectionCount}>{grpPagos}/{items.length} pagos</span>
                          <span className={ex.sectionTotal}>{fmt(groupTotal)}</span>
                        </div>
                        <div className={ex.rows}>
                          {items.map(item => {
                            const prazoMatch = item.item.match(/\((Até [^)]+)\)$/i);
                            const prazo      = prazoMatch ? prazoMatch[1] : null;
                            const nomeLimpo  = prazo ? item.item.replace(/\s*\(Até [^)]+\)$/i, "").trim() : item.item;
                            const ctrl       = ctrlOvr[item.item] ?? item.ctrl;
                            const isAuto     = autoOvr[item.item] ?? item.auto ?? false;
                            const isToggling = toggling.has(item.item);
                            const isConf     = fixoConfirm === item.item;
                            return (
                              <div key={item.item} className={`${ex.uRow} ${ctrl ? ex.rowDone : ""}`} style={{ "--c": prazo ? "#fbbf24" : gc }}>
                                <span className={ex.uLead}>
                                  <button
                                    onClick={() => toggleCtrl(item.item, ctrl)}
                                    className={`${ex.check} ${ctrl ? ex.checkOn : ""} ${isToggling ? ex.checkBusy : ""}`}
                                    title={ctrl ? "Desmarcar pagamento" : "Marcar como pago"}
                                  ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
                                </span>
                                <div className={`${ex.uName} ${ex.uWide}`}>
                                  <div className={ex.rowLine}>
                                    <span className={`${ex.rowName} ${ctrl ? ex.struck : ""}`}>{nomeLimpo}</span>
                                    {isAuto && (
                                      <button onClick={() => toggleAuto(item.item, isAuto)} title="Automático (clique para desativar)"
                                        className={`${ex.badgeAuto} ${ctrl ? ex.badgeAutoOn : ""}`}>
                                        ⚡ {ctrl ? "pago auto" : "auto"}
                                      </button>
                                    )}
                                  </div>
                                  {prazo && <span className={ex.uSub} style={{ color: "#fbbf24" }}>⏱ {prazo}</span>}
                                </div>
                                <span className={ex.uAux} />
                                <span className={ex.uVal}><b>{fmt(item.real)}</b></span>
                                <div className={ex.uActs}>
                                  <button onClick={() => openEdit("fixo", item)} title="Editar" className={ex.iconBtn}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                                  {isConf ? (
                                    <button onClick={() => handleFixoRemove(item)} disabled={fixoRemoving.has(item.item)} className={ex.confirmBtn}
                                      onBlur={() => setTimeout(() => setFixoConfirm(v => v === item.item ? null : v), 200)}>
                                      {fixoRemoving.has(item.item) ? "…" : "Excluir?"}
                                    </button>
                                  ) : (
                                    <button onClick={() => handleFixoRemove(item)} title="Excluir" className={`${ex.iconBtn} ${ex.dangerBtn}`}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
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
                  {/* Confirmados */}
                  <div className={ex.panel}>
                    <div className={ex.panelTitle}>Pagos no mês</div>
                    <div className={ex.ringPanel}>
                      <Ring pct={pctPagos} color={corConf} size={108} stroke={10}>
                        <span className={ex.ringPct}>{pctPagos}%</span>
                        <span className={ex.ringSub}>pagos</span>
                      </Ring>
                      <div className={ex.ringInfo}>
                        <span className={ex.bigValue}>{totalPagos}<span className={ex.muted}> / {fixos.length}</span></span>
                        <span className={ex.muted}>itens confirmados</span>
                        <div className={ex.pair}>
                          <div><span className={ex.pairLbl}>Total fixo</span><span className={ex.pairVal}>{fmt(totalFixos)}</span></div>
                          <div><span className={ex.pairLbl}>Pago</span><span className={ex.pairVal} style={{ color: corConf }}>{fmt(valorConfirmado)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gastos por grupo */}
                  <div className={ex.panel}>
                    <div className={ex.panelTitle}>Por grupo</div>
                    {fixosDonutData.length === 0 ? (
                      <p className={ex.empty}>Sem dados</p>
                    ) : (
                      <>
                        <div style={{ position: "relative" }}>
                          <ResponsiveContainer width="100%" height={190}>
                            <PieChart>
                              <Pie data={fixosDonutData} cx="50%" cy="50%" innerRadius={60} outerRadius={84}
                                paddingAngle={2} cornerRadius={4} dataKey="value" stroke="none">
                                {fixosDonutData.map(d => <Cell key={d.name} fill={grpColor(d.name)} />)}
                              </Pie>
                              <Tooltip
                                formatter={v => [`${fmt(v)} (${fixosDonutTotal > 0 ? Math.round(v / fixosDonutTotal * 100) : 0}%)`]}
                                contentStyle={TOOLTIP_BOX} itemStyle={{ color: "#e5e7eb" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{fmt(fixosDonutTotal)}</span>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>total</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                          {fixosDonutData.map(d => (
                            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 4, background: grpColor(d.name) }} />
                              <span style={{ flex: 1, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{d.name}</span>
                              <span style={{ color: "#fff", fontWeight: 700 }}>{fmt(d.value)}</span>
                              <span style={{ minWidth: 38, textAlign: "right", fontWeight: 800, color: grpColor(d.name) }}>{fixosDonutTotal > 0 ? Math.round(d.value / fixosDonutTotal * 100) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ════ Tab: Parcelas ════ */}
          {tab === "parcelas" && (() => {
            const totalMensal  = parcItems.reduce((s, i) => s + i.valorMensal, 0);
            const totalDivida  = parcItems.reduce((s, i) => s + i.restante,    0);
            const parseMmYyyy  = s => { const [m, y] = String(s ?? "").split("/").map(Number); return (y || 0) * 100 + (m || 0); };
            const automaticos  = parcItems.filter(i => i.auto).sort((a, b) => parseMmYyyy(a.dataFim) - parseMmYyyy(b.dataFim));
            const manuais      = parcItems.filter(i => !i.auto).sort((a, b) => parseMmYyyy(a.dataFim) - parseMmYyyy(b.dataFim));

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
              const pct      = item.totalParcelas > 0 ? Math.round((item.parcelasPagas / item.totalParcelas) * 100) : 0;
              const cor      = pct >= 80 ? "#34d399" : pct >= 50 ? "#38bdf8" : "#fbbf24";
              const isConf   = parcConfirm === item.sheetRow;
              const isRem    = parcRemoving.has(item.sheetRow);
              const isPaying = parcPaying.has(item.sheetRow);
              // Quitada (todas as parcelas pagas) ou paga no mês → mostra ✓, igual aos Fixos
              const isDone   = item.pago || item.parcelasRestantes === 0;
              return (
                <div className={`${ex.uRow} ${isDone ? ex.rowDone : ""}`} style={{ "--c": item.auto ? "#34d399" : "#a78bfa" }}>
                  <span className={ex.uLead}>
                    {item.auto ? <i className={ex.uDot} /> : (
                      <span className={ex.checkCol}>
                        <button
                          onClick={() => !isPaying && !isDone && handleParcPay(item)}
                          className={`${ex.check} ${isDone ? ex.checkOn : ""} ${isPaying ? ex.checkBusy : ""}`}
                          title={isDone ? "Paga" : "Marcar parcela do mês como paga"}
                        ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
                        {item.pago && <span className={ex.undo} title="Desfazer pagamento" onClick={() => !isPaying && handleParcReset(item)}>↺</span>}
                      </span>
                    )}
                  </span>
                  <div className={ex.uName}>
                    <div className={ex.rowLine}>
                      <span className={`${ex.rowName} ${isDone ? ex.struck : ""}`}>{item.nome}</span>
                      {item.auto && <span className={`${ex.badgeAuto} ${isDone ? ex.badgeAutoOn : ""}`}>⚡ {isDone ? "pago auto" : "auto"}</span>}
                    </div>
                    <span className={ex.uSub}>
                      {item.dataFim ? `encerra ${fmtMonthYear(item.dataFim)}` : ""}
                      {item.restante > 0 && <em className={ex.restante}>{item.dataFim ? " · " : ""}faltam {fmt(item.restante)}</em>}
                    </span>
                  </div>
                  <div className={ex.bar}><span style={{ width: `${pct}%`, background: cor }} /></div>
                  <span className={ex.uAux} style={{ color: cor }}>{item.parcelasPagas}/{item.totalParcelas}</span>
                  <span className={ex.uVal}><b>{fmt(item.valorMensal)}</b><small>por mês</small></span>
                  <div className={ex.uActs}>
                    <button onClick={() => openEdit("parcela", item)} title="Editar" className={ex.iconBtn}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                    {isConf ? (
                      <button onClick={() => handleParcRemove(item)} disabled={isRem} className={ex.confirmBtn}
                        onBlur={() => setTimeout(() => setParcConfirm(v => v === item.sheetRow ? null : v), 200)}>
                        {isRem ? "…" : "Excluir?"}
                      </button>
                    ) : (
                      <button onClick={() => handleParcRemove(item)} title="Excluir" className={`${ex.iconBtn} ${ex.dangerBtn}`}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
                    )}
                  </div>
                </div>
              );
            };

            const parcSection = (title, color, items) => items.length > 0 && (
              <section className={ex.listPanel}>
                <div className={ex.sectionHead}>
                  <span className={ex.sectionDot} style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                  <span className={ex.sectionName}>{title}</span>
                  <span className={ex.sectionCount}>{items.length}</span>
                  <span className={ex.sectionTotal}>{fmt(items.reduce((s, i) => s + i.valorMensal, 0))}<small>/mês</small></span>
                </div>
                <div className={ex.rows}>{items.map(i => <ParcCard key={i.sheetRow} item={i} />)}</div>
              </section>
            );
            const totalPagas = parcItems.reduce((s, i) => s + i.parcelasPagas, 0);
            const totalAll   = parcItems.reduce((s, i) => s + i.totalParcelas, 0);
            const pctPagas   = totalAll > 0 ? Math.round((totalPagas / totalAll) * 100) : 0;

            return (
              <div className={ex.layout}>
                <div className={ex.mainArea}>
                  {parcLoading ? (
                    <p className={ex.empty}>Carregando…</p>
                  ) : parcItems.length === 0 ? (
                    <p className={ex.empty}>Nenhuma parcela ativa.</p>
                  ) : (
                    <>
                      {/* Manuais primeiro — têm o botão de pagar */}
                      {parcSection("Manuais", "#a78bfa", manuais)}
                      {parcSection("Automáticas", "#34d399", automaticos)}
                    </>
                  )}
                </div>

                <div className={ex.side}>
                  {/* Resumo */}
                  <div className={ex.panel}>
                    <div className={ex.panelTitle}>Resumo</div>
                    <div className={ex.ringPanel}>
                      <Ring pct={pctPagas} color={pctPagas >= 70 ? "#34d399" : "#fbbf24"} size={108} stroke={10}>
                        <span className={ex.ringPct}>{pctPagas}%</span>
                        <span className={ex.ringSub}>quitado</span>
                      </Ring>
                      <div className={ex.ringInfo}>
                        <span className={ex.bigValue}>{parcItems.length}<span className={ex.muted}> ativas</span></span>
                        <span className={ex.muted}>{automaticos.length} automáticas · {manuais.length} manuais</span>
                        <div className={ex.pair}>
                          <div><span className={ex.pairLbl}>Por mês</span><span className={ex.pairVal}>{fmt(totalMensal)}</span></div>
                          <div><span className={ex.pairLbl}>Em dívida</span><span className={ex.pairVal} style={{ color: "#fb7185" }}>{fmt(totalDivida)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parcelas em colunas */}
                  <div className={ex.panel}>
                    {(() => {
                      const k = v => v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `${Math.round(v)}`;
                      const base = [...parcItems].map(i => {
                        const pago  = i.valorMensal * i.parcelasPagas;
                        const total = pago + i.restante;
                        return { name: i.nome, mensal: i.valorMensal, restante: i.restante, pago, total,
                                 pctPago: total > 0 ? Math.round((pago / total) * 100) : 100 };
                      });
                      const dados = [...base].sort((x, y) => y.restante - x.restante);
                      // Nome embaixo da coluna, em até duas linhas
                      const tickNome = ({ x, y, payload }) => {
                        const [l1, ...rest] = String(payload.value).split(" ");
                        const cut = t => t.length > 8 ? t.slice(0, 7) + "…" : t;
                        const l2 = rest.join(" ");
                        return (
                          <text x={x} y={y + 8} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10.5} fontWeight={600}>
                            <tspan x={x}>{cut(l1)}</tspan>
                            {l2 && <tspan x={x} dy={12}>{cut(l2)}</tspan>}
                          </text>
                        );
                      };
                      // Rótulo no topo da coluna (acha o item pelo nome)
                      const topo = (fn, cor) => ({ x, y, width, value }) => {
                        const d = dados.find(i => i.name === value);
                        return d ? <text x={x + width / 2} y={y - 7} textAnchor="middle" fill={cor} fontSize={11} fontWeight={800}>{fn(d)}</text> : null;
                      };
                      const tip = ({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ ...TOOLTIP_BOX, color: "#e5e7eb", lineHeight: 1.6 }}>
                            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 2 }}>{d.name}</div>
                            <div>Parcela: <b>{fmt(d.mensal)}</b>/mês</div>
                            <div>Pago: <b style={{ color: "#34d399" }}>{fmt(d.pago)}</b> ({d.pctPago}%)</div>
                            <div>Falta: <b style={{ color: "#fb7185" }}>{fmt(d.restante)}</b></div>
                          </div>
                        );
                      };
                      return (<>
                        <div className={ex.chartHead}>
                          <div className={ex.panelTitle} style={{ marginBottom: 0 }}>Quanto falta pagar</div>
                          <span>por compra</span>
                        </div>
                        <ResponsiveContainer width="100%" height={230}>
                          <BarChart data={dados} margin={{ top: 22, right: 2, left: 2, bottom: 0 }} barCategoryGap="28%">
                            <defs>
                              <linearGradient id="gFalta" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#fb7185" stopOpacity={0.35} /></linearGradient>
                            </defs>
                            <XAxis dataKey="name" interval={0} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} height={32} tick={tickNome} />
                            <YAxis hide domain={[0, "auto"]} />
                            <Tooltip content={tip} cursor={{ fill: "rgba(255,255,255,0.04)", radius: 8 }} />
                            <Bar dataKey="restante" fill="url(#gFalta)" radius={[8, 8, 3, 3]} maxBarSize={34} minPointSize={4}>
                                <LabelList dataKey="name" content={topo(d => d.restante > 0 ? k(d.restante) : "✓", "#fda4af")} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </>);
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

        </>
      )}

      {/* Modal de edição */}
      {editModal && (() => {
        const { type } = editModal;
        const lbl = { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8 };
        const btnCancel = { height: 42, padding: "0 18px", borderRadius: 99, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", background: "transparent", border: "none", fontFamily: "inherit", cursor: "pointer" };
        const btnSave   = { height: 42, padding: "0 24px", borderRadius: 99, fontSize: 14, fontWeight: 700, color: "#0b0b10", background: "#fff", border: "none", fontFamily: "inherit", cursor: editSaving ? "wait" : "pointer", opacity: editSaving ? 0.6 : 1, boxShadow: "0 6px 24px rgba(255,255,255,0.12)" };
        const typeLabel = type === "variavel" ? "Gasto Variável" : type === "fixo" ? "Gasto Fixo" : "Parcela";

        // Cálculo de previsão de parcela no modal
        const parcPrev = (() => {
          if (type !== "parcela" || !editForm.dataInicio || !editForm.dataFim) return null;
          const [ys, ms] = editForm.dataInicio.split("-").map(Number);
          const [ye, me] = editForm.dataFim.split("-").map(Number);
          const n = (ye - ys) * 12 + (me - ms) + 1;
          return n > 0 ? n : null;
        })();
        const parcMensal = parcPrev && editForm.valorTotal
          ? Math.round((parseFloat(editForm.valorTotal) / parcPrev) * 100) / 100
          : null;

        return (
          <div className={ex.overlay} onClick={() => setEditModal(null)}>
            <div className={ex.modal} onClick={e => e.stopPropagation()}>
              <div className={ex.modalTop}>
                <h3 className={ex.modalTitle}>Editar {typeLabel.toLowerCase()}</h3>
                <button type="button" className={ex.closeBtn} onClick={() => setEditModal(null)} title="Fechar">✕</button>
              </div>
              <p className={ex.modalSub}>Altere o que precisar e salve.</p>

              <form onSubmit={saveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* ── Variável ── */}
                {type === "variavel" && (<>
                  <div><label style={lbl}>Nome</label>
                    <input autoFocus required type="text" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
                  </div>
                  <div><label style={lbl}>Grupo</label>
                    <GrupoChips value={editForm.grupo} onChange={g => setEditForm(f => ({ ...f, grupo: g }))} />
                  </div>
                  <div><label style={lbl}>Previsão Mensal (R$)</label>
                    <input required type="number" step="0.01" min="0" value={editForm.previsao} onChange={e => setEditForm(f => ({ ...f, previsao: e.target.value }))} style={inputStyle} />
                  </div>
                </>)}

                {/* ── Fixo ── */}
                {type === "fixo" && (<>
                  <div><label style={lbl}>Nome</label>
                    <input autoFocus required type="text" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
                  </div>
                  <div><label style={lbl}>Grupo</label>
                    <GrupoChips value={editForm.grupo} onChange={g => setEditForm(f => ({ ...f, grupo: g }))} />
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>Valor Real (R$)</label>
                      <input required type="number" step="0.01" min="0" value={editForm.real} onChange={e => setEditForm(f => ({ ...f, real: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}><label style={lbl}>Previsão (R$)</label>
                      <input type="number" step="0.01" min="0" value={editForm.previsao} onChange={e => setEditForm(f => ({ ...f, previsao: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <AutoToggle value={editForm.auto} onChange={v => setEditForm(f => ({ ...f, auto: v }))} />
                </>)}

                {/* ── Parcela ── */}
                {type === "parcela" && (<>
                  <div><label style={lbl}>Nome</label>
                    <input autoFocus required type="text" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
                  </div>
                  <div><label style={lbl}>Valor Total (R$)</label>
                    <input required type="number" step="0.01" min="0" value={editForm.valorTotal} onChange={e => setEditForm(f => ({ ...f, valorTotal: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>Início</label>
                      <input required type="month" value={editForm.dataInicio} onChange={e => setEditForm(f => ({ ...f, dataInicio: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}><label style={lbl}>Fim</label>
                      <input required type="month" value={editForm.dataFim} onChange={e => setEditForm(f => ({ ...f, dataFim: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  {parcPrev && parcMensal && (
                    <div className={ex.preview}>
                      → {parcPrev}x de {fmt(parcMensal)}/mês
                    </div>
                  )}
                  <AutoToggle value={editForm.auto} onChange={v => setEditForm(f => ({ ...f, auto: v }))} />
                  {!editForm.auto && (
                    <div><label style={lbl}>Parcelas Pagas</label>
                      <input type="number" min="0" max={editModal?.item?.totalParcelas ?? 999} value={editForm.parcelasPagas} onChange={e => setEditForm(f => ({ ...f, parcelasPagas: e.target.value }))} style={inputStyle} />
                    </div>
                  )}
                </>)}

                <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <button type="button" onClick={() => setEditModal(null)} style={btnCancel}>Cancelar</button>
                  <button type="submit" disabled={editSaving} style={btnSave}>{editSaving ? "Salvando…" : "Salvar"}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal unificado de criação */}
      {createModal && (() => {
        const lbl = { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8 };
        const btnCancel = { height: 42, padding: "0 18px", borderRadius: 99, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", background: "transparent", border: "none", fontFamily: "inherit", cursor: "pointer" };
        const btnSubmit = { height: 42, padding: "0 24px", borderRadius: 99, fontSize: 14, fontWeight: 700, color: "#0b0b10", border: "none", fontFamily: "inherit", cursor: "pointer", background: "#fff", boxShadow: "0 6px 24px rgba(255,255,255,0.12)" };
        const grupoSelect = (
          <div>
            <label style={lbl}>Grupo</label>
            <GrupoChips value={createForm.grupo} onChange={g => setCreateForm(f => ({ ...f, grupo: g }))} />
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
              body: JSON.stringify({ type, grupo: createForm.grupo, nome: createForm.nome, previsao: parseFloat(createForm.previsao) || 0, auto: createForm.auto }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error);
            showToast(`✓ ${createForm.nome} adicionado`);
            setCreateModal(false); refetch(true);
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
          <div className={ex.overlay} onClick={() => setCreateModal(false)}>
            <div className={ex.modal} onClick={e => e.stopPropagation()}>
              <div className={ex.modalTop}>
                <h3 className={ex.modalTitle}>Novo registro</h3>
                <button type="button" className={ex.closeBtn} onClick={() => setCreateModal(false)} title="Fechar">✕</button>
              </div>
              <p className={ex.modalSub}>Adicione um novo item às suas despesas.</p>
              {/* Tabs */}
              <div className={ex.segment}>
                {[{ k: "variavel", l: "Gasto variável" }, { k: "fixo", l: "Gasto fixo" }, { k: "parcela", l: "Parcela" }].map(t => (
                  <button key={t.k} type="button" onClick={() => setCreateTab(t.k)} className={`${ex.segBtn} ${createTab === t.k ? ex.segActive : ""}`}>
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
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
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
                  <AutoToggle value={createForm.auto} onChange={v => setCreateForm(f => ({ ...f, auto: v }))} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <button type="button" onClick={() => setCreateModal(false)} style={btnCancel}>Cancelar</button>
                    <button type="submit" disabled={createSaving || !createForm.nome} style={{ ...btnSubmit, opacity: (createSaving || !createForm.nome) ? 0.5 : 1 }}>{createSaving ? "Salvando..." : "Adicionar Fixo"}</button>
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
                    <div className={ex.preview}>
                      → {parcPrevModal}x de {fmt(parcMensalPrevModal)}/mês
                    </div>
                  )}
                  <AutoToggle value={parcForm.auto} onChange={v => setParcForm(p => ({ ...p, auto: v }))} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <button type="button" onClick={() => setCreateModal(false)} style={btnCancel}>Cancelar</button>
                    <button type="submit" disabled={parcSaving || !parcForm.nome || !parcForm.valorTotal || !parcPrevModal} style={{ ...btnSubmit, opacity: (parcSaving || !parcForm.nome || !parcForm.valorTotal || !parcPrevModal) ? 0.5 : 1 }}>{parcSaving ? "Salvando..." : "Adicionar Parcela"}</button>
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
