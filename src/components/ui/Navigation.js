"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navigation.module.css";
import NavIcon from "./NavIcon";
import BrandMark from "./BrandMark";

const FINANCE_ONLY = process.env.NEXT_PUBLIC_FINANCE_ONLY === "true";

// ── Estrutura única de navegação ──────────────────────────────────────────────
const NAV_FULL = [
  {
    label: "Hub",
    path: "/",
    icon: "grid",
    exact: true,
  },
  {
    label: "Tarefas",
    path: "/daily",
    icon: "check",
    accent: "#a78bfa",
    sectionLabel: "Módulos",
    prefixes: ["/daily", "/tomorrow", "/board", "/calendar", "/recurrences"],
    children: [
      { label: "Hoje",     path: "/daily",       icon: "flame", exact: true },
      { label: "Projetos", path: "/board",       icon: "kanban" },
      { label: "Repetir",  path: "/recurrences", icon: "repeat" },
    ],
  },
  {
    label: "Financeiro",
    path: "/finance/overview",
    icon: "wallet",
    accent: "#34d399",
    prefixes: ["/finance"],
    children: [
      { label: "Visão Geral", path: "/finance/overview",  icon: "pie", exact: true },
      { label: "Gastos",      path: "/finance/expenses",     icon: "arrowDown" },
      { label: "Ganhos",      path: "/finance/income",       icon: "arrowUp" },
      { label: "Lançar",      path: "/finance/launch",       icon: "plus" },
    ],
  },
  {
    label: "Rotina",
    path: "/routine",
    icon: "clock",
    accent: "#38bdf8",
    prefixes: ["/routine"],
    children: [
      { label: "Minha Rotina", path: "/routine",         icon: "calendar", exact: true },
      { label: "Eventos",      path: "/routine/events",  icon: "star" },
    ],
  },
  {
    label: "Saúde",
    path: "/health",
    icon: "heart",
    accent: "#fb7185",
    prefixes: ["/health"],
    children: [
      { label: "Atividade", path: "/health",         icon: "pulse", exact: true },
      { label: "Importar",  path: "/health/import",  icon: "upload" },
    ],
  },
];

const NAV = FINANCE_ONLY
  ? NAV_FULL.filter(i => i.label === "Financeiro")
  : NAV_FULL;

// "seg, 23 nov"
function todayLabel() {
  const d   = new Date();
  const wd  = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const mon = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${d.getDate()} ${mon}`;
}

function isItemActive(item, pathname) {
  if (item.exact) return pathname === item.path;
  if (item.prefixes) return item.prefixes.some(p => pathname.startsWith(p));
  return pathname.startsWith(item.path);
}

// Prefixos de seções com accordion
const TASK_PREFIXES    = NAV_FULL.find(i => i.label === "Tarefas")?.prefixes    ?? [];
const FINANCE_PREFIXES = NAV_FULL.find(i => i.label === "Financeiro")?.prefixes ?? [];
const ROUTINE_PREFIXES = NAV_FULL.find(i => i.label === "Rotina")?.prefixes    ?? [];

// Listas flat para barra mobile
const MOBILE_GLOBAL   = NAV_FULL.filter(i => !i.exact);
const MOBILE_TASKS    = NAV_FULL.find(i => i.label === "Tarefas")?.children    ?? [];
const MOBILE_FINANCE  = NAV_FULL.find(i => i.label === "Financeiro")?.children ?? [];
const MOBILE_ROUTINE  = NAV_FULL.find(i => i.label === "Rotina")?.children     ?? [];

export default function Navigation() {
  const pathname = usePathname();
  const isTaskSection    = TASK_PREFIXES.some(p => pathname.startsWith(p));
  const isFinanceSection = FINANCE_PREFIXES.some(p => pathname.startsWith(p));
  const isRoutineSection = ROUTINE_PREFIXES.some(p => pathname.startsWith(p));

  // Mobile: mostra sub-itens do contexto ativo, senão itens globais
  // Cor do módulo atual (para os sub-itens na barra do celular)
  const sectionAccent = NAV_FULL.find(i => i.prefixes?.some(p => pathname.startsWith(p)))?.accent;

  const mobileItems = FINANCE_ONLY
    ? MOBILE_FINANCE
    : isTaskSection
      ? MOBILE_TASKS
      : isFinanceSection
        ? MOBILE_FINANCE
        : isRoutineSection
          ? MOBILE_ROUTINE
          : MOBILE_GLOBAL;

  return (
    <nav className={styles.nav}>

      {/* ── Brand (desktop only) ─────────────────────────────────────────── */}
      <Link href="/" className={styles.brand}>
        <span className={styles.brandMark}><BrandMark size={22} /></span>
        <div className={styles.brandText}>
          <span className={styles.brandName}>Daily</span>
          <span className={styles.brandSub} suppressHydrationWarning>{todayLabel()}</span>
        </div>
      </Link>

      {/* ── Sidebar desktop: accordion ───────────────────────────────────── */}
      <div className={`${styles.items} ${styles.desktopItems}`}>
        {NAV.map((item) => {
          const active = isItemActive(item, pathname);
          const open   = item.children && active;

          return (
            <div key={item.path} className={styles.itemGroup} style={item.accent ? { "--section-accent": item.accent } : {}}>
              {item.sectionLabel && (
                <span className={styles.sectionLabel}>{item.sectionLabel}</span>
              )}

              <Link
                href={item.path}
                className={`${styles.item} ${active ? styles.active : ""}`}
              >
                <span className={styles.icon}><NavIcon name={item.icon} /></span>
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
                        <span className={styles.subIcon}><NavIcon name={child.icon} size={15} /></span>
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
              style={{ "--section-accent": item.accent ?? sectionAccent ?? "#e5e7eb" }}
            >
              <span className={styles.icon}><NavIcon name={item.icon} /></span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>

    </nav>
  );
}
