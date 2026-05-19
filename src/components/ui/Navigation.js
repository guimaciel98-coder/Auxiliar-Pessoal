"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navigation.module.css";

// ── Estrutura única de navegação ──────────────────────────────────────────────
const NAV = [
  {
    label: "Hub",
    path: "/",
    icon: "⊞",
    exact: true,
  },
  {
    label: "Tarefas",
    path: "/daily",
    icon: "✓",
    sectionLabel: "Módulos",
    prefixes: ["/daily", "/tomorrow", "/board", "/calendar", "/recurrences"],
    children: [
      { label: "Hoje",     path: "/daily",       icon: "🔥", exact: true },
      { label: "Projetos", path: "/board",       icon: "🗂️" },
      // { label: "Agenda", path: "/calendar", icon: "📅" }, // oculta por ora
      { label: "Repetir",  path: "/recurrences", icon: "🔄" },
    ],
  },
  {
    label: "Financeiro",
    path: "/finance/overview",
    icon: "R$",
    prefixes: ["/finance"],
    children: [
      { label: "Visão Geral", path: "/finance/overview",  icon: "📊", exact: true },
      { label: "Gastos",      path: "/finance/expenses",     icon: "💸" },
      { label: "Ganhos",      path: "/finance/income",       icon: "💰" },
      { label: "Lançar",      path: "/finance/launch",       icon: "📝" },
    ],
  },
  {
    label: "Rotina",
    path: "/routine",
    icon: "⏱",
  },
];

function isItemActive(item, pathname) {
  if (item.exact) return pathname === item.path;
  if (item.prefixes) return item.prefixes.some(p => pathname.startsWith(p));
  return pathname.startsWith(item.path);
}

// Prefixos de seções com accordion
const TASK_PREFIXES    = NAV.find(i => i.label === "Tarefas")?.prefixes    ?? [];
const FINANCE_PREFIXES = NAV.find(i => i.label === "Financeiro")?.prefixes ?? [];

// Listas flat para barra mobile
const MOBILE_GLOBAL   = NAV.filter(i => !i.exact);
const MOBILE_TASKS    = NAV.find(i => i.label === "Tarefas")?.children    ?? [];
const MOBILE_FINANCE  = NAV.find(i => i.label === "Financeiro")?.children ?? [];

export default function Navigation() {
  const pathname = usePathname();
  const isTaskSection    = TASK_PREFIXES.some(p => pathname.startsWith(p));
  const isFinanceSection = FINANCE_PREFIXES.some(p => pathname.startsWith(p));

  // Mobile: mostra sub-itens do contexto ativo, senão itens globais
  const mobileItems = isTaskSection
    ? MOBILE_TASKS
    : isFinanceSection
      ? MOBILE_FINANCE
      : MOBILE_GLOBAL;

  return (
    <nav className={styles.nav}>

      {/* ── Brand (desktop only) ─────────────────────────────────────────── */}
      <Link href="/" className={styles.brand}>
        <span className={styles.brandMark}>G</span>
        <div className={styles.brandText}>
          <span className={styles.brandName}>Daily</span>
          <span className={styles.brandSub}>workspace</span>
        </div>
      </Link>

      <div className={styles.divider} />

      {/* ── Sidebar desktop: accordion ───────────────────────────────────── */}
      <div className={`${styles.items} ${styles.desktopItems}`}>
        {NAV.map((item) => {
          const active = isItemActive(item, pathname);
          const open   = item.children && active;

          return (
            <div key={item.path} className={styles.itemGroup}>
              {item.sectionLabel && (
                <span className={styles.sectionLabel}>{item.sectionLabel}</span>
              )}

              <Link
                href={item.path}
                className={`${styles.item} ${active ? styles.active : ""}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
                {item.children && (
                  <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </Link>

              {item.children && (
                <div className={`${styles.subItems} ${open ? styles.subItemsOpen : ""}`}>
                  {item.children.map((child) => {
                    const childActive = child.exact
                      ? pathname === child.path
                      : pathname.startsWith(child.path);
                    return (
                      <Link
                        key={child.path}
                        href={child.path}
                        className={`${styles.subItem} ${childActive ? styles.subItemActive : ""}`}
                      >
                        <span className={styles.subIcon}>{child.icon}</span>
                        <span className={styles.subLabel}>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Barra mobile: flat + contexto-sensitiva ──────────────────────── */}
      <div className={`${styles.items} ${styles.mobileItems}`}>
        {mobileItems.map((item) => {
          const active = item.exact
            ? pathname === item.path
            : item.prefixes
              ? item.prefixes.some(p => pathname.startsWith(p))
              : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`${styles.item} ${active ? styles.active : ""}`}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>

    </nav>
  );
}
