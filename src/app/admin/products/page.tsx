import { prisma } from "@/lib/server/db";
import { ConfirmForm } from "@/components/admin/ActionButton";
import { H1 } from "@/components/admin/ui";
import { updateVariantAction } from "../actions";

export default async function Products() {
  const variants = await prisma.productVariant.findMany({ orderBy: { sortOrder: "asc" }, include: { product: true } });
  const input = "mt-1 h-9 w-full border-2 border-ink px-2";
  return (
    <div>
      <H1>Products &amp; prices</H1>
      <p className="mb-6 max-w-3xl text-sm text-ink-soft">
        Prices are authoritative here: the studio, cart and checkout read them live. Provider SKUs must match the print lab&rsquo;s catalogue exactly (check each in the Prodigi dashboard before launch). Lead times drive the delivery estimates shown to customers.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {variants.map((v) => (
          <ConfirmForm key={v.id} action={updateVariantAction.bind(null, v.id)} title={`${v.label} (${v.sku})`} submitLabel="Save" tone="default">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label>
                Price (USD)
                <input name="price" defaultValue={(v.priceCents / 100).toFixed(2)} inputMode="decimal" className={input} />
              </label>
              <label>
                Provider SKU
                <input name="sku" defaultValue={v.fulfillmentSku} className={input} />
              </label>
              <label>
                Lead min (days)
                <input name="leadMin" type="number" defaultValue={v.leadTimeMinDays} className={input} />
              </label>
              <label>
                Lead max (days)
                <input name="leadMax" type="number" defaultValue={v.leadTimeMaxDays} className={input} />
              </label>
              <label>
                Bleed (in)
                <input name="bleed" defaultValue={Number(v.bleedIn)} inputMode="decimal" className={input} />
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input type="checkbox" name="active" defaultChecked={v.active} /> Active
              </label>
            </div>
            <p className="text-xs text-ink-soft">
              {Number(v.widthIn)}×{Number(v.heightIn)}in · {v.printDpi} DPI · frames: {v.frameFinishes.join(", ") || "—"}
            </p>
          </ConfirmForm>
        ))}
      </div>
    </div>
  );
}
