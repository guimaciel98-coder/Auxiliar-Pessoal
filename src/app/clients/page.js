"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./Clients.module.css";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: "", project_id: "vca", cf_value: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/clients");
    const json = await r.json();
    setClients(json);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        cf_value: parseInt(formData.cf_value)
      })
    });
    if (res.ok) {
      setFormData({ name: "", project_id: "vca", cf_value: "" });
      load();
    }
  }

  async function handleDelete(id) {
    if (!confirm("Excluir cliente?")) return;
    await fetch("/api/clients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    load();
  }

  const vcaCount = clients.filter(c => c.project_id === "vca").length;
  const pdvCount = clients.filter(c => c.project_id === "pdv").length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backBtn}>← Voltar</Link>
        <h1>Gestão de Negócios</h1>
      </header>

      <div className={styles.statsRow}>
        <div className={styles.statBox}>
          <span className={styles.statVal}>{vcaCount}</span>
          <span className={styles.statLab}>Marcas VCA</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statVal}>{pdvCount}</span>
          <span className={styles.statLab}>Clientes PDV</span>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.formSection}>
          <h2>Novo Cadastro</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>NOME COMERCIAL</label>
              <input 
                placeholder="Ex: Reserva, Coca-Cola..."
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                required 
              />
            </div>
            <div className={styles.field}>
              <label>PROJETO ORIGEM</label>
              <select 
                value={formData.project_id} 
                onChange={e => setFormData({...formData, project_id: e.target.value})}
              >
                <option value="vca">VCA Brasil (Marcas)</option>
                <option value="pdv">Ponto de Vista (Clientes)</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>VALOR (ID numérico do campo nativo)</label>
              <input 
                type="number" 
                value={formData.cf_value} 
                onChange={e => setFormData({...formData, cf_value: e.target.value})} 
                required 
              />
            </div>
            <button type="submit" className={styles.submitBtn}>Salvar Alterações</button>
          </form>
        </section>

        <section className={styles.listSection}>
          <div className={styles.listHead}>
            <h2>Gerenciar Marcas & Clientes</h2>
            <div className={styles.searchWrap}>
              {/* Espaço para filtro futuro */}
            </div>
          </div>
          
          {loading ? <div className={styles.loading}>Sincronizando...</div> : (
            <div className={styles.list}>
              {clients.map(c => (
                <div key={c.id} className={`${styles.card} ${c.project_id === 'vca' ? styles.cardVca : styles.cardPdv}`}>
                  <div className={styles.cardProjectDot} />
                  <div className={styles.cardInfo}>
                    <strong>{c.name}</strong>
                    <span>{c.project_id === 'vca' ? 'MARCA VCA' : 'CLIENTE PDV'} • ID: {c.cf_value}</span>
                  </div>
                  <button onClick={() => handleDelete(c.id)} className={styles.deleteBtn}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
