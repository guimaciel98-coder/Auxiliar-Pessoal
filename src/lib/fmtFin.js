/** Formata valor monetário sem casas decimais. Se hidden=true retorna "R$ •••••". */
export function fmtFin(v, hidden = false) {
  if (hidden) return "R$ •••••";
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}
