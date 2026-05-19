import { PROJ } from "@/config/constants";

export const dynamic = "force-dynamic";

function apiKey() {
  return process.env.TODOIST_API_KEY ?? "";
}

async function fetchPage(url) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) return { status: res.status, results: [], next_cursor: null };
  const json = await res.json();
  return { status: res.status, results: json.results ?? [], next_cursor: json.next_cursor ?? null };
}

export async function GET() {
  const allIds = Object.values(PROJ).flatMap(cfg => [cfg.id, ...(cfg.extraIds ?? [])]);
  const base = "https://api.todoist.com/api/v1";

  // Para cada projeto, busca até 2 páginas (400 tasks) procurando checked:true
  const projectResults = await Promise.all(allIds.map(async (pid) => {
    let cursor = null;
    let page = 0;
    let totalFetched = 0;
    let checkedTrue = [];
    let checkedFalse = 0;

    do {
      const p = new URLSearchParams({ project_id: pid, limit: "200" });
      if (cursor) p.set("cursor", cursor);
      const { results, next_cursor } = await fetchPage(`${base}/tasks?${p}`);
      totalFetched += results.length;
      for (const item of results) {
        if (item.checked === true) checkedTrue.push({ id: item.id, content: item.content?.slice(0,30), completed_at: item.completed_at });
        else checkedFalse++;
      }
      cursor = next_cursor;
      page++;
    } while (cursor && page < 2);

    return { pid, totalFetched, checkedTrue: checkedTrue.length, checkedFalseCount: checkedFalse, sampleCompleted: checkedTrue.slice(0,2) };
  }));

  return Response.json({ projects: projectResults });
}
