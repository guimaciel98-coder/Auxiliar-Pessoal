"use client";
import { useFinance } from "@/hooks/useFinance";

export default function FinanceOcultarBtn({ className, style }) {
  const { hideNumbers, toggleHide } = useFinance();
  return (
    <button
      onClick={toggleHide}
      className={className}
      style={{
        background:  hideNumbers ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
        color:       hideNumbers ? "#f59e0b"                : "var(--text-secondary)",
        borderColor: hideNumbers ? "rgba(245,158,11,0.3)"  : "rgba(255,255,255,0.1)",
        fontSize: 13,
        ...style,
        opacity: hideNumbers ? 1 : (style?.opacity ?? 1),
      }}
    >
      {hideNumbers ? "◉ Mostrar" : "◎ Ocultar"}
    </button>
  );
}
