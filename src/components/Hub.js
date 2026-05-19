"use client";
import { useState } from "react";
import Link from "next/link";
import Navigation from "./ui/Navigation";
import QuickAddModal from "./Daily/QuickAddModal";
import styles from "./Hub.module.css";

const DAYS   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function greet(hour) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const MODULE_PRIMARY = {
  href:     "/daily",
  title:    "Tarefas",
  subtitle: "Pessoal · VCA Brasil · Ponto de Vista",
  accent:   "#00e5a0",
  icon:     "✓",
};

const MODULES_SECONDARY = [
  {
    href:      "/finance",
    title:     "Financeiro",
    subtitle:  "Planilha conectada",
    footerLabel: "Abrir módulo",
    accent:    "#34d399",
    icon:      "R$",
    ready:     true,
  },
  {
    href:      "/routine",
    title:     "Rotina",
    subtitle:  "Timeline do dia",
    footerLabel: "Ver rotina",
    accent:    "#5b9fd6",
    icon:      "⏱",
    ready:     true,
  },
];

export default function Hub() {
  const [isModalOpen, setModal] = useState(false);

  const now    = new Date();
  const hour   = now.getHours();
  const dayStr = `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`;

  return (
    <div className={styles.container}>
      <Navigation />
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />

      <main className={styles.landing}>

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.greeting}>{greet(hour)}</p>
            <h1 className={styles.title}>{dayStr}</h1>
          </div>
          <button
            className={styles.quickBtn}
            onClick={() => setModal(true)}
            title="Nova tarefa rápida"
          >
            +
          </button>
        </header>

        {/* Grid de módulos */}
        <div className={styles.modulesGrid}>

          {/* Card principal — ocupa 2 colunas no desktop */}
          <Link
            href={MODULE_PRIMARY.href}
            className={styles.primaryCard}
            style={{ "--accent": MODULE_PRIMARY.accent }}
          >
            <div className={styles.primaryCardHeader}>
              <div className={styles.primaryIconWrap}>
                <span className={styles.primaryIcon}>{MODULE_PRIMARY.icon}</span>
              </div>
              <span className={styles.statusBadgeActive}>Ativo</span>
            </div>

            <div className={styles.primaryInfo}>
              <h2 className={styles.primaryTitle}>{MODULE_PRIMARY.title}</h2>
              <p className={styles.primarySubtitle}>{MODULE_PRIMARY.subtitle}</p>
            </div>

            <div className={styles.primaryFooter}>
              <span className={styles.primaryAction}>Acessar painel</span>
              <span className={styles.arrow} style={{ color: MODULE_PRIMARY.accent }}>→</span>
            </div>
          </Link>

          {/* Cards secundários — coluna direita */}
          <div className={styles.secondaryStack}>
            {MODULES_SECONDARY.map((m) => (
              <Link
                key={m.href}
                href={m.ready ? m.href : "#"}
                className={`${styles.secondaryCard} ${!m.ready ? styles.cardDisabled : ""}`}
                style={{ "--accent": m.accent }}
              >
                <div className={styles.secondaryIconWrap} style={{ background: m.accent + "18", color: m.accent }}>
                  {m.icon}
                </div>
                <div className={styles.secondaryInfo}>
                  <h3 className={styles.secondaryTitle}>{m.title}</h3>
                  <p className={styles.secondarySubtitle}>{m.ready ? m.subtitle : "Em breve"}</p>
                </div>
                {m.ready ? (
                  <div className={styles.secondaryFooter}>
                    <span>{m.footerLabel}</span>
                    <span style={{ color: m.accent }}>→</span>
                  </div>
                ) : (
                  <span className={styles.statusBadgeSoon}>Breve</span>
                )}
              </Link>
            ))}
          </div>
        </div>

      </main>

      {isModalOpen && (
        <QuickAddModal
          onClose={() => setModal(false)}
          onSuccess={() => setModal(false)}
        />
      )}
    </div>
  );
}
