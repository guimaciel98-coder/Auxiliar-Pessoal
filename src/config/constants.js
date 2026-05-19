// ─── Projetos ─────────────────────────────────────────────────────────────────

export const PROJ = {
  pessoal: {
    id:    "6CrcpXWwgX3hVHJ2",
    cor:   "#94a3b8",
    label: "PESSOAL",
  },
  vca: {
    id:       "6Xvp8v5F2PGPq2g2",
    extraIds: ["6fCfcJvXv6MjF6Pq"],
    cor:      "#5b9fd6",
    label:    "VCA BRASIL",
  },
  pdv: {
    id:    "6CrcpXWwgMGrrrpv",
    cor:   "#818cf8",
    label: "PONTO DE VISTA",
  },
};

// ─── Seções VCA (marcas) ──────────────────────────────────────────────────────

export const VCA_SECTIONS = {
  // Seções do projeto principal VCA BRASIL
  "6XwPcC8xVgx6RF9R": "REUNIÕES",
  "6Xw2V2XXW8CRX23R": "GERAL",
  "6c6GFphRvHv33RC2": "PET CARE",
  "6c87j52hq8qWg7CR": "ANIMALIA",
  "6f2CRQwXXMpFjRg2": "BALNEÁRIO CAMBORIÚ",
  "6c6GFqWWGv4F2xq2": "VET QUALITY",
  "6c6GJ6mW8GwrPHFR": "ARIZA",
  "6fXqVjW64GqMX2xR": "PET SUPPORT + ONCO SUPPORT",
  "6fXqVhFcx9QXVCW2": "SÃO FRANCISCO DE ASSIS",
  "6fXvmVJCxw2XM38R": "DR HATO",
  "6fXvmW8M4cQpH4X2": "R&K",
  // Seções do sub-projeto "Entregas Ocupe - Performance" (IDs diferentes)
  "6fCv5mWg8f4Pwh8q": "GERAL",
  "6fCgCF2xj4wCxfpq": "PET CARE",
  "6fCgCH498pvWhMMH": "ANIMALIA",
  "6fCgCHjGHrq376xH": "BALNEÁRIO CAMBORIÚ",
  "6fCgCG9j79R5Q3Jq": "VET QUALITY",
  "6fCgCFQr4v7q4mWH": "ARIZA",
};

// ─── Seções PDV (clientes) ────────────────────────────────────────────────────

export const PDV_SECTIONS = {
  "6Rgc6rcXcvXrg97v": "PONTO DE VISTA",
  "6cGx6vHmm98fCvrM": "SOS",
  "6cVj2V24RGqC6FCv": "CLAUDIA GODOY",
  "6g6m25QR7mvj8Qjv": "LOFT",
};

// ─── UI helpers ───────────────────────────────────────────────────────────────

export const DAYS   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
export const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export const HEAT_COLOR = { past: "#f87171", hot: "#f59e0b", warm: "#f59e0b", soon: "#fde68a" };
export const PRIO_MAP   = { urgent: "p1", high: "p2", normal: "p3", low: "p4" };
