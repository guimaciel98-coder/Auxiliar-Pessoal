import { FinanceProvider } from "@/hooks/useFinance";
import FinanceFloatingOcultar from "@/components/ui/FinanceFloatingOcultar";
import styles from "./Finance.module.css";
import "./finance-theme.css";

export default function FinanceLayout({ children }) {
  return (
    <FinanceProvider>
      <div className="finance-module">
        {children}
        <FinanceFloatingOcultar className={styles.addBtn} />
      </div>
    </FinanceProvider>
  );
}
