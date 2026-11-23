// "SÃO FRANCISCO DE ASSIS" → "São Francisco de Assis" (nomes vêm em maiúsculo do Todoist)
const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);
const ACRONYMS    = new Set(["SOS"]);

export function niceName(s = "") {
  return String(s).split(" ").map((orig, i) => {
    if (/[^A-Za-zÀ-ÿ]/.test(orig) || ACRONYMS.has(orig)) return orig; // siglas como "R&K" e "SOS"
    const w = orig.toLowerCase();
    return i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}
