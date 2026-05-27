import { FinanceProvider } from "@/hooks/useFinance";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import styles from "./Finance.module.css";
import "./finance-theme.css";

export default function FinanceLayout({ children }) {
  return (
    <FinanceProvider>
      <div className="finance-module">
        {children}
        <div style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top, 0px))", right: "calc(16px + env(safe-area-inset-right, 0px))", zIndex: 100 }}>
          <FinanceOcultarBtn className={styles.addBtn} style={{ fontSize: 11, padding: "5px 12px", opacity: 0.55 }} />
        </div>
      </div>
    </FinanceProvider>
  );
}
