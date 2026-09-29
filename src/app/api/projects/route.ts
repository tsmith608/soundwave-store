import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { assertSameOrigin, clientIp, parseJson, route } from "@/lib/server/http";
import { ProjectInput, projectDto, saveProject } from "@/lib/server/projects";
import { rateLimit } from "@/lib/server/rateLimit";

/** Creates a project (autosave from the studio once a recording is attached). */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await rateLimit("project", clientIp(req));
  const input = await parseJson(req, ProjectInput);
  const project = await saveProject(await getOwner(), input);
  return NextResponse.json({ project: projectDto(project) });
});
