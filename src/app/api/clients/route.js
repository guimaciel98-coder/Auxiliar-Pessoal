import { fetchProjectSections } from "@/lib/todoist";
import { PROJ } from "@/config/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vcaIds = [PROJ.vca.id, ...(PROJ.vca.extraIds ?? [])];
    const pdvIds = [PROJ.pdv.id, ...(PROJ.pdv.extraIds ?? [])];

    const [vcaSections, pdvSections] = await Promise.all([
      Promise.all(vcaIds.map(id => fetchProjectSections(id).catch(() => []))).then(arrs => arrs.flat()),
      Promise.all(pdvIds.map(id => fetchProjectSections(id).catch(() => []))).then(arrs => arrs.flat()),
    ]);

    const clients = [
      ...vcaSections.map(s => ({ id: s.id, name: s.name, project_id: "vca", cf_value: s.id })),
      ...pdvSections.map(s => ({ id: s.id, name: s.name, project_id: "pdv", cf_value: s.id })),
    ];

    return Response.json(clients);
  } catch (e) {
    console.error("[GET /api/clients]", e);
    return Response.json([], { status: 500 });
  }
}
