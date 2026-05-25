import { fetchProjectSections } from "@/lib/todoist";
import { PROJ } from "@/config/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vcaIds = [PROJ.vca.id, ...(PROJ.vca.extraIds ?? [])];
    const pdvIds = [PROJ.pdv.id, ...(PROJ.pdv.extraIds ?? [])];

    const [vcaSectionsByProject, pdvSections] = await Promise.all([
      Promise.all(vcaIds.map(id => fetchProjectSections(id).catch(() => []).then(secs => secs.map(s => ({ ...s, _sourceProjectId: id }))))),
      Promise.all(pdvIds.map(id => fetchProjectSections(id).catch(() => []))).then(arrs => arrs.flat()),
    ]);

    const clients = [
      ...vcaSectionsByProject.flat().map(s => ({ id: s.id, name: s.name, project_id: "vca", cf_value: s.id, source_project_id: s._sourceProjectId })),
      ...pdvSections.map(s => ({ id: s.id, name: s.name, project_id: "pdv", cf_value: s.id })),
    ];

    return Response.json(clients);
  } catch (e) {
    console.error("[GET /api/clients]", e);
    return Response.json([], { status: 500 });
  }
}
