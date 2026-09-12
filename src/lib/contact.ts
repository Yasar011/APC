import { TripSettings } from "./types";

/**
 * Who a student should message with a question.
 *
 * The trip itinerary we were given carries the tour operator's own numbers
 * and Instagram handles. Those are deliberately not used anywhere: students
 * booking through APC should reach APC, not the operator, so the only
 * contact on this site is the club's.
 */
export const DEFAULT_CONTACT = {
  name: "Yasar CH",
  role: "APC President",
  phone: "8157980825",
};

/** India. Used to build the wa.me link, which needs the full number. */
const COUNTRY_CODE = "91";

/**
 * A WhatsApp link that opens a chat with the message already typed, so the
 * student only has to press send. Their name is filled in when we know it
 * and left as a blank to complete when we don't.
 */
export function whatsappHref(
  settings: Partial<TripSettings>,
  studentName?: string | null
) {
  const phone = (settings.contactPhone || DEFAULT_CONTACT.phone).replace(/\D/g, "");
  const number = phone.length > 10 ? phone : `${COUNTRY_CODE}${phone}`;

  const who = studentName?.trim() ? studentName.trim() : "______";
  const message = `Hey! I'm ${who} and I have a question about the APC Jawai trip:`;

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function contactName(settings: Partial<TripSettings>) {
  return settings.contactName || DEFAULT_CONTACT.name;
}

export function contactRole(settings: Partial<TripSettings>) {
  return settings.contactRole || DEFAULT_CONTACT.role;
}

export function contactPhone(settings: Partial<TripSettings>) {
  return settings.contactPhone || DEFAULT_CONTACT.phone;
}
