import Artwork from "@/components/art/Artwork";
import { ActionButton } from "@/components/admin/ActionButton";
import { H1 } from "@/components/admin/ui";
import { getDesign } from "@/lib/art";
import { prisma } from "@/lib/server/db";
import { toggleTemplateAction } from "../actions";

export default async function Templates() {
  const templates = await prisma.designTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <H1>Designs</H1>
      <p className="mb-6 max-w-3xl text-sm text-ink-soft">
        Designs are implemented in code (src/lib/art). Disabling one hides it from new carts and checkouts; existing orders keep their rendered files. Versions are bumped in code whenever a design&rsquo;s output changes.
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const d = getDesign(t.id);
          return (
            <div key={t.id} className="border-2 border-ink p-3">
              {d ? <Artwork designId={d.id} fields={d.sample} showQr={false} idPrefix={`tpl-${t.id}`} /> : <p className="text-[#7E2512]">Missing from code</p>}
              <p className="mt-2 font-bold">
                {t.name} · v{t.version} {t.active ? "" : "(hidden)"}
              </p>
              <p className="text-sm text-ink-soft">{d?.colorways.length ?? 0} colourways</p>
              <div className="mt-2">
                <ActionButton action={toggleTemplateAction.bind(null, t.id)} label={t.active ? "Hide" : "Show"} confirm={t.active ? "Hide this design from the studio?" : undefined} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
