"use client";
// Coluna esquerda da Visão Geral (estilo minimalista): números do ciclo + gastos variáveis.
import vs from "./OverviewLeft.module.css";

const sign = v => (v >= 0 ? "#34d399" : "#fb7185");

export function KpisB({ fmt, ganhos, gastos, poupancas }) {
  return (
    <div className={vs.bWrap}>
      <div className={vs.bTwo}>
        {[
          { label: "Ganhos",           value: ganhos, color: "#34d399" },
          { label: "Gastos até agora", value: gastos, color: "#fb7185" },
        ].map(k => (
          <div key={k.label} className={vs.bKpi} style={{ "--c": k.color }}>
            <span className={vs.bLabel}>{k.label}</span>
            <span className={vs.bValue} style={{ color: k.color }}>{fmt(k.value)}</span>
          </div>
        ))}
      </div>
      <div className={vs.bStrip}>
        {poupancas.map(p => (
          <div key={p.label} className={vs.bStripItem}>
            <span className={vs.bLabel}>{p.label}</span>
            <span className={vs.bStripValue} style={{ color: sign(p.value) }}>{fmt(p.value)}</span>
            <span className={vs.bHint}>{p.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VarsB({ fmt, variaveis, barColor }) {
  return (
    <div className={vs.bPanel}>
      <div className={vs.bPanelHead}>
        <span className={vs.bPanelTitle}>Gastos variáveis</span>
        <span className={vs.bPanelCols}><span>gasto / previsto</span><span>uso</span></span>
      </div>
      {variaveis.length === 0 ? <p className={vs.empty}>Sem gastos variáveis cadastrados.</p> : variaveis.map(item => {
        const pct  = item.previsao > 0 ? Math.round((item.real / item.previsao) * 100) : 0;
        const over = item.real > item.previsao;
        const diff = Math.abs(item.real - item.previsao);
        const c    = barColor(pct);
        return (
          <div key={item.item} className={vs.bRow}>
            <div className={vs.bRowName}>
              <span>{item.item}</span>
              <small style={{ color: over ? "#fb7185" : "#34d399" }}>{over ? `↑ ${fmt(diff)} acima` : `${fmt(diff)} livre`}</small>
            </div>
            <div className={vs.bRowBar}><span style={{ width: `${Math.min(pct, 100)}%`, background: c }} /></div>
            <span className={vs.bRowVals}>{fmt(item.real)} <span>/ {fmt(item.previsao)}</span></span>
            <span className={vs.bRowPct} style={{ color: c }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
