"use client";
// Coluna direita da Visão Geral (saldo/ciclo, gastos por grupo, meta) + painel de projeção.
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell,
} from "recharts";
import rs from "./OverviewRight.module.css";

const AXIS_TICK = { fill: "rgba(255,255,255,0.4)", fontSize: 10 };
const TOOLTIP   = { background: "#15161f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12, padding: "8px 12px" };

// ── Peças comuns ─────────────────────────────────────────────────────────────
function Donut({ fmt, donutData, colors, horizontal }) {
  if (!donutData.length) return <p className={rs.empty}>Sem dados</p>;
  const total = donutData.reduce((s, d) => s + d.value, 0);
  return (
    <div className={horizontal ? rs.donutRow : rs.donutCol}>
      <div className={rs.donutBox}>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={2} cornerRadius={4} dataKey="value" stroke="none">
              {donutData.map((d, i) => <Cell key={i} fill={colors[d.name] ?? "#6b7280"} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [fmt(v), n]} itemStyle={{ color: "#e5e7eb" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className={rs.donutCenter}><b>{fmt(total)}</b><span>total</span></div>
      </div>
      <div className={rs.legend}>
        {[...donutData].sort((a, b) => b.value - a.value).map(d => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          const c = colors[d.name] ?? "#6b7280";
          return (
            <div key={d.name} className={rs.legendRow}>
              <i style={{ background: c }} />
              <span>{d.name}</span>
              <b>{fmt(d.value)}</b>
              <em style={{ color: c }}>{pct}%</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Projection({ chartData, mesAtualLabel, height = 200, wide = false, meta }) {
  if (!chartData.length) return <p className={rs.empty}>Sem dados ainda.</p>;
  const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const k   = v => `R$ ${(Number(v) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  // Dica: cartão próprio, com mês, valor e se é histórico ou projeção
  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const h = payload.find(p => p.dataKey === "historico" && p.value != null);
    const pj = payload.find(p => p.dataKey === "projecao" && p.value != null);
    return (
      <div style={{ ...TOOLTIP, padding: "10px 14px" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11.5, marginBottom: 4, textTransform: "capitalize" }}>{label}</div>
        {h  && <div style={{ color: "#34d399", fontWeight: 800, fontSize: 15 }}>{brl(h.value)} <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>guardado</span></div>}
        {pj && !h && <div style={{ color: "#7dd3fc", fontWeight: 800, fontSize: 15 }}>{brl(pj.value)} <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>previsto</span></div>}
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 18, right: 14, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="rHist" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.45} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient>
          <linearGradient id="rProj" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.28} /><stop offset="100%" stopColor="#38bdf8" stopOpacity={0.01} /></linearGradient>
          <filter id="rGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="mes" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={wide ? 1 : 3} dy={6} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={k} width={56} />
        <Tooltip content={<Tip />} cursor={{ stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 }} />
        {meta > 0 && (
          <ReferenceLine y={meta} stroke="#fbbf24" strokeOpacity={0.6} strokeDasharray="2 4"
            label={{ value: `meta ${k(meta)}`, position: "insideTopLeft", fontSize: 11, fontWeight: 700, fill: "#fbbf24" }} />
        )}
        <ReferenceLine x={mesAtualLabel} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3"
          label={{ value: "hoje", position: "top", fontSize: 11, fontWeight: 700, fill: "rgba(255,255,255,0.6)" }} />
        <Area type="monotone" dataKey="projecao" stroke="#38bdf8" strokeWidth={2.5} strokeDasharray="7 5" fill="url(#rProj)" dot={false} connectNulls={false}
          activeDot={{ r: 6, fill: "#38bdf8", stroke: "#07080c", strokeWidth: 3 }} />
        <Area type="monotone" dataKey="historico" stroke="#34d399" strokeWidth={3} fill="url(#rHist)" connectNulls={false} filter="url(#rGlow)"
          dot={false} activeDot={{ r: 6, fill: "#34d399", stroke: "#07080c", strokeWidth: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Panel({ title, aside, children }) {
  return (
    <div className={rs.panel}>
      {(title || aside) && <div className={rs.panelHead}><span>{title}</span>{aside && <em>{aside}</em>}</div>}
      {children}
    </div>
  );
}

// ── Coluna direita (mesmo estilo minimalista da esquerda) ─────────────────────
export function RightB(p) {
  const { fmt, fmtShort, saldo, cycle, meta, donutData, donutColors } = p;
  return (
    <div className={rs.col}>
      <Panel title="Saldo variável">
        <div className={rs.bigLine}>
          <span className={rs.big} style={{ color: saldo.color }}>{fmt(saldo.value)}</span>
          <span className={rs.muted}>{saldo.value < 0 ? "acima do previsto" : "disponível para gastar"}</span>
        </div>
        <div className={rs.split}>
          <span style={{ width: `${saldo.budgetW}%`, background: saldo.isOver ? "rgba(251,113,133,0.4)" : saldo.color }} />
          {saldo.isOver && <span style={{ width: `${saldo.overflowW}%`, background: "#fb7185" }} />}
        </div>
        <div className={rs.rowMeta}>
          <span>{saldo.rawPct}% do orçamento</span>
          {saldo.isOver && <b style={{ color: "#fb7185" }}>+{saldo.overPct}% excedido</b>}
        </div>
        <div className={rs.cycleLine}>
          <span className={rs.cycleDays} style={{ color: cycle.color }}>{cycle.daysLeft}</span>
          <div className={rs.cycleInfo}>
            <span>dias para fechar o ciclo <em>({cycle.endLabel})</em></span>
            <div className={rs.thin}><span style={{ width: `${cycle.pctElapsed}%`, background: cycle.color }} /></div>
          </div>
          <span className={rs.cyclePct}>{cycle.pctElapsed}%</span>
        </div>
      </Panel>

      <Panel title="Gastos por grupo">
        <Donut fmt={fmt} donutData={donutData} colors={donutColors} horizontal />
      </Panel>

      <Panel title="Meta de poupança" aside={`Meta ${fmtShort(meta.final)}`}>
        <div className={rs.metaLine}>
          <span className={rs.big}>{fmtShort(meta.acumulado)}</span>
          <span className={rs.metaPct} style={{ color: meta.color }}>{meta.pct}%</span>
        </div>
        <div className={rs.split}><span style={{ width: `${meta.pct}%`, background: meta.color }} /></div>
        <div className={rs.rowMeta}>
          <span>acumulado</span>
          <b>{meta.falta > 0 ? `faltam ${fmtShort(meta.falta)}` : "Meta batida! 🎉"}</b>
        </div>
      </Panel>

    </div>
  );
}

// ── Projeção de poupança (painel de largura toda, abaixo das colunas) ─────────
export function ProjectionPanel({ chartData, mesAtualLabel, height = 280, meta, fmtShort }) {
  // Número de destaque: onde a projeção termina
  const fim = [...chartData].reverse().find(d => d.projecao != null);
  return (
    <div className={rs.panel}>
      <div className={rs.projHead}>
        <div>
          <span className={rs.projTitle}>Projeção de poupança</span>
          {fim && <div className={rs.projBig}>{fmtShort ? fmtShort(fim.projecao) : Math.round(fim.projecao)}<em> em {fim.mes}</em></div>}
        </div>
        <span className={rs.key}><i style={{ background: "#34d399" }} />Guardado <i className={rs.dash} />Previsto{meta > 0 && <><i className={rs.goal} />Meta</>}</span>
      </div>
      <Projection chartData={chartData} mesAtualLabel={mesAtualLabel} height={height} wide meta={meta} />
    </div>
  );
}
