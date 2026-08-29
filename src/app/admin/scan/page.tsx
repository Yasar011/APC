"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  CircleAlert,
  Droplet,
  Keyboard,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, CardBody, Field, Input } from "@/components/ui/primitives";
import {
  markBoarded,
  readTicket,
  readTicketsForBooking,
  resolveBookingCode,
} from "@/lib/trip";
import { Ticket } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type ScanResult =
  | { kind: "ok"; tickets: Ticket[]; alreadyBoarded: number }
  | { kind: "repeat"; ticket: Ticket }
  | { kind: "unknown"; code: string };

const READER_ID = "jawai-qr-reader";

export default function ScanPage() {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<Ticket[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const handlingRef = useRef(false);

  /**
   * A code is either a booking code (JW + 6, checks in the whole group) or a
   * ticket code (10 chars, one person). Both are single key lookups, which
   * is what keeps this usable on a weak signal at the bus.
   */
  const handleCode = useCallback(
    async (raw: string) => {
      if (!user || handlingRef.current) return;
      const code = raw.trim().toUpperCase();
      if (!code) return;

      handlingRef.current = true;
      setBusy(true);
      try {
        if (code.startsWith("JW")) {
          const bookingId = await resolveBookingCode(code);
          if (!bookingId) {
            setResult({ kind: "unknown", code });
            return;
          }
          const tickets = await readTicketsForBooking(bookingId);
          const pending = tickets.filter((ticket) => !ticket.boarded);
          await Promise.all(
            pending.map((ticket) => markBoarded(ticket.ticketCode, user.uid))
          );
          setResult({
            kind: "ok",
            tickets,
            alreadyBoarded: tickets.length - pending.length,
          });
          setHistory((current) => [...pending, ...current].slice(0, 30));
          if (pending.length > 0) {
            toast.success(`Checked in ${pending.length} of ${tickets.length}`);
          } else {
            toast.message("Everyone on this booking was already checked in.");
          }
          return;
        }

        const ticket = await readTicket(code);
        if (!ticket) {
          setResult({ kind: "unknown", code });
          toast.error("That code isn't a valid ticket.");
          return;
        }
        if (ticket.boarded) {
          setResult({ kind: "repeat", ticket });
          toast.message(`${ticket.name} already boarded.`);
          return;
        }
        await markBoarded(ticket.ticketCode, user.uid);
        const boardedTicket = { ...ticket, boarded: true, boardedAt: Date.now() };
        setResult({ kind: "ok", tickets: [boardedTicket], alreadyBoarded: 0 });
        setHistory((current) => [boardedTicket, ...current].slice(0, 30));
        toast.success(`${ticket.name} checked in`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Lookup failed — check the signal."
        );
      } finally {
        setBusy(false);
        // Brief cooldown so one QR held in front of the camera doesn't
        // re-fire dozens of times a second.
        setTimeout(() => {
          handlingRef.current = false;
        }, 1200);
      }
    },
    [user]
  );

  async function startCamera() {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded: string) => handleCode(decoded),
        () => {
          /* per-frame decode misses are normal — ignore */
        }
      );
      setScanning(true);
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : "Couldn't start the camera. Use manual entry below."
      );
    }
  }

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      /* already stopped */
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Bus check-in</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Scan a student&apos;s QR, or a booking QR to check in a whole group at once.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div id={READER_ID} className="overflow-hidden rounded-xl bg-neutral-900" />

            <div className="mt-4 flex gap-2">
              {scanning ? (
                <Button variant="outline" onClick={stopCamera} className="w-full">
                  <CameraOff className="h-4 w-4" />
                  Stop camera
                </Button>
              ) : (
                <Button onClick={startCamera} className="w-full">
                  <Camera className="h-4 w-4" />
                  Start camera
                </Button>
              )}
            </div>

            {cameraError && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {cameraError} Manual entry works fine — the code is printed under every QR.
              </p>
            )}

            <div className="mt-6 border-t border-neutral-200 pt-5">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCode(manualCode);
                  setManualCode("");
                }}
              >
                <Field
                  label="Or type the code"
                  hint="Always available — the bus may have no signal for the camera preview."
                >
                  <div className="flex gap-2">
                    <Input
                      value={manualCode}
                      onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                      placeholder="ABCD234XYZ"
                      className="font-mono uppercase tracking-widest"
                    />
                    <Button type="submit" variant="outline" loading={busy}>
                      <Keyboard className="h-4 w-4" />
                      Check in
                    </Button>
                  </div>
                </Field>
              </form>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          {result && <ResultCard result={result} />}

          {history.length > 0 && (
            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Checked in this session ({history.length})
                </h2>
                <ul className="mt-3 divide-y divide-neutral-100">
                  {history.map((ticket) => (
                    <li
                      key={ticket.ticketCode}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="text-neutral-800">{ticket.name}</span>
                      <span className="text-xs text-neutral-400">
                        {formatDateTime(ticket.boardedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: ScanResult }) {
  if (result.kind === "unknown") {
    return (
      <Card className="border-red-200">
        <CardBody className="flex gap-3">
          <CircleAlert className="h-6 w-6 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">Not a valid code</p>
            <p className="mt-1 font-mono text-xs text-neutral-500">{result.code}</p>
            <p className="mt-2 text-sm text-neutral-600">
              Check they&apos;re showing a confirmed ticket, not a booking that&apos;s still
              awaiting approval.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (result.kind === "repeat") {
    return (
      <Card className="border-amber-300">
        <CardBody>
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <CircleAlert className="h-5 w-5" />
            Already boarded
          </p>
          <p className="mt-2 text-lg font-semibold text-neutral-900">{result.ticket.name}</p>
          <p className="text-sm text-neutral-500">
            Checked in at {formatDateTime(result.ticket.boardedAt)}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-300">
      <CardBody>
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <Check className="h-5 w-5" />
          Checked in
          {result.tickets.length > 1 && (
            <span className="inline-flex items-center gap-1 text-neutral-500">
              <Users className="h-3.5 w-3.5" />
              {result.tickets.length} on this booking
              {result.alreadyBoarded > 0 && ` (${result.alreadyBoarded} already aboard)`}
            </span>
          )}
        </p>

        <div className="mt-4 space-y-4">
          {result.tickets.map((ticket) => (
            <div
              key={ticket.ticketCode}
              className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-neutral-900">{ticket.name}</p>
                  <p className="text-xs text-neutral-500">
                    {ticket.niftId} &middot; {ticket.phone}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                  <Droplet className="h-3 w-3" />
                  {ticket.bloodGroup}
                </span>
              </div>

              {(ticket.medicalConditions || ticket.allergies) && (
                <div className="mt-3 rounded-lg bg-white p-3 text-xs">
                  {ticket.medicalConditions && (
                    <p className="text-neutral-700">
                      <span className="text-neutral-500">Conditions: </span>
                      {ticket.medicalConditions}
                    </p>
                  )}
                  {ticket.allergies && (
                    <p className="mt-1 text-neutral-700">
                      <span className="text-neutral-500">Allergies: </span>
                      {ticket.allergies}
                    </p>
                  )}
                </div>
              )}

              <p className="mt-2 text-xs text-neutral-500">
                Emergency: {ticket.emergencyContactName} — {ticket.emergencyContactPhone}
              </p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
