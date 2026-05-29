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

  const isLoadingRef = useRef(false);

  function showToast(message) {
    const key = Date.now();
    setToast({ message, key });
    setTimeout(() => setToast(t => t?.key === key ? null : t), 2500);
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
      // O estado `completed` persiste naturalmente no React durante a sessão.
      // Não resetar aqui — só addHidden/removeHidden e o restore do mount o modificam.
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

  async function rescheduleTask(taskId, newDueDate, timed, isRecurring, recurrence, label) {
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
      setFading(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      showToast(`→ Reagendado para ${label ?? "nova data"}`);
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
      setFading(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      const name = taskName;
      showToast(name ? `✓ Concluída: ${name.length > 28 ? name.slice(0, 28) + "…" : name}` : "✓ Tarefa concluída");

      setTimeout(load, 2000); // 2s para o Todoist processar antes do refetch
    } catch (e) {
      setFading(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      removeHidden(taskId);
      showToast("⚠️ Erro ao concluir. Tente novamente.");
      console.error("[completeTask]", e.message);
    } finally {
      setCompleting(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  }

  return {
    data, loading, syncing, clockNow,
    load, sync, showToast,
    completed, completing, fading, rescheduling,
    rescheduleTask, completeTask,
    toast,
  };
}
