# Jawai Safari — APC Club

Booking site for the APC Club's adventure trip to Jawai, NIFT Jodhpur.

A one-day trip, **Jodhpur → Jadan Om Temple → Jawai → Jodhpur**. Out at 8:00 AM, back by
12:30 AM. AC bus, lunch, dinner, the temple visit, Jawai Dam, the jeep safari and music are
all in the price.

> **Contacts.** The tour operator's itinerary carries their own phone number and Instagram
> handles. None of them appear on this site, deliberately — students booking through APC
> reach APC. The only contact is the club's, set in Trip settings and defaulting to
> Yasar CH, APC President.

**One seat per NIFT ID.** A student fills in their details, blood group, medical conditions
and emergency contact, pays by UPI, and gets a QR ticket once an admin verifies the payment.
On trip day the QR is scanned at the bus.

Built with Next.js 16 (App Router), TypeScript, Tailwind v4, and **APC's existing Firebase
project** — the same Auth accounts and the same Realtime Database as movie night.

---

## ⚠️ Read this before touching the database rules

Realtime Database rules are **one JSON tree for the entire database**. Publishing a file
that contains only this app's rules would **delete the rules protecting APC's movie night
and attractions data**.

That is why this repo ships `database.rules.snippet.json` and not a complete
`database.rules.json`. Follow the install steps below — do not `firebase deploy
--only database` with a file that has only the `jawaiTrip` block in it.

Everything this app reads or writes lives under a single key, **`jawaiTrip`**. No existing
APC data is read, written, or moved.

---

## Setup

### 1. Run it

```bash
npm install
npm run dev
```

That's the whole step. APC's Firebase config (project `apc-movie`) is committed in
`src/lib/firebase.ts`, so there is no `.env.local` to create and nothing to configure on
Vercel.

A Firebase web config is deliberately not a secret — it is compiled into the JavaScript
every visitor downloads, so anyone who opens the site can already read it. The database and
storage rules below are what actually protect the data.

To point at a different Firebase project (a throwaway one for testing), copy `.env.example`
to `.env.local` and set the values there; environment variables override the committed
defaults.

### 2. Database rules

1. Open **Firebase Console → Realtime Database → Rules**.
2. Open `database.rules.snippet.json` from this repo.
3. Copy the `"jawaiTrip": { ... }` block and paste it **inside your existing top-level
   `"rules"` object**, as a sibling of `roles`, `settings`, `promoCodes`, `movieSeats` and
   `bookings`. Don't delete anything.
4. Drop the `___README___` key — it's documentation, not a rule.
5. **Publish**, then open the movie night app and confirm it still works.

`database.rules.MERGED-EXAMPLE.json` is the whole file already merged, as a reference for
what the result should look like. `jawaiTrip` is the only key added; nothing else differs.

Note the nesting: `jawaiTrip/settings`, `jawaiTrip/bookings` and `jawaiTrip/promoCodes` are
separate from the top-level `settings`, `bookings` and `promoCodes` that movie night uses.
Same names, different places, no collision.

### 3. Admins — nothing to do

This app reuses APC's **existing top-level `roles` node**, the same one movie night uses,
rather than keeping a second list. Whoever is already `roles/<uid>` = `"admin"` (or the
founding uid hardcoded in the rules) is a trip admin the moment the rules go live.

`roles/<uid>` = `"staff"` gets the **bus scanner and nothing else** — the same job staff
already do checking people in on movie night. Staff never see payments, the roster, or the
margin.

To add someone, set their role in **Firebase Console → Realtime Database → Data → `roles`**,
exactly as you would for movie night. `/admin` prints the signed-in account's uid if you
need it.

> The founding uid is mirrored in `src/lib/constants.ts` as `FOUNDER_ADMIN_UID` so the UI
> agrees with the rules. If it ever changes in the rules, change it there too.

### 4. Trip settings

Sign in as an admin, open `/admin`, click **Trip settings**, and fill in dates, price, total
seats, **UPI accounts** and trip lead contact. The **Cost and profit** section there holds
the admin-only ₹2000 figure. The public page reads the rest live.

---

## How it works

### Pricing

What the student sees:

- **₹2099 per seat**, and a booking is one seat
- **Promo codes** — flat or percentage — the only discount there is

There used to be a ₹199 group discount for five people booking together. Bookings are one
person now, so a group cannot exist and the discount went with it.

`quote()` in `src/lib/pricing.ts` is the only place this is calculated. The booking form,
the student's booking page and the admin verifier all call it, so nobody sees one number and
is charged another.

### Cost vs profit — admin only

That ₹2099 is really two numbers: **₹2000 the seat actually costs** the club (bus, food,
safari) and **₹99 the club keeps**. `profit()` in the same file splits them.

**A discount comes out of the margin, never out of the cost** — suppliers get paid whatever
happens. So a seat sold with a ₹50 promo:

| | |
|---|---|
| Collected | ₹2,049 |
| Trip cost | −₹2,000 |
| Margin before discount | ₹99 |
| Promo | −₹50 |
| **Club keeps** | **₹49** |

Which is why **a promo code worth more than ₹99 sells the seat below cost.** The admin
dashboard and the booking page both turn red when that happens rather than quietly showing
a smaller number.

The base cost lives in **`jawaiTrip/finance`**, which is admin-read-only — *not* in
`settings`, because settings are world-readable so the public page can show the price. The
margin is never visible to a student, and never stored on a booking they can read.

`/admin` totals collected, trip cost and profit separately across all confirmed bookings,
and each booking shows its own split.

### Collecting on several UPI IDs

One personal UPI ID hits receiving limits long before 89 students have paid into it, so the
club can list **as many UPI accounts as it likes** in Trip settings — add, rename, pause or
remove them there.

Students are **spread across the active accounts automatically**. Which one a student gets
is decided by hashing their uid, not by a shared counter: a counter would need every browser
to read and write shared state, and students can't read each other's bookings. Hashing is
free, spreads evenly (89 students over 3 IDs lands about 29 / 33 / 27), and is **stable** —
the same student always sees the same ID, so refreshing mid-transfer doesn't move the target
under them.

**The payment QR generates itself.** Rather than uploading a QR image per account, the page
builds a standard `upi://pay?pa=…&am=…&tn=…` link from the UPI ID and renders it as a QR —
so the **exact amount is already filled in** when the student scans, and the **booking code
travels into the payer's statement**, which is what makes reconciling 89 payments bearable.
On a phone there's also a button that opens a UPI app directly. Pasting a QR image URL in
Trip settings still overrides the generated one if you'd rather use your own.

If an ID refuses a payment — limit reached, app playing up — the payment page has a **"Use a
different UPI ID"** button that moves them to the next active account. The switch is written
to the booking immediately, not at submit, so if they pay and then close the tab the booking
still records where the money actually went.

### Payment screenshots

They go to **Cloudinary**, the same way the TEDx app does: the browser asks
`/api/cloudinary/sign` for a signature and uploads straight to Cloudinary, so the file never
passes through the server and the API secret never reaches a page. The signed folder is
checked against an allowlist, so a signed-in student can't have us sign an upload into a
folder movie night uses.

Set three variables to turn it on:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=   # public, ends up in image URLs
CLOUDINARY_API_KEY=                  # server only
CLOUDINARY_API_SECRET=               # server only
```

**Without them it still works.** Screenshots fall back to being stored in the Realtime
Database under `jawaiTrip/paymentShots/<bookingId>` — shrunk small enough that 89 of them
are a few megabytes. This app has repeatedly been blocked by a missing piece of setup, so an
upload that works before anything is configured is worth more than a tidier single path.

Either way the image is **resized in the browser first** — a payment screenshot only has to
be readable by a human checking an amount, and it makes the Cloudinary free tier go a long
way across 89 of them. Database-stored ones are kept **off the booking** so the admin list
can load every booking without dragging every image with it.

It was Firebase Storage before this, which needed a bucket provisioning and its own rules
file; when either was missing the upload didn't fail, it hung. Every network wait now has a
timeout, so a stall surfaces as a message rather than a button that spins forever.

**Every booking stores `payeeUpiId`**, so `/admin` shows a **Payments by UPI ID** table:
how many paid into each account and how much, with accounts flagged as active, paused, or no
longer listed. Each booking's verification page names the ID to check the screenshot
against.

Pausing an account stops new students being sent to it but leaves every past booking's
record intact — which is the point of keeping the ID on the booking rather than looking it
up from settings later.

### Google Sheet and confirmation email

Both are one thing: an **Apps Script deployed on the trip spreadsheet**. When an admin
confirms a payment the site posts the booking to it, and the script **writes the row into
the sheet and emails the student** — booking code, amount, departure, pickup, ticket code
and the WhatsApp group link.

`MailApp` sends as the Google account that owns the script, so **there is no mail password
anywhere** — no App Password to create, no SMTP credential on a server — and the mail
arrives from an address students already recognise. The sheet fills itself in as a
side-effect, which is the other half of the job.

**Setup** is in `apps-script/Code.gs`, with the steps in a comment at the top:

1. Trip spreadsheet → **Extensions → Apps Script**, paste the file in
2. Change `SECRET` to something long and random
3. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*
4. Put the `/exec` URL and the same secret in the site's environment:

```
SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
SHEETS_WEBHOOK_SECRET=   # identical to SECRET in the script
```

> **"Anyone" is required**, not careless. The deployment has to be reachable without a
> Google login for the site to call it at all. The **secret is the only thing between that
> endpoint and the open internet**, which is why it lives in an environment variable and
> never in `jawaiTrip/settings` — settings are world-readable, so putting it there would
> publish it.

> Edit the script later and you must **Deploy → New deployment** again. Google keeps serving
> the old version otherwise, and it looks like nothing changed.

Rows are matched on the **booking code**, so re-sending a confirmation or re-running a sync
**updates the student's row in place** instead of piling up duplicates.

**Sync to Google Sheet** on `/admin` pushes *every* booking — ones made before the sheet
existed, ones still waiting to be verified. It writes rows only: a sync must never mail 89
students a second time.

That endpoint is **admin-only, enforced by the database rules rather than by a check in the
code**. It reads the whole `jawaiTrip/bookings` node as the caller, and the rules grant a
student read on a single booking but never on the parent — so a read that succeeds *is* the
proof. Same trick as the email route, and the reason there is no second copy of the admin
list to drift out of step with the rules.

#### If you'd rather not use Apps Script

`GMAIL_USER` + `GMAIL_APP_PASSWORD` sends the same email over Gmail SMTP, with nothing
written to the sheet. That's an **App Password** from `myaccount.google.com/apppasswords`,
not the account password — turn on 2-Step Verification first or Google won't offer you one.

**And with neither configured, confirming still works.** The booking is confirmed and the
ticket issued exactly as before; the email just doesn't go out, and the admin sends the same
message on **WhatsApp** from the booking page — one tap, already written, to the number on
the booking. That button is there either way.

### WhatsApp group

Paste the group invite link into **Trip settings → Trip WhatsApp group**. It then appears:

- on the student's booking page, **only once their payment is verified**
- in their confirmation email
- in the WhatsApp message the admin sends

so the group is people who have actually paid.

> The link is stored in `jawaiTrip/settings`, which is world-readable — the public page needs
> the price and dates from the same node. The app only *shows* it to confirmed students, but
> anyone reading the database directly could find it. Treat it as "not advertised" rather
> than secret, and rely on the group's own admission settings the way you would with any
> invite link that gets forwarded.

### CSV download

**Download CSV** on `/admin` and `/admin/roster` is the offline path, for when you want a
file rather than the live sheet — or a snapshot the club still has in hand if the database
is unreachable on trip day. It opens in Google Sheets, Excel and Numbers.

- `/admin` exports **every booking**, including the promo, which UPI ID it was paid into,
  and the cost/profit split. That last part is why it's built on an admin page: the margin
  isn't stored on the booking, it's worked out from the admin-only finance node.
- `/admin/roster` exports the **manifest** — blood groups, conditions, allergies,
  medications and emergency contacts.

Cells beginning `=`, `+`, `-` or `@` are quoted first, so a name or NIFT ID typed by a
student is never handed to a spreadsheet's formula engine. Numbers skip that guard — quoting
a negative "club keeps" would land the one row worth looking at as text that Sheets refuses
to add up.

### Booking flow

```
your details → review + promo → UPI payment → upload screenshot
     → admin verifies → CONFIRMED → QR ticket issued
```

A rejected payment doesn't lose the booking: the student sees the reason and re-uploads.

**One seat per NIFT ID**, enforced in two places. The form checks before you go on, so you
get a plain message rather than a failure at the end; and `jawaiTrip/niftIdIndex` makes the
ID itself the lock — the rules only let an *unclaimed* key be written, so two people
submitting the same ID at the same moment cannot both get a seat. To free an ID after a
cancellation or a typo, delete its key under `jawaiTrip/niftIdIndex`.

### QR codes

Every confirmed booking gets one QR. A ticket's QR encodes only its ticket code, and that code *is* the database key, so a scan
is a single key lookup. That is what makes the scanner usable on a weak signal. Codes use an
alphabet with no `O/0` or `I/1`, so the code printed under each QR can be typed in by hand
without ambiguity.

### Bus day

`/admin/scan` has a camera scanner **and** a manual code box. Scanning shows the person's
blood group, conditions, allergies and emergency contact right there — that's the moment
the information is actually needed.

**Print `/admin/roster` before leaving.** Jawai has patchy signal. The roster is the whole
manifest on paper: everyone with their blood group, conditions, allergies, medication and
who to call, with anyone who declared something highlighted. It's the fallback for no
network, and the reason the medical fields are collected at all.

---

## Data layout

Everything under `jawaiTrip`:

| Key | What's in it |
|---|---|
| `settings` | Price, dates, seats, UPI accounts, trip lead contact, WhatsApp group link. World-readable. |
| `finance` | What a seat costs the club. **Admin-only** — never world-readable. |
| `bookings/$id` | Booker, travellers, pricing breakdown, payment proof, status. |
| `bookingsByUser/$uid/$id` | "Does this person already have a booking?" |
| `bookingCodeIndex/$code` | Booking code → booking id. |
| `niftIdIndex/$niftId` | **One seat per NIFT ID** — the claim that enforces it. |
| `tickets/$ticketCode` | One per booking. **The key is the QR payload.** |
| `ticketsByBooking/$id/$code` | Tickets belonging to a booking. |
| `promoCodes/$CODE` | Promo codes. |

**Privacy.** Medical details are readable only by the booker and by trip admins. Promo codes
can be read one at a time by a signed-in student (to check a code they were given) but
cannot be listed — only admins can enumerate them.

No `.indexOn` entries are needed: every read is a direct key lookup or a whole-node read by
an admin, never an `orderByChild` query.

---

## Routes

| Route | Who | What |
|---|---|---|
| `/` | Anyone | The trip page |
| `/login` | Anyone | Email + password, APC's existing accounts |
| `/book` | Signed in | Booking flow |
| `/booking/[id]` | The booker | Status, and QR tickets once confirmed |
| `/admin` | Admins | Verification queue + trip settings |
| `/admin/bookings/[id]` | Admins | Screenshot, amount check, approve / reject |
| `/admin/promos` | Admins | Promo codes |
| `/admin/roster` | Admins | Printable manifest |
| `/admin/scan` | Admins | Bus check-in |
| `/api/email/confirmation` | Admins & the booker | Sheet row + confirmation email |
| `/api/sheets/sync` | Admins | Pushes every booking into the sheet |

---

## Photos

The trip page ships with gradients and typography where photos should be. Drop images in
and they take over automatically:

```
public/jawai/hero.jpg      background behind the title
public/jawai/kopjes.jpg    gallery
public/jawai/leopard.jpg   gallery
public/jawai/bandh.jpg     gallery
```

---

## Deployment

Vercel. Import the repo, add the same `NEXT_PUBLIC_FIREBASE_*` variables from `.env.local`
under **Project → Settings → Environment Variables**, and deploy. Add the deployed domain to
**Firebase Console → Authentication → Settings → Authorized domains**, or sign-in will fail
in production.

## Checks

```bash
npm run lint
npm run build
```
