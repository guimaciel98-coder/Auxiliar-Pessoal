import { PROJ, DAYS, MONTHS } from "../../config/constants";
import { getVcaBrand, getPdvClient, sortTasks, brt } from "../../utils/helpers";
import TaskRow from "./TaskRow";
import styles from "./TaskLists.module.css";

export function Section({ proj, cfg, overdue, all, visible, overdueOnly, rowProps }) {
  const od    = overdue.filter(t => t.proj === proj);
  const today = overdueOnly ? [] : sortTasks(all.filter(t => t.proj === proj).filter(visible));
  const tasks = [...od, ...today];
  if (!tasks.length) return null;
  return (
    <div id={`section-${proj}`} className={styles.section}>
      <div className={styles.secHead}>
        <div className={styles.secDot} style={{ background: cfg.cor }} />
        <span className={styles.secLabel} style={{ color: cfg.cor }}>{cfg.label}</span>
        <span className={styles.secCount}>{tasks.length}</span>
      </div>
      <div className={styles.taskList}>
        {od.map(t => <TaskRow key={t.id} t={t} od={true} {...rowProps} />)}
        {today.map(t => <TaskRow key={t.id} t={t} {...rowProps} />)}
      </div>
    </div>
  );
}

function SubSection({ label, odTasks, todayTasks, rowProps }) {
  if (!odTasks.length && !todayTasks.length) return null;
  return (
    <div className={styles.subSection}>
      <div className={styles.clientHeader}>
        <div className={styles.clientLabel}>{label}</div>
      </div>
      <div className={styles.taskList}>
        {odTasks.map(t   => <TaskRow key={t.id} t={t} od={true} {...rowProps} />)}
        {todayTasks.map(t => <TaskRow key={t.id} t={t} {...rowProps} />)}
      </div>
    </div>
  );
}

export function VcaSection({ overdue, all, visible, overdueOnly, rowProps, clients = [] }) {
  const vcaToday = overdueOnly ? [] : all.filter(t => t.proj === "vca").filter(visible);
  const vcaOd    = overdue.filter(t => t.proj === "vca");
  if (!vcaToday.length && !vcaOd.length) return null;

  const total     = vcaToday.length + vcaOd.length;
  const vcaBrands = clients.filter(c => c.project_id === "vca");

  return (
    <div id="section-vca" className={styles.section}>
      <div className={styles.secHead}>
        <div className={styles.secDot} style={{ background: PROJ.vca.cor }} />
        <span className={styles.secLabel} style={{ color: PROJ.vca.cor }}>{PROJ.vca.label}</span>
        <span className={styles.secCount}>{total}</span>
      </div>

      {/* Tarefas com seção definida */}
      {vcaBrands.map(b => (
        <SubSection
          key={b.id}
          label={b.name}
          odTasks={sortTasks(vcaOd.filter(t => getVcaBrand(t) === b.cf_value))}
          todayTasks={sortTasks(vcaToday.filter(t => getVcaBrand(t) === b.cf_value))}
          rowProps={rowProps}
        />
      ))}

      {/* FIX: tarefas sem seção não sumiam mais — aparecem em "Geral" */}
      <SubSection
        label="Geral"
        odTasks={sortTasks(vcaOd.filter(t => !getVcaBrand(t)))}
        todayTasks={sortTasks(vcaToday.filter(t => !getVcaBrand(t)))}
        rowProps={rowProps}
      />
    </div>
  );
}

export function PdvSection({ overdue, all, visible, overdueOnly, rowProps, clients = [] }) {
  const pdvToday  = overdueOnly ? [] : all.filter(t => t.proj === "pdv").filter(visible);
  const pdvOd     = overdue.filter(t => t.proj === "pdv");
  if (!pdvToday.length && !pdvOd.length) return null;

  const total      = pdvToday.length + pdvOd.length;
  const pdvClients = clients.filter(c => c.project_id === "pdv");

  return (
    <div id="section-pdv" className={styles.section}>
      <div className={styles.secHead}>
        <div className={styles.secDot} style={{ background: PROJ.pdv.cor }} />
        <span className={styles.secLabel} style={{ color: PROJ.pdv.cor }}>{PROJ.pdv.label}</span>
        <span className={styles.secCount}>{total}</span>
      </div>

      {pdvClients.map(c => (
        <SubSection
          key={c.id}
          label={c.name}
          odTasks={sortTasks(pdvOd.filter(t => getPdvClient(t) === c.cf_value))}
          todayTasks={sortTasks(pdvToday.filter(t => getPdvClient(t) === c.cf_value))}
          rowProps={rowProps}
        />
      ))}

      {/* Tarefas sem cliente definido */}
      <SubSection
        label="Geral"
        odTasks={sortTasks(pdvOd.filter(t => !getPdvClient(t)))}
        todayTasks={sortTasks(pdvToday.filter(t => !getPdvClient(t)))}
        rowProps={rowProps}
      />
    </div>
  );
}

export function WeekView({ all, visible, rowProps }) {
  const grouped = {};
  all.filter(visible).forEach(t => {
    const d     = brt(t.ts);
    const key   = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const label = `${DAYS[d.getUTCDay()]} — ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
    if (!grouped[key]) grouped[key] = { label, tasks: [] };
    grouped[key].tasks.push(t);
  });

  const hasTasks = Object.keys(grouped).length > 0;
  return (
    <div>
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([key, { label, tasks }]) => (
        <div key={key} className={styles.weekSection}>
          <div className={styles.weekDay}>{label}</div>
          <div className={styles.taskList}>
            {["pessoal", "vca", "pdv"].map(p =>
              sortTasks(tasks.filter(t => t.proj === p)).map(t => <TaskRow key={t.id} t={t} showContext={true} {...rowProps} />)
            )}
            {sortTasks(tasks.filter(t => !["pessoal","vca","pdv"].includes(t.proj))).map(t =>
              <TaskRow key={t.id} t={t} showContext={true} {...rowProps} />
            )}
          </div>
        </div>
      ))}
      {!hasTasks && <div className={styles.emptyState}>nenhuma tarefa nos próximos 7 dias</div>}
    </div>
  );
}
