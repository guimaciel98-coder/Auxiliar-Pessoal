// Padrões que o Todoist reconhece em português e inglês
const KNOWN_PATTERNS = [
  // Diário
  /\btodo\s+dia\b/i,
  /\bdiariamente\b/i,
  /\bdi[aá]rio\b/i,
  /\bevery\s+day\b/i,
  /\bevery\s+other\s+day\b/i,
  /\bevery\s+\d+\s+days?\b/i,

  // Dias úteis
  /\bdias?\s+[úu]tei[s]?\b/i,
  /\btodo\s+dia\s+[úu]til\b/i,
  /\bevery\s+weekday\b/i,
  /\bevery\s+working\s+day\b/i,

  // Semanal
  /\btoda\s+semana\b/i,
  /\bsemanal\b/i,
  /\bevery\s+week\b/i,
  /\bevery\s+\d+\s+weeks?\b/i,
  /\btoda\s+(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)/i,
  /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,

  // Quinzenal
  /\bquinzenal\b/i,
  /\ba\s+cada\s+2\s+semanas?\b/i,
  /\bevery\s+2\s+weeks?\b/i,
  /\bevery\s+other\s+week\b/i,

  // Mensal
  /\btodo\s+m[eê]s\b/i,
  /\bmensal\b/i,
  /\bevery\s+month\b/i,
  /\bevery\s+\d+\s+months?\b/i,
  /\ba\s+cada\s+\d+\s+meses?\b/i,
  /\btodo\s+(primeiro|[uú]ltimo|segundo|terceiro)\s+dia\b/i,
  /\btodo\s+(primeiro|[uú]ltimo|segundo|terceiro)\s+dia\s+[úu]til\b/i,
  /\btodo\s+[úu]ltimo\b/i,

  // Ordinal + dia da semana (ex: "todo segundo domingo", "todo primeiro sábado")
  /\btodo\s+(primeiro|segundo|terceiro|quarto|[uú]ltimo)\s+(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b/i,
  /\bevery\s+(1st|2nd|3rd|4th|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,

  // Anual
  /\btodo\s+ano\b/i,
  /\banual\b/i,
  /\banualmente\b/i,
  /\bevery\s+year\b/i,
  /\bevery\s+\d+\s+years?\b/i,

  // Genérico "a cada N ..."
  /\ba\s+cada\s+\d+/i,
  /\bevery\s+\d+\b/i,
];

/**
 * Retorna o estado de validação de uma string de recorrência.
 * "valid"   → padrão reconhecido
 * "unknown" → não reconhecido, mas não está vazio
 * "empty"   → campo vazio
 */
export function validateRecurrence(text) {
  const t = text?.trim() ?? "";
  if (!t) return "empty";
  if (KNOWN_PATTERNS.some(re => re.test(t))) return "valid";
  return "unknown";
}
