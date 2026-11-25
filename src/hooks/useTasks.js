import { useState, useCallback, useEffect, useRef } from "react";

const LS_KEY = "dailyapp_completed";

function todayKey() {
  const d = new Date(Date.now() - 3 * 3600 * 1000); // BRT
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

function ssLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return new Set(raw[todayKey()] ?? []);
  } catch { return new Set(); }
}

function ssSave(set) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ [todayKey()]: [...set] }));
  } catch {}
}

// Tarefas adiadas hoje (somem de Hoje, mas NÃO contam como feitas) e nomes das concluídas aqui
const LS_MOVED = "dailyapp_moved";
const LS_NAMES = "dailyapp_done_names";
function lsDay(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "{}")[todayKey()] ?? fallback; } catch { return fallback; }
}
function lsDaySave(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ [todayKey()]: value })); } catch {}
}

export function useTasks(mode = "today") {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  // Começa vazio (seguro para SSR). O useEffect abaixo restaura do sessionStorage no cliente.
  const [completed, setCompleted] = useState(new Set());
  const [completing, setCompleting] = useState(new Set());
  const [fading, setFading]       = useState(new Set());
  const [rescheduling, setRescheduling] = useState(new Set());
  const [clockNow, setClockNow]   = useState(Date.now());
  const [toast, setToast]         = useState(null);
  const [moved, setMoved]         = useState(new Set());   // adiadas hoje (ids em string)
  const [doneNames, setDoneNames] = useState({});          // id → nome das concluídas por aqui

  function markMoved(taskId, on) {
    setMoved(prev => {
      const next = new Set(prev);
      on ? next.add(String(taskId)) : next.delete(String(taskId));
      lsDaySave(LS_MOVED, [...next]);
      return next;
    });
  }
  function rememberName(taskId, name) {
    if (!name) return;
    setDoneNames(prev => { const next = { ...prev, [String(taskId)]: name }; lsDaySave(LS_NAMES, next); return next; });
  }

  const isLoadingRef = useRef(false);
  const reloadTimerRef = useRef(null);

  function showToast(message, onUndo = null) {
    const key = Date.now();
    setToast({ message, key, onUndo });
    setTimeout(() => setToast(t => t?.key === key ? null : t), onUndo ? 5000 : 2500);
  }

  function addHidden(taskId) {
    setCompleted(prev => {
      const next = new Set(prev).add(taskId);
      ssSave(next);
      return next;
    });
  }

  function removeHidden(taskId) {
    setCompleted(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      ssSave(next);
      return next;
    });
  }

  const load = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const r = await fetch(`/api/tasks?mode=${mode}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`Erro ${r.status}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      // Se uma tarefa concluída pelo app voltou como pendente no Todoist
      // (ex: recorrente reagendada para hoje), remove do completed local.
      const returnedIds = new Set((json.tasks ?? []).map(t => t.id));
      setCompleted(prev => {
        const cleaned = new Set([...prev].filter(id => !returnedIds.has(id)));
        if (cleaned.size !== prev.size) ssSave(cleaned);
        return cleaned;
      });
    } catch (e) {
      console.error("[useTasks] load:", e);
      showToast("⚠️ Erro ao carregar tarefas. Verifique a conexão.");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [mode]);

  const sync = useCallback(async () => {
    setSyncing(true);
    isLoadingRef.current = false; // força fetch mesmo se poll estiver rodando
    const start = Date.now();
    await load();
    const remaining = Math.max(0, 1000 - (Date.now() - start));
    setTimeout(() => setSyncing(false), remaining);
  }, [load]);

  // Restaura tasks ocultas do sessionStorage (só roda no cliente, não no servidor)
  useEffect(() => {
    const restored = ssLoad();
    if (restored.size > 0) setCompleted(restored);
    setMoved(new Set(lsDay(LS_MOVED, [])));
    setDoneNames(lsDay(LS_NAMES, {}));
    setMoved(new Set(lsDay(LS_MOVED, [])));
    setDoneNames(lsDay(LS_NAMES, {}));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Refetch ao voltar para a aba ou ganhar foco (usuário vem do Todoist)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    const onFocus   = () => load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setClockNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let startY = 0;
    const onStart = (e) => { startY = e.touches[0].clientY; };
    const onEnd   = (e) => {
      if (e.changedTouches[0].clientY - startY > 80 && window.scrollY === 0) load();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend",   onEnd);
    };
  }, [load]);

  async function rescheduleTask(taskId, newDueDate, timed, isRecurring, recurrence, label, prevDueDate) {
    setRescheduling(prev => new Set(prev).add(taskId));
    setFading(prev => new Set(prev).add(taskId));

    try {
      const res = await fetch("/api/tasks/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, dueDate: newDueDate, timed, isRecurring: !!isRecurring, recurrence: recurrence ?? null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      addHidden(taskId);
      markMoved(taskId, true);
      setFading(prev => { const s = new Set(prev); s.delete(taskId); return s; });

      const undoReschedule = prevDueDate ? async () => {
        setToast(null);
        try {
          const prevDate = new Date(Number(prevDueDate));
          const pad = n => String(n).padStart(2, "0");
          const iso = `${prevDate.getUTCFullYear()}-${pad(prevDate.getUTCMonth()+1)}-${pad(prevDate.getUTCDate())}`;
          await fetch("/api/tasks/reschedule", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId, dueDate: iso, timed, isRecurring: !!isRecurring, recurrence: recurrence ?? null }),
          });
          removeHidden(taskId);
          markMoved(taskId, false);
          setTimeout(load, 500);
        } catch {}
      } : null;

      showToast(`→ ${label ?? "Reagendado"}`, undoReschedule);
      setTimeout(load, 1000);
    } catch (e) {
      setFading(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      removeHidden(taskId);
      console.error("[rescheduleTask]", e.message);
      showToast("Erro ao reagendar");
    } finally {
      setRescheduling(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  }

  async function completeTask(taskId, taskName) {
    setCompleting(prev => new Set(prev).add(taskId));
    setFading(prev => new Set(prev).add(taskId));

    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (navigator.vibrate) navigator.vibrate(50);
      addHidden(taskId);
      markMoved(taskId, false);
      rememberName(taskId, taskName);
      setFading(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      const name = taskName;

      const undoComplete = async () => {
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
        setToast(null);
        try {
          const res = await fetch("/api/tasks/reopen", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });
          if (!res.ok) throw new Error("Erro ao reabrir");
          removeHidden(taskId);
          load();
        } catch (e) {
          showToast("⚠ Erro ao desfazer");
        }
      };

      showToast(
        name ? `✓ ${name.length > 28 ? name.slice(0, 28) + "…" : name}` : "✓ Concluída",
        undoComplete
      );

      reloadTimerRef.current = setTimeout(load, 5000);
    } catch (e) {
      setFading(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      removeHidden(taskId);
      showToast("⚠️ Erro ao concluir. Tente novamente.");
      console.error("[completeTask]", e.message);
    } finally {
      setCompleting(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  }

  // Reabre uma tarefa concluída (usado na lista "Feitas"). Só para tarefas não recorrentes:
  // nas recorrentes o Todoist já avançou a data e reabrir não voltaria ao estado anterior.
  const [reopening, setReopening] = useState(new Set());
  async function reopenCompleted(taskId, taskName) {
    setReopening(prev => new Set(prev).add(taskId));
    try {
      const res = await fetch("/api/tasks/reopen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error("Erro ao reabrir");
      removeHidden(taskId);
      showToast(`↺ ${taskName && taskName.length > 28 ? taskName.slice(0, 28) + "…" : taskName ?? "Tarefa"} reaberta`);
      load();
      return true;
    } catch (e) {
      console.error("[reopenCompleted]", e.message);
      showToast("⚠ Erro ao desfazer");
      return false;
    } finally {
      setReopening(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  }

  return {
    data, loading, syncing, clockNow,
    load, sync, showToast,
    completed, moved, doneNames, completing, fading, rescheduling, reopening,
    rescheduleTask, completeTask, reopenCompleted,
    toast,
  };
}
