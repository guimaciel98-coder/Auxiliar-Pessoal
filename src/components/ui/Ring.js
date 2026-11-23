"use client";
import { useState, useEffect } from "react";
import styles from "./Ring.module.css";

/**
 * Anel de progresso (SVG) que "enche" com animação ao aparecer.
 * <Ring pct={40} color="#a78bfa" size={120} stroke={11}>40%</Ring>
 * `className` permite que a página ajuste o tamanho via CSS (o SVG escala junto).
 */
export default function Ring({ pct, color, size = 88, stroke = 9, className = "", children }) {
  const r     = (size - stroke) / 2;
  const circ  = 2 * Math.PI * r;
  const value = pct == null ? 0 : Math.min(100, Math.max(0, pct));

  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  return (
    <div className={`${styles.ring} ${className}`} style={{ width: size, height: size }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={styles.arc}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className={styles.center}>{children}</div>
    </div>
  );
}
