"use client";

import { useState, useEffect } from "react";
import styles from "./FixRecurrences.module.css";
import Link from "next/link";

export default function FixRecurrencesPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  async function load() {
    try {
      const res = await fetch("/api/tasks?mode=all");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.tasks || []);
      // Mostrar apenas as que não têm recorrência configurada
      setTasks(list.filter(t => t._recurrence === "none"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (taskId, recType) => {
    setProcessingId(taskId);
    try {
      // Usamos a rota de update existente
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          taskId, 
          recurrence: recType,
          // Se for recorrência, ativamos o padrão de trigger ao concluir
          triggerOnComplete: recType !== "none",
          repeatForever: true
        })
      });
      
      if (res.ok) {
        // Remove da lista local para dar sensação de progresso
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className={styles.loading}>Carregando tarefas pendentes...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🔄 Recuperação de Recorrências</h1>
        <p>Clique em uma opção para configurar a tarefa instantaneamente. Ela sumirá da lista após o clique.</p>
        <div className={styles.stats}>
          Restam <strong>{tasks.length}</strong> tarefas para revisar.
        </div>
      </header>

      <div className={styles.list}>
        {tasks.length === 0 ? (
          <div className={styles.done}>
            <h2>🎉 Tudo Pronto!</h2>
            <p>Você revisou todas as tarefas. Agora seu Daily App está com as recorrências em dia.</p>
            <Link href="/" className={styles.btnHome}>Voltar para o Dashboard</Link>
          </div>
        ) : (
          tasks.map(t => (
            <div key={t.id} className={`${styles.row} ${processingId === t.id ? styles.fading : ""}`}>
              <div className={styles.info}>
                <span className={styles.project}>{t._project_id?.toUpperCase()}</span>
                <span className={styles.name}>{t.name}</span>
              </div>
              
              <div className={styles.actions}>
                <button onClick={() => handleUpdate(t.id, "daily")} className={styles.btnRec}>Diária</button>
                <button onClick={() => handleUpdate(t.id, "weekdays")} className={styles.btnRec}>Dias Úteis</button>
                <button onClick={() => handleUpdate(t.id, "weekly")} className={styles.btnRec}>Semanal</button>
                <button onClick={() => handleUpdate(t.id, "monthly")} className={styles.btnRec}>Mensal</button>
                <button onClick={() => handleUpdate(t.id, "none")} className={styles.btnKeep}>Única</button>
              </div>
            </div>
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <Link href="/" className={styles.linkCancel}>Sair sem terminar</Link>
      </footer>
    </div>
  );
}
