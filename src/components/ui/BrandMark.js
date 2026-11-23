// Símbolo do Daily: 4 quadrados nas cores dos módulos
// (Tarefas · Financeiro / Rotina · Saúde), igual à grade da tela inicial.
export default function BrandMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Daily">
      <rect x="3"  y="3"  width="8" height="8" rx="2.5" fill="#a78bfa" />
      <rect x="13" y="3"  width="8" height="8" rx="2.5" fill="#34d399" />
      <rect x="3"  y="13" width="8" height="8" rx="2.5" fill="#38bdf8" />
      <rect x="13" y="13" width="8" height="8" rx="2.5" fill="#fb7185" />
    </svg>
  );
}
