"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { BLOOD_GROUPS, GENDERS } from "@/lib/constants";
import { Traveller } from "@/lib/types";

export function emptyTraveller(): Traveller {
  return {
    name: "",
    phone: "",
    niftId: "",
    programme: "",
    semester: "",
    age: "",
    gender: "",
    bloodGroup: "",
    medicalConditions: "",
    allergies: "",
    medications: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
  };
}

/**
 * The details for one person on the trip.
 *
 * The medical block is required, not optional: the whole reason it is
 * collected is that the trip leads need it on the bus, hours from campus,
 * at the moment something goes wrong. "None" is a perfectly good answer to
 * the free-text fields, but they can't be skipped silently.
 */
export function TravellerForm({
  index,
  traveller,
  onChange,
  isBooker,
}: {
  index: number;
  traveller: Traveller;
  onChange: (next: Traveller) => void;
  isBooker: boolean;
}) {
  function set<K extends keyof Traveller>(key: K, value: Traveller[K]) {
    onChange({ ...traveller, [key]: value });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-neutral-950">
          {index + 1}
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">
          {isBooker ? "You" : `Traveller ${index + 1}`}
        </h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input
            value={traveller.name}
            onChange={(event) => set("name", event.target.value)}
            required
            placeholder="As on their photo ID"
          />
        </Field>

        <Field label="Phone" required>
          <Input
            type="tel"
            inputMode="numeric"
            value={traveller.phone}
            onChange={(event) => set("phone", event.target.value)}
            required
            placeholder="10-digit mobile"
          />
        </Field>

        <Field label="NIFT ID" required>
          <Input
            value={traveller.niftId}
            onChange={(event) => set("niftId", event.target.value)}
            required
          />
        </Field>

        <Field label="Programme" required>
          <Input
            value={traveller.programme}
            onChange={(event) => set("programme", event.target.value)}
            required
            placeholder="e.g. BDes Fashion Design"
          />
        </Field>

        <Field label="Semester" required>
          <Input
            value={traveller.semester}
            onChange={(event) => set("semester", event.target.value)}
            required
          />
        </Field>

        <Field label="Age" required>
          <Input
            type="number"
            min={15}
            max={80}
            value={traveller.age}
            onChange={(event) => set("age", event.target.value)}
            required
          />
        </Field>

        <Field label="Gender" required>
          <Select
            value={traveller.gender}
            onChange={(event) => set("gender", event.target.value)}
            required
          >
            <option value="">Select</option>
            {GENDERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Blood group" required>
          <Select
            value={traveller.bloodGroup}
            onChange={(event) => set("bloodGroup", event.target.value)}
            required
          >
            <option value="">Select</option>
            {BLOOD_GROUPS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
          Medical &amp; emergency
        </p>
        <p className="mt-1 text-xs text-amber-900/70">
          Carried by the trip leads on the bus. Write &ldquo;None&rdquo; if there&apos;s
          nothing to declare.
        </p>

        <div className="mt-4 grid gap-4">
          <Field label="Medical conditions" required>
            <Textarea
              rows={2}
              value={traveller.medicalConditions}
              onChange={(event) => set("medicalConditions", event.target.value)}
              required
              placeholder="Asthma, diabetes, epilepsy, recent surgery, motion sickness... or None"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Allergies" required>
              <Input
                value={traveller.allergies}
                onChange={(event) => set("allergies", event.target.value)}
                required
                placeholder="Food, medicine, insect stings... or None"
              />
            </Field>

            <Field label="Regular medication" required>
              <Input
                value={traveller.medications}
                onChange={(event) => set("medications", event.target.value)}
                required
                placeholder="Anything taken daily, or None"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Emergency contact" required>
              <Input
                value={traveller.emergencyContactName}
                onChange={(event) => set("emergencyContactName", event.target.value)}
                required
                placeholder="Parent or guardian"
              />
            </Field>

            <Field label="Their phone" required>
              <Input
                type="tel"
                inputMode="numeric"
                value={traveller.emergencyContactPhone}
                onChange={(event) => set("emergencyContactPhone", event.target.value)}
                required
              />
            </Field>

            <Field label="Relation" required>
              <Input
                value={traveller.emergencyContactRelation}
                onChange={(event) => set("emergencyContactRelation", event.target.value)}
                required
                placeholder="Mother, father, sibling"
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
