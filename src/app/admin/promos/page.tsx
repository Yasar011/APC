"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FullPageSpinner,
  Input,
  Modal,
  Select,
} from "@/components/ui/primitives";
import { deletePromo, listPromos, readSettings, savePromo } from "@/lib/trip";
import { isValidKey, normalisePromoCode } from "@/lib/codes";
import { quote } from "@/lib/pricing";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { PromoCode, PromoType, TripSettings } from "@/lib/types";
import { formatDate, rupees } from "@/lib/utils";

const EMPTY = {
  code: "",
  type: "FLAT" as PromoType,
  value: 100,
  maxUses: 0,
  expiresAt: "",
};

export default function PromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [codes, tripSettings] = await Promise.all([listPromos(), readSettings()]);
      setPromos(codes);
      setSettings(tripSettings);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load promo codes."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const code = normalisePromoCode(form.code);
    if (!isValidKey(code)) {
      toast.error("Use letters and numbers only — no spaces, dots or slashes.");
      return;
    }
    if (promos.some((promo) => promo.code === code)) {
      toast.error("That code already exists.");
      return;
    }
    if (form.value <= 0) {
      toast.error("The discount has to be more than zero.");
      return;
    }

    setSaving(true);
    try {
      await savePromo({
        code,
        type: form.type,
        value: form.value,
        maxUses: Math.max(0, form.maxUses),
        usedCount: 0,
        active: true,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).getTime() : null,
        createdAt: Date.now(),
      });
      toast.success(`${code} created`);
      setForm(EMPTY);
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that code.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: PromoCode) {
    try {
      await savePromo({ ...promo, active: !promo.active });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update that code.");
    }
  }

  async function remove(promo: PromoCode) {
    if (!confirm(`Delete ${promo.code}? Bookings that already used it are unaffected.`)) {
      return;
    }
    try {
      await deletePromo(promo.code);
      toast.success(`${promo.code} deleted`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that code.");
    }
  }

  if (loading) return <FullPageSpinner />;

  if (loadError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Couldn't load promo codes"
        description={loadError}
        action={<Button onClick={load}>Try again</Button>}
      />
    );
  }

  // What this code is actually worth on a full group, next to the group
  // discount it competes with - they never stack.
  const groupDiscount = settings.groupDiscountAmount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Promo codes</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Students get the bigger of their promo and the {rupees(groupDiscount)} group
            discount — never both.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New code
        </Button>
      </div>

      {promos.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No promo codes yet"
          description="Create one to hand out. Codes can't be listed by students — they only work if you give them out."
          action={<Button onClick={() => setOpen(true)}>Create a code</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">On 5 seats</th>
                  <th className="px-4 py-3">Used</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {promos.map((promo) => {
                  const onFullGroup = quote(settings.groupSize, settings, promo);
                  return (
                    <tr key={promo.code} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-mono font-semibold">{promo.code}</td>
                      <td className="px-4 py-3">
                        {promo.type === "FLAT"
                          ? rupees(promo.value)
                          : `${promo.value}%`}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {onFullGroup.discountApplied === "PROMO" ? (
                          <span className="text-emerald-700">
                            wins — {rupees(onFullGroup.promoDiscount)} off
                          </span>
                        ) : (
                          <span className="text-neutral-400">
                            group discount wins ({rupees(onFullGroup.groupDiscount)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {promo.usedCount}
                        {promo.maxUses > 0 ? ` / ${promo.maxUses}` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {promo.expiresAt ? formatDate(promo.expiresAt) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            promo.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-neutral-200 text-neutral-600"
                          }
                        >
                          {promo.active ? "Active" : "Paused"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleActive(promo)}
                            className="text-xs font-medium text-amber-700 hover:underline"
                          >
                            {promo.active ? "Pause" : "Activate"}
                          </button>
                          <button
                            onClick={() => remove(promo)}
                            className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Delete ${promo.code}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New promo code">
        <div className="space-y-4">
          <Field label="Code" required hint="Letters and numbers only. Case doesn't matter.">
            <Input
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              placeholder="APCEARLY"
              className="font-mono uppercase"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" required>
              <Select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as PromoType })
                }
              >
                <option value="FLAT">Flat amount off</option>
                <option value="PERCENT">Percentage off</option>
              </Select>
            </Field>

            <Field label={form.type === "FLAT" ? "Amount off" : "Percent off"} required>
              <Input
                type="number"
                min={1}
                value={form.value}
                onChange={(event) =>
                  setForm({ ...form, value: Number(event.target.value) })
                }
              />
            </Field>

            <Field label="Max uses" hint="0 means unlimited.">
              <Input
                type="number"
                min={0}
                value={form.maxUses}
                onChange={(event) =>
                  setForm({ ...form, maxUses: Number(event.target.value) })
                }
              />
            </Field>

            <Field label="Expires" hint="Optional.">
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
              />
            </Field>
          </div>

          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            On a full group of {settings.groupSize} this would take{" "}
            {rupees(
              quote(settings.groupSize, settings, {
                code: "PREVIEW",
                type: form.type,
                value: form.value,
                maxUses: 0,
                usedCount: 0,
                active: true,
                expiresAt: null,
                createdAt: 0,
              }).promoDiscount
            )}{" "}
            off, against the {rupees(groupDiscount)} group discount. The bigger one applies.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={create} loading={saving} disabled={!form.code.trim()}>
            Create code
          </Button>
        </div>
      </Modal>
    </div>
  );
}
