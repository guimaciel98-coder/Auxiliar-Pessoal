"use client";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Finance.module.css";
import { useFinance } from "@/hooks/useFinance";
import { fmtFin } from "@/lib/fmtFin";

export default function IncomePage() {
  const { data, loading, error, hideNumbers, toggleHide } = useFinance();
  const fmt = (v) => fmtFin(v, hideNumbers);

  const ganhos = data?.ganhos ?? {};

  const incomeGroups = [
    { label: "CLT",          items: ganhos.items?.clt         ?? [], total: ganhos.clt         ?? 0 },
    { label: "PDV / Freelas",items: ganhos.items?.pdv         ?? [], total: ganhos.pdv         ?? 0 },
    { label: "Outros",       items: ganhos.items?.emprestimos ?? [], total: ganhos.emprestimos ?? 0 },
  ].filter(g => g.items.length > 0 && g.total > 0);

  const grandTotal = incomeGroups.reduce((s, g) => s + g.total, 0);

  return (
    <div className={styles.container}>
      <ModuleHeader title="Ganhos" />
      <Navigation />

      <header className={styles.header}>
        <div>
          <h1>Ganhos</h1>
          <p>{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
        </div>
        <button
          onClick={toggleHide}
          className={styles.addBtn}
          style={{
            background: hideNumbers ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
            color: hideNumbers ? "#f59e0b" : "var(--text-secondary)",
            borderColor: hideNumbers ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)",
            fontSize: 13,
          }}
        >
          {hideNumbers ? "◉ Mostrar" : "◎ Tampar"}
        </button>
      </header>

      {loading && <div className={styles.loading}>Carregando...</div>}
      {error && !loading && (
        <div className={styles.errorCard}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Erro ao carregar</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── Total de Ganhos ── */}
          <div style={{
            margin: "0 28px 28px",
            padding: "24px",
            borderRadius: 16,
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.18)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", marginBottom: 8,
            }}>
              Total de Ganhos
            </div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 900,
              color: "#10b981", letterSpacing: "-0.03em", lineHeight: 1,
            }}>
              {fmt(grandTotal)}
            </div>
          </div>

          {/* ── Grupos de renda ── */}
          <div className={styles.content} style={{ paddingBottom: 80 }}>
            {incomeGroups.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
                Nenhuma fonte de renda encontrada para este mês.
              </div>
            ) : incomeGroups.map(group => (
              <div key={group.label} style={{ marginBottom: 32 }}>

                {/* Label do grupo */}
                <div style={{
                  fontSize: 13, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.09em", color: "rgba(255,255,255,0.35)", marginBottom: 14,
                }}>
                  {group.label}
                </div>

                {/* Grid 2 colunas de cards */}
                <div className={styles.incomeCardGrid}>
                  {group.items.map((item, i) => (
                    <div key={i} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                      padding: 22,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}>
                      {/* Nome */}
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        {item.item}
                      </span>

                      {/* Valor */}
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "1.9rem", fontWeight: 800,
                        color: "#10b981", letterSpacing: "-0.02em", lineHeight: 1.1,
                        margin: "6px 0 10px",
                      }}>
                        {fmt(item.valor)}
                      </span>

                      {/* Rodapé: status + botões */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 99,
                          background: item.confirmado ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)",
                          color: item.confirmado ? "#10b981" : "rgba(255,255,255,0.38)",
                          border: item.confirmado ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(255,255,255,0.08)",
                        }}>
                          {item.confirmado ? "✓ recebido" : "○ pendente"}
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{
                            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                            fontFamily: "inherit", background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.45)", cursor: "pointer",
                          }}>
                            Editar
                          </button>
                          <button style={{
                            fontSize: 15, lineHeight: 1, width: 28, height: 28, borderRadius: 6,
                            fontFamily: "inherit", background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.4)", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            ···
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal do grupo */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 8, marginTop: 14 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Total {group.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 800, color: "#10b981" }}>
                    {fmt(group.total)}
                  </span>
                </div>

              </div>
            ))}

            {/* Adicionar Fonte de Renda */}
            <button style={{
              width: "100%", padding: 14, borderRadius: 12, fontFamily: "inherit",
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", marginTop: 4,
            }}>
              + Adicionar Fonte de Renda
            </button>
          </div>
        </>
      )}
    </div>
  );
}
