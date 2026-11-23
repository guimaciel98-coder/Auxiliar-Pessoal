"use client";
import Link from "next/link";
import styles from "./ModuleHeader.module.css";

// hideOnDesktop: telas redesenhadas já têm título próprio; no computador o cabeçalho some
// (no celular continua, por causa do botão de voltar).
export default function ModuleHeader({ title, backTo = "/", onBack, hideOnDesktop = false }) {
  const BackEl    = onBack ? "button" : Link;
  const backProps = onBack ? { onClick: onBack } : { href: backTo };

  return (
    <header className={`${styles.header} ${hideOnDesktop ? styles.hideDesktop : ""}`}>
      {/* Back button: oculto no desktop via CSS, visível no mobile */}
      <BackEl {...backProps} className={styles.backBtn}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Hub
      </BackEl>

      {title && <h2 className={styles.title}>{title}</h2>}

      <div className={styles.spacer} />
    </header>
  );
}
