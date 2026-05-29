import { PROJ, DAYS, MONTHS } from "../../config/constants";
import { getVcaBrand, getPdvClient, sortTasks, brt } from "../../utils/helpers";
import TaskRow from "./TaskRow";
import styles from "./TaskLists.module.css";

const VCA_AGENCY_ORDER = [
  { id: "6Xvp8v5F2PGPq2g2", label: "Gestão Interna",  color: "#5b9fd6" },
  { id: "6fCfcJvXv6MjF6Pq", label: "Ocupe",           color: "#06b6d4" },
  { id: "6ghvwpM3C9m8377R", label: "Carol Macarone",  color: "#ec4899" },
  { id: "6ghvxWFMgh5X3hHV", label: "Santé",           color: "#10b981" },
  { id: "6ghvxjQVHRmHW4wc", label: "Hive",            color: "#f59e0b" },
];
const VCA_AGENCY_IDS = new Set(VCA_AGENCY_ORDER.map(a => a.id));

export function Section({ proj, cfg, overdue, all, visible, overdueOnly, rowProps }) {
  const od    = overdue.filter(t => t.proj === proj).filter(visible);
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

export function VcaSection({ overdue, all, visible, overdueOnly, rowProps }) {
  const vcaToday = overdueOnly ? [] : all.filter(t => t.proj === "vca").filter(visible);
  const vcaOd    = overdue.filter(t => t.proj === "vca").filter(visible);
  if (!vcaToday.length && !vcaOd.length) return null;

  const total = vcaToday.length + vcaOd.length;

  return (
    <div id="section-vca" className={styles.section}>
      <div className={styles.secHead}>
        <div className={styles.secDot} style={{ background: PROJ.vca.cor }} />
        <span className={styles.secLabel} style={{ color: PROJ.vca.cor }}>{PROJ.vca.label}</span>
        <span className={styles.secCount}>{total}</span>
      </div>

      {VCA_AGENCY_ORDER.map(agency => {
        const odTasks    = sortTasks(vcaOd.filter(t => t.list?.id === agency.id));
        const todayTasks = sortTasks(vcaToday.filter(t => t.list?.id === agency.id));
        if (!odTasks.length && !todayTasks.length) return null;
        return (
          <div key={agency.id} className={styles.subSection}>
            <div className={styles.agencyHeader}>
              <div className={styles.agencyDot} style={{ background: agency.color }} />
              <span className={styles.agencyLabel} style={{ color: agency.color }}>{agency.label}</span>
              <span className={styles.agencyCount}>{odTasks.length + todayTasks.length}</span>
            </div>
            <div className={styles.taskList}>
              {odTasks.map(t    => <TaskRow key={t.id} t={t} od={true} {...rowProps} />)}
              {todayTasks.map(t => <TaskRow key={t.id} t={t} {...rowProps} />)}
            </div>
          </div>
        );
      })}

      {/* Tarefas de listas não mapeadas */}
      {(() => {
        const odOther    = sortTasks(vcaOd.filter(t => !VCA_AGENCY_IDS.has(t.list?.id)));
        const todayOther = sortTasks(vcaToday.filter(t => !VCA_AGENCY_IDS.has(t.list?.id)));
        if (!odOther.length && !todayOther.length) return null;
        return (
          <SubSection
            label="Outros"
            odTasks={odOther}
            todayTasks={todayOther}
            rowProps={rowProps}
          />
        );
      })()}
    </div>
  );
}

export function PdvSection({ overdue, all, visible, overdueOnly, rowProps, clients = [] }) {
  const pdvToday  = overdueOnly ? [] : all.filter(t => t.proj === "pdv").filter(visible);
  const pdvOd     = overdue.filter(t => t.proj === "pdv").filter(visible);
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
