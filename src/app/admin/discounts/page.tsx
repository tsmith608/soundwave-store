import { prisma } from "@/lib/server/db";
import { ActionButton, ConfirmForm } from "@/components/admin/ActionButton";
import { Badge, H1, money, Table, when } from "@/components/admin/ui";
import { describeDiscount } from "@/lib/commerce";
import { saveDiscountAction, toggleDiscountAction } from "../actions";

export default async function Discounts() {
  const [discounts, variants] = await Promise.all([prisma.discount.findMany({ orderBy: { createdAt: "desc" } }), prisma.productVariant.findMany({ orderBy: { sortOrder: "asc" } })]);
  const input = "mt-1 h-9 w-full border-2 border-ink px-2";
  return (
    <div>
      <H1>Discounts</H1>
      <Table
        head={["Code", "Offer", "Min spend", "Window", "Used", "Limits", "Status", ""]}
        empty="No discount codes yet."
        rows={discounts.map((d) => [
          <strong key="c">{d.code}</strong>,
          describeDiscount(d),
          d.minSubtotalCents ? money(d.minSubtotalCents) : "—",
          `${d.startsAt ? when(d.startsAt) : "any"} → ${d.endsAt ? when(d.endsAt) : "open"}`,
          d.timesRedeemed,
          `${d.maxRedemptions ?? "∞"} total · ${d.maxPerCustomer ?? "∞"}/customer${d.variantIds.length ? ` · ${d.variantIds.length} variants` : ""}`,
          <Badge key="s">{d.active ? "active" : "off"}</Badge>,
          <ActionButton key="t" action={toggleDiscountAction.bind(null, d.id)} label={d.active ? "Deactivate" : "Activate"} />,
        ])}
      />
      <div className="mt-8 max-w-2xl">
        <ConfirmForm action={saveDiscountAction} title="Create or update a code (same code = update)" submitLabel="Save code" tone="default">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label>
              Code
              <input name="code" required className={`${input} uppercase`} />
            </label>
            <label>
              Type
              <select name="type" className={input}>
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off (USD)</option>
                <option value="free_shipping">Free shipping</option>
              </select>
            </label>
            <label>
              Value (% or USD)
              <input name="value" inputMode="decimal" className={input} />
            </label>
            <label>
              Minimum spend (USD)
              <input name="minSubtotal" inputMode="decimal" className={input} />
            </label>
            <label>
              Starts
              <input name="startsAt" type="datetime-local" className={input} />
            </label>
            <label>
              Ends
              <input name="endsAt" type="datetime-local" className={input} />
            </label>
            <label>
              Max uses (total)
              <input name="maxRedemptions" type="number" min="1" className={input} />
            </label>
            <label>
              Max uses per customer
              <input name="maxPerCustomer" type="number" min="1" className={input} />
            </label>
            <label className="col-span-2">
              Description (internal)
              <input name="description" className={input} />
            </label>
            <fieldset className="col-span-2">
              <legend>Only for these products (leave all unticked for everything)</legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {variants.map((v) => (
                  <label key={v.id} className="flex items-center gap-1">
                    <input type="checkbox" name="variantIds" value={v.id} /> {v.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked /> Active
            </label>
          </div>
        </ConfirmForm>
      </div>
    </div>
  );
}
