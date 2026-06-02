import styles from './Toast.module.css';

export default function Toast({ message, type = 'success', onUndo }) {
  if (!message) return null;
  return (
    <div className={`${styles.toast} ${styles[type] || ''}`}>
      <span>{message}</span>
      {onUndo && (
        <button
          onClick={onUndo}
          style={{
            marginLeft: 12, padding: "2px 10px", borderRadius: 6,
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
            color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", flexShrink: 0,
          }}
        >
          Desfazer
        </button>
      )}
    </div>
  );
}
