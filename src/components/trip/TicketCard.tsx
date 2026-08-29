"use client";

import { useEffect, useState } from "react";
import { Check, Droplet } from "lucide-react";
import { Ticket } from "@/lib/types";
import { qrDataUrl } from "@/lib/qr";

/**
 * One traveller's boarding pass.
 *
 * The QR encodes only the ticket code — the code is the database key, so a
 * scan is a single lookup, and the QR itself leaks nothing about the person
 * if someone photographs it over their shoulder.
 */
export function TicketCard({ ticket }: { ticket: Ticket }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    qrDataUrl(ticket.ticketCode, 260)
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        // A missing QR is recoverable — the code below it can be typed in.
        if (active) setQr(null);
      });
    return () => {
      active = false;
    };
  }, [ticket.ticketCode]);

  return (
    <div className="print-break overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-dashed border-neutral-200 px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{ticket.name}</p>
          <p className="text-xs text-neutral-500">
            {ticket.niftId} &middot; {ticket.bookingCode}
          </p>
        </div>
        {ticket.boarded ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            <Check className="h-3 w-3" />
            Boarded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
            <Droplet className="h-3 w-3" />
            {ticket.bloodGroup}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center px-5 py-6">
        {qr ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={qr}
            alt={`Boarding QR for ${ticket.name}`}
            className="h-40 w-40 sm:h-48 sm:w-48"
          />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400 sm:h-48 sm:w-48">
            QR unavailable
          </div>
        )}

        <p className="mt-4 font-mono text-lg font-semibold tracking-[0.2em] text-neutral-900">
          {ticket.ticketCode}
        </p>
        <p className="mt-1 text-center text-xs text-neutral-500">
          Show this at the bus. If the scanner won&apos;t read it, read out the code.
        </p>
      </div>
    </div>
  );
}
