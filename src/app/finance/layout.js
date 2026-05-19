import { FinanceProvider } from "@/hooks/useFinance";
import "./finance-theme.css";

export default function FinanceLayout({ children }) {
  return (
    <FinanceProvider>
      <div className="finance-module">
        {children}
      </div>
    </FinanceProvider>
  );
}
