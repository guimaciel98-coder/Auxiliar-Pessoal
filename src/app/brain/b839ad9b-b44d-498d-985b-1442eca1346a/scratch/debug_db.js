const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

// Manual .env.local parsing
const env = fs.readFileSync('.env.local', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL=(.*)/);
const DATABASE_URL = dbUrlMatch ? dbUrlMatch[1].trim().replace(/^["']|["']$/g, '') : null;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function debug() {
  console.log("--- DEBUG DB ---");
  const counts = await sql`SELECT status, count(*) FROM tasks GROUP BY status`;
  console.log("Counts by status:", JSON.stringify(counts, null, 2));

  const projects = await sql`SELECT project_id, count(*) FROM tasks GROUP BY project_id`;
  console.log("Counts by project:", JSON.stringify(projects, null, 2));

  const recs = await sql`SELECT recurrence, count(*) FROM tasks WHERE recurrence != 'none' GROUP BY recurrence`;
  console.log("Recurring tasks:", JSON.stringify(recs, null, 2));

  const subClients = await sql`SELECT count(*) FROM tasks WHERE sub_client_id IS NOT NULL`;
  console.log("Tasks with sub_client:", JSON.stringify(subClients, null, 2));

  const samples = await sql`SELECT title, status, project_id, recurrence, sub_client_id FROM tasks LIMIT 10`;
  console.log("Sample tasks:", JSON.stringify(samples, null, 2));
}

debug().catch(console.error);
