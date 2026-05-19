import { FinanceProvider } from "@/hooks/useFinance";
import FinanceOcultarBtn from "@/components/ui/FinanceOcultarBtn";
import styles from "./Finance.module.css";
import "./finance-theme.css";

export default function FinanceLayout({ children }) {
  return (
    <FinanceProvider>
      <div className="finance-module">
        {children}
        <div style={{ position: "fixed", bottom: 80, right: 16, zIndex: 100 }}>
          <FinanceOcultarBtn className={styles.addBtn} />
        </div>
      </div>
    </FinanceProvider>
  );
}
