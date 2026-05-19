import styles from './Toast.module.css';

const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export default function Toast({ message, type = 'success' }) {
  if (!message) return null;
  return (
    <div className={`${styles.toast} ${styles[type] || ''}`}>
      <span className={styles.icon}>{ICONS[type] ?? '✓'}</span>
      <span>{message}</span>
    </div>
  );
}
