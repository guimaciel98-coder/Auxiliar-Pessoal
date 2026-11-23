"use client";
import { usePathname } from "next/navigation";
import FinanceOcultarBtn from "./FinanceOcultarBtn";

// Telas do Financeiro já redesenhadas têm o botão "Ocultar" no próprio cabeçalho;
// nas demais, ele continua flutuando no canto superior direito.
const WITH_OWN_BUTTON = ["/finance/overview"];

export default function FinanceFloatingOcultar({ className }) {
  const pathname = usePathname();
  if (WITH_OWN_BUTTON.some(p => pathname.startsWith(p))) return null;
  return (
    <div style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top, 0px))", right: "calc(16px + env(safe-area-inset-right, 0px))", zIndex: 100 }}>
      <FinanceOcultarBtn className={className} style={{ fontSize: 11, padding: "5px 12px", opacity: 0.55 }} />
    </div>
  );
}
