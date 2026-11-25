"use client";
// Saúde > Importar — sobe o export do app Saúde do iPhone (.zip ou .xml).
// O arquivo é lido no navegador; só o resumo por dia e os treinos vão para a planilha.
import { useState, useRef, useMemo } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import ex from "../../finance/expenses/Expenses.module.css";
import im from "./Import.module.css";
import { useHealth } from "@/hooks/useHealth";
import { parseHealthFile } from "@/lib/appleHealthParse";

const ROSE = "#fb7185";
const BATCH = 300;
const fmtN = n => (n ?? 0).toLocaleString("pt-BR");
const brToIso = br => { const [d, m, y] = String(br).split("/"); return `${y}-${m}-${d}`; };
const isoToBr = iso => iso ? iso.split("-").reverse().join("/") : "—";
const mb = b => `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

async function post(body) {
  const r = await fetch("/api/health/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: `Erro ${r.status}` }));
  if (!j.ok) throw new Error(j.error ?? "Falha ao enviar");
  return j;
}

export default function HealthImportPage() {
  const { data, refetch } = useHealth();
  const inputRef = useRef(null);
  const [drag, setDrag]   = useState(false);
  const [file, setFile]   = useState(null);
  const [stage, setStage] = useState("idle"); // idle | reading | ready | sending | done | error
  const [prog, setProg]   = useState(0);
  const [parsed, setParsed] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // O que já está no app
  const existing = useMemo(() => {
    const days = new Set((data?.days ?? []).map(d => d.date));
    const wks  = new Set((data?.workouts ?? []).map(w => `${w.date}|${w.duracao_min}`));
    const last = [...days].map(brToIso).sort().pop() ?? null;
    return { days, wks, last };
  }, [data]);

  const preview = useMemo(() => {
    if (!parsed) return null;
    const newDays = parsed.days.filter(d => !existing.days.has(d.date));
    const newWks  = parsed.workouts.filter(w => !existing.wks.has(`${w.date}|${w.duracao_min}`));
    return { newDays: newDays.length, newWks: newWks.length };
  }, [parsed, existing]);

  async function pick(f) {
    if (!f) return;
    if (!/\.(zip|xml)$/i.test(f.name)) { setFile(f); setStage("error"); setError("Esse arquivo não é .zip nem .xml. Use o export do app Saúde."); return; }
    setFile(f); setParsed(null); setResult(null); setError(""); setProg(0); setStage("reading");
    try {
      const res = await parseHealthFile(f, p => setProg(p));
      setParsed(res); setStage("ready");
    } catch (e) {
      setError(e.message || "Não consegui ler o arquivo."); setStage("error");
    }
  }

  async function send() {
    setStage("sending"); setProg(0);
    try {
      const { days, workouts } = parsed;
      const steps = Math.ceil(days.length / BATCH) * 2 || 1;
      let done = 0, dw = 0, ww = 0, su = 0;
      for (let i = 0; i < Math.max(days.length, 1); i += BATCH) {
        const j = await post({ days: days.slice(i, i + BATCH), workouts: i === 0 ? workouts : [] });
        dw += j.days_written ?? 0; ww += j.workouts_written ?? 0;
        setProg(++done / steps);
      }
      // Corrige o sono de dias que já estavam no app (o dia do último export costuma estar incompleto)
      for (let i = 0; i < days.length; i += BATCH) {
        const j = await post({ days: days.slice(i, i + BATCH), workouts: [], update_sleep: true });
        su += j.sleep_updated ?? 0;
        setProg(++done / steps);
      }
      setResult({ days: dw, workouts: ww, sleep: su });
      setStage("done");
      refetch();
    } catch (e) {
      setError(e.message); setStage("error");
    }
  }

  function reset() { setFile(null); setParsed(null); setResult(null); setError(""); setStage("idle"); if (inputRef.current) inputRef.current.value = ""; }

  const busy = stage === "reading" || stage === "sending";
  const pct = Math.round(prog * 100);

  return (
    <div className={ex.page} style={{ background: "radial-gradient(50% 35% at 85% 0%, rgba(251,113,133,0.10), transparent 70%), #07080c" }}>
      <ModuleHeader title="Saúde" hideOnDesktop />
      <Navigation />

      <header className={ex.top}>
        <div className={ex.topLeft}>
          <span className={ex.eyebrow}>Saúde · app Saúde do iPhone</span>
          <h1 className={ex.title}>Importar</h1>
        </div>
      </header>

      {/* Big numbers */}
      <div className={`${ex.tabs} ${im.nums}`}>
        <div className={ex.tabBox} style={{ "--t": ROSE, cursor: "default" }}>
          <span className={ex.tabLabel}>No app até</span>
          <span className={ex.tabValue} style={{ color: ROSE }}>{existing.last ? isoToBr(existing.last).slice(0, 5) : "—"}</span>
          <span className={ex.tabHint}>{existing.last ? existing.last.slice(0, 4) : "sem dados"}</span>
        </div>
        <div className={ex.tabBox} style={{ cursor: "default" }}>
          <span className={ex.tabLabel}>Dias no arquivo</span>
          <span className={ex.tabValue}>{parsed ? fmtN(parsed.days.length) : "—"}</span>
          <span className={ex.tabHint}>{parsed ? `${isoToBr(parsed.first)} → ${isoToBr(parsed.last)}` : "escolha o arquivo"}</span>
        </div>
        <div className={ex.tabBox} style={{ "--t": "#34d399", cursor: "default" }}>
          <span className={ex.tabLabel}>Dias novos</span>
          <span className={ex.tabValue} style={{ color: "#34d399" }}>{result ? fmtN(result.days) : preview ? fmtN(preview.newDays) : "—"}</span>
          <span className={ex.tabHint}>{result ? "gravados" : "a gravar"}</span>
        </div>
        <div className={ex.tabBox} style={{ "--t": "#a78bfa", cursor: "default" }}>
          <span className={ex.tabLabel}>Treinos novos</span>
          <span className={ex.tabValue} style={{ color: "#a78bfa" }}>{result ? fmtN(result.workouts) : preview ? fmtN(preview.newWks) : "—"}</span>
          <span className={ex.tabHint}>{result ? "gravados" : "a gravar"}</span>
        </div>
      </div>

      <div className={ex.layout}>
        <div className={ex.mainArea}>
          {/* Área de soltar / estado */}
          <div
            className={`${im.drop} ${drag ? im.dropOn : ""} ${busy ? im.dropBusy : ""} ${stage === "done" ? im.dropDone : ""} ${stage === "error" ? im.dropErr : ""}`}
            onDragOver={e => { e.preventDefault(); if (!busy) setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); if (!busy) pick(e.dataTransfer.files?.[0]); }}
            onClick={() => { if (stage === "idle") inputRef.current?.click(); }}
          >
            <input ref={inputRef} type="file" accept=".zip,.xml,application/zip,text/xml" hidden onChange={e => pick(e.target.files?.[0])} />

            {stage === "idle" && (<>
              <div className={im.icon}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
              </div>
              <b className={`${im.big} ${im.desk}`}>Arraste o export.zip aqui</b>
              <span className={`${im.sub} ${im.desk}`}>ou <u>clique para escolher</u> · .zip ou .xml</span>
              <b className={`${im.big} ${im.mob}`}>Toque para escolher o export.zip</b>
              <span className={`${im.sub} ${im.mob}`}>no app Arquivos do iPhone</span>
            </>)}

            {busy && (<>
              <div className={im.pct}>{pct}<small>%</small></div>
              <b className={im.big}>{stage === "reading" ? "Lendo o arquivo…" : "Gravando no app…"}</b>
              <div className={im.bar}><span style={{ width: `${pct}%` }} /></div>
              <span className={im.sub}>{file?.name} · {file && mb(file.size)}</span>
            </>)}

            {stage === "ready" && parsed && (<>
              <div className={im.icon} style={{ "--c": "#34d399" }}>✓</div>
              <b className={im.big}>Arquivo lido</b>
              <span className={im.sub}>{file?.name} · {fmtN(parsed.records)} registros · {fmtN(parsed.workouts.length)} treinos</span>
              <div className={im.actions}>
                <button className={ex.primaryBtn} onClick={e => { e.stopPropagation(); send(); }}>Importar para o app →</button>
                <button className={im.ghost} onClick={e => { e.stopPropagation(); reset(); }}>Trocar arquivo</button>
              </div>
            </>)}

            {stage === "done" && result && (<>
              <div className={im.icon} style={{ "--c": "#34d399" }}>✓</div>
              <b className={im.big}>Importado</b>
              <span className={im.sub}>{fmtN(result.days)} dias novos · {fmtN(result.workouts)} treinos · sono revisado em {fmtN(result.sleep)} dias</span>
              <div className={im.actions}>
                <a className={ex.primaryBtn} href="/health">Ver Atividade →</a>
                <button className={im.ghost} onClick={e => { e.stopPropagation(); reset(); }}>Importar outro</button>
              </div>
            </>)}

            {stage === "error" && (<>
              <div className={im.icon} style={{ "--c": ROSE }}>!</div>
              <b className={im.big}>Não deu certo</b>
              <span className={im.sub}>{error}</span>
              <div className={im.actions}>
                {parsed && <button className={ex.primaryBtn} onClick={e => { e.stopPropagation(); send(); }}>Tentar de novo</button>}
                <button className={im.ghost} onClick={e => { e.stopPropagation(); reset(); }}>Escolher outro arquivo</button>
              </div>
            </>)}
          </div>

          {/* O que entra */}
          <div className={ex.panel}>
            <div className={ex.panelTitle}>O que é importado</div>
            <div className={im.chips}>
              {[["🏋️","Treinos","#a78bfa"],["👟","Passos","#34d399"],["🔥","Calorias","#fbbf24"],["😴","Sono","#818cf8"],["❤️","Batimentos","#fb7185"],["📍","Distância","#38bdf8"]].map(([e, l, c]) => (
                <span key={l} className={im.chip} style={{ "--c": c }}><i>{e}</i>{l}</span>
              ))}
            </div>
            <p className={im.note}>Dias que já estão no app não são duplicados. O arquivo não é enviado — só o resumo de cada dia.</p>
          </div>
        </div>

        {/* Lateral: como exportar */}
        <div className={ex.side}>
          <div className={ex.panel}>
            <div className={ex.panelTitle}>Como exportar no iPhone</div>
            <ol className={im.steps}>
              <li><b>1</b><span>App <em>Saúde</em> → sua foto no canto</span></li>
              <li><b>2</b><span><em>Exportar Todos os Dados de Saúde</em></span></li>
              <li><b>3</b><span><em>Salvar em Arquivos</em> (ou mande pro computador)</span></li>
              <li><b>4</b><span>Abra este site e envie o <em>export.zip</em></span></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
