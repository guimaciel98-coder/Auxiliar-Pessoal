import styles from "./Metrics.module.css";

export default function Metrics({ metrics, filter, setFilter }) {
  const projectMetrics = metrics.filter(m => m.key !== "all");

  return (
    <div className={styles.pillsWrap}>
      {projectMetrics.map(m => (
        <button
          key={m.key}
          className={`${styles.pill} ${filter === m.key ? styles.pillActive : ""}`}
          onClick={() => setFilter(filter === m.key ? "all" : m.key)}
          style={{ "--pill-color": m.cor || "#888" }}
        >
          <span className={styles.pillLabel}>{m.label}</span>
          <span className={styles.pillCount}>{m.num}</span>
        </button>
      ))}
    </div>
  );
}
