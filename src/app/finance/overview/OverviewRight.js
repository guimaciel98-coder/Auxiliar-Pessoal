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

function Projection({ chartData, mesAtualLabel, height = 200, wide = false }) {
  if (!chartData.length) return <p className={rs.empty}>Sem dados ainda.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rHist" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.35} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
          <linearGradient id="rProj" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.18} /><stop offset="100%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="mes" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={wide ? 1 : 3} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={v => `R${(Number(v) / 1000).toFixed(0)}k`} width={44} />
        <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: "#9ca3af" }}
          formatter={(v, name) => [Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), name === "historico" ? "Poupança" : "Projeção"]} />
        <ReferenceLine x={mesAtualLabel} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 3" label={{ value: "hoje", position: "insideTopRight", fontSize: 10, fill: "rgba(255,255,255,0.45)" }} />
        <Area type="monotone" dataKey="projecao" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6 4" fill="url(#rProj)" dot={false} connectNulls={false} />
        <Area type="monotone" dataKey="historico" stroke="#34d399" strokeWidth={2.5} fill="url(#rHist)" connectNulls={false} activeDot={{ r: 5 }}
          dot={(props) => {
            const { cx, cy, payload } = props;
            if (!payload.historico && payload.historico !== 0) return null;
            return <circle key={`h${cx}${cy}`} cx={cx} cy={cy} r={3} fill={payload.atingido ? "#34d399" : "#07080c"} stroke={payload.atingido ? "#34d399" : "#6b7280"} strokeWidth={2} />;
          }} />
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
          <span style={{ width: `${saldo.budgetW}%`, background: saldo.isOver ? "#fbbf24" : saldo.color }} />
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
export function ProjectionPanel({ chartData, mesAtualLabel, height = 280 }) {
  return (
    <Panel title="Projeção de poupança" aside={<span className={rs.key}><i style={{ background: "#34d399" }} />Histórico <i className={rs.dash} />Projeção</span>}>
      <Projection chartData={chartData} mesAtualLabel={mesAtualLabel} height={height} wide />
    </Panel>
  );
}
