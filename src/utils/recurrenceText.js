// Textos de recorrência — só para EXIBIR. As regras no Todoist não são alteradas.
// O Todoist devolve a regra como foi digitada, às vezes em inglês ("every friday").

const DAYS_EN = {
  monday: "segunda", tuesday: "terça", wednesday: "quarta", thursday: "quinta",
  friday: "sexta", saturday: "sábado", sunday: "domingo",
};
const MONTHS_EN = { jan: "jan", feb: "fev", mar: "mar", apr: "abr", may: "mai", jun: "jun", jul: "jul", aug: "ago", sep: "set", oct: "out", nov: "nov", dec: "dez" };
const ORD = { "1st": "1º", "2nd": "2º", "3rd": "3º", "4th": "4º" };
const fem = d => (d === "sábado" || d === "domingo" ? "todo" : "toda");

/** "every friday" → "toda sexta"; regras já em português passam como estão. */
export function recPt(str = "") {
  let t = String(str).trim();
  if (!/^every\b/i.test(t)) return t;
  t = t.toLowerCase();

  // "every year starting dec 20 2026" → "todo ano (desde 20 dez)"
  let m = t.match(/^every year starting (\w{3})\w* (\d{1,2})/);
  if (m) return `todo ano (desde ${m[2]} ${MONTHS_EN[m[1]] ?? m[1]})`;

  // horário no fim: "at 20:30" / "at 10h"
  let at = "";
  m = t.match(/ at (.+)$/);
  if (m) { at = ` às ${m[1]}`; t = t.slice(0, m.index); }

  // dias da semana (um ou vários): "every wednesday, friday, sunday"
  m = t.match(/^every ((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*,\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)$/);
  if (m) {
    const days = m[1].split(/\s*,\s*/).map(d => DAYS_EN[d]);
    const list = days.length > 1 ? `${days.slice(0, -1).join(", ")} e ${days.at(-1)}` : days[0];
    return `${fem(days[0])} ${list}${at}`;
  }
  // "every last monday" / "every 2nd sunday"
  m = t.match(/^every (last|1st|2nd|3rd|4th) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (m) {
    const d = DAYS_EN[m[2]];
    const art = fem(d);
    return m[1] === "last" ? `${art} ${art === "todo" ? "último" : "última"} ${d}${at}` : `${art} ${ORD[m[1]]} ${d} do mês${at}`;
  }

  const simple = [
    [/^every day$/, "todo dia"], [/^every (weekday|workday)$/, "todo dia útil"],
    [/^every week$/, "toda semana"], [/^every other week$/, "a cada 2 semanas"],
    [/^every month$/, "todo mês"], [/^every year$/, "todo ano"],
    [/^every last day$/, "todo último dia do mês"],
    [/^every (\d+) days?$/, "a cada $1 dias"], [/^every (\d+) weeks?$/, "a cada $1 semanas"],
    [/^every (\d+) months?$/, "a cada $1 meses"], [/^every (\d+)(st|nd|rd|th)$/, "todo dia $1"],
  ];
  for (const [re, pt] of simple) if (re.test(t)) return t.replace(re, pt) + at;
  return String(str).trim();
}

/**
 * Grupo de frequência a partir do texto da regra (para organizar a tela Repetir).
 * Retorna: daily | weekdays | weekly | biweekly | monthly | yearly | other
 */
export function recGroup(str = "") {
  const t = String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\btodod\b/g, "todo").trim(); // "todod": erro de digitação comum
  if (!t) return "other";

  // anual: "every year", "todo ano", "todo 26 novembro", "todo dia 23/09"
  if (/\b(every year|todo ano|anual)/.test(t)) return "yearly";
  if (/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.test(t)) return "yearly";
  if (/\bdia \d{1,2}\/\d{1,2}\b/.test(t)) return "yearly";

  // "a cada N dias" / "every N days" / "todo N dias"
  const nd = t.match(/\b(?:every|a cada|todo|todos os) (\d+) (?:days?|dias)\b/);
  if (nd) {
    const n = Number(nd[1]);
    if (n === 1) return "daily";
    if (n === 14 || n === 15) return "biweekly";
    if (n >= 28 && n <= 31) return "monthly";
    if (n === 7) return "weekly";
    return "other";
  }
  if (/\b(every other week|a cada 2 semanas|every 2 weeks|quinzenal)\b/.test(t)) return "biweekly";

  // mensal: "Nº dia útil", "último dia útil", "todo dia 25", "every 15th", "última quarta", "2nd sunday"
  if (/(\d+ ?[°º]|\b(ultimo|ultima|last|1st|2nd|3rd|4th)\b)/.test(t)) return "monthly";
  if (/\b(todo dia \d{1,2}|every \d+(st|nd|rd|th)|todo mes|every month|mensal)\b/.test(t)) return "monthly";

  // dias úteis
  if (/\b(dia util|dias uteis|weekday|workday)\b/.test(t)) return "weekdays";

  // diário: "todo dia", "todos os dias", "every day" (com ou sem horário)
  if (/\b(todo dia|todos os dias|every day|diario|diariamente)\b/.test(t)) return "daily";

  // semanal: dia(s) da semana, "toda semana"
  if (/\b(segunda|terca|quarta|quinta|sexta|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|toda semana|every week|semanal)\b/.test(t)) return "weekly";

  return "other";
}
