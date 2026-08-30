# Jawai Safari — APC Club

Booking site for the APC Club's adventure trip to Jawai, NIFT Jodhpur.

A one-day trip: the bus leaves campus in the morning, and everyone is back the same night.
Bus, food and the safari are all in the price.

Students book up to 5 seats on one NIFT ID, fill in blood group / medical details /
emergency contacts for everyone travelling, pay by UPI, and get QR tickets once an admin
verifies the payment. On trip day the QRs are scanned at the bus.

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
   `"rules"` object**, as a sibling of the keys already there. Don't delete anything.
4. Drop the `___README___` key — it's documentation, not a rule.
5. **Publish**, then open the movie night app and confirm it still works.

### 3. Make yourself an admin

Nobody can grant themselves admin — the rules forbid it — so the first one is added by hand.

1. Sign in to this app at `/login`.
2. Go to `/admin`. It will refuse you, and show your UID on screen.
3. In **Firebase Console → Realtime Database → Data**, create
   `jawaiTrip / admins / <that UID>` with the boolean value `true`.
4. Reload `/admin`.

From there you can add other admins the same way.

### 4. Storage (payment screenshots)

Screenshots go to Firebase Storage in the same project. Paste the block from
`storage.rules.snippet` into **Firebase Console → Storage → Rules** — same warning as
above, merge it rather than replacing what's there. Add your admin UIDs to the
`isJawaiAdmin()` list in that file: Storage rules can't read the database, so admins are
listed in both places.

If the project is on the free Spark plan and Storage won't provision a bucket without
billing, switch `src/lib/storage.ts` to a Cloudinary unsigned upload — it's the only file
that touches file storage.

### 5. Trip settings

Sign in as an admin, open `/admin`, click **Trip settings**, and fill in dates, price, UPI
ID, seat count and trip lead contact. The public page reads these live.

---

## How it works

### Pricing

What the student sees:

- **₹2099 per person**
- **₹199 off the whole booking** when all 5 seats are booked together → **₹10,296**
- **Promo codes** — flat or percentage
- **Discounts never stack.** A booking gets the *larger* of the group discount and the
  promo code, never both. A tie goes to the group discount, so a promo code is never
  consumed without saving anyone money.

`quote()` in `src/lib/pricing.ts` is the only place this is calculated. The booking form,
the student's booking page and the admin verifier all call it, so nobody sees one number and
is charged another.

### Cost vs profit — admin only

That ₹2099 is really two numbers: **₹2000 the seat actually costs** the club (bus, food,
safari) and **₹99 the club keeps**. `profit()` in the same file splits them.

**A discount comes out of the margin, never out of the cost** — suppliers get paid whatever
happens. So a full group of 5:

| | |
|---|---|
| Collected | ₹10,296 |
| Trip cost (₹2000 × 5) | ₹10,000 |
| Margin before discount | ₹495 |
| Group discount | −₹199 |
| **Club keeps** | **₹296** |

The base cost lives in **`jawaiTrip/finance`**, which is admin-read-only — *not* in
`settings`, because settings are world-readable so the public page can show the price. The
margin is never visible to a student, and never stored on a booking they can read.

`/admin` totals collected, trip cost and profit separately across all confirmed bookings,
and each booking shows its own split. If a promo code is bigger than the margin, net profit
goes negative and both the booking and the dashboard say so in red.

### Booking flow

```
seats → traveller details → review + promo → UPI payment → upload screenshot
     → admin verifies → CONFIRMED → QR tickets issued
```

A rejected payment doesn't lose the booking: the student sees the reason and re-uploads.

One live booking per account. The booker is always traveller 1.

### QR codes

Every confirmed booking gets:

- **one QR per traveller** — checks that person in individually
- **one QR for the booking** — checks the whole group in at once

A ticket's QR encodes only its ticket code, and that code *is* the database key, so a scan
is a single key lookup. That is what makes the scanner usable on a weak signal. Codes use an
alphabet with no `O/0` or `I/1`, so the code printed under each QR can be typed in by hand
without ambiguity.

### Bus day

`/admin/scan` has a camera scanner **and** a manual code box. Scanning shows the person's
blood group, conditions, allergies and emergency contact right there — that's the moment
the information is actually needed.

**Print `/admin/roster` before leaving.** Jawai has patchy signal. The roster is the whole
manifest on paper: every traveller with blood group, conditions, allergies, medication and
who to call, with anyone who declared something highlighted. It's the fallback for no
network, and the reason the medical fields are collected at all.

---

## Data layout

Everything under `jawaiTrip`:

| Key | What's in it |
|---|---|
| `settings` | Price, dates, seats, UPI details, trip lead contact. World-readable. |
| `finance` | What a seat costs the club. **Admin-only** — never world-readable. |
| `admins/$uid` | `true` for trip admins. |
| `bookings/$id` | Booker, travellers, pricing breakdown, payment proof, status. |
| `bookingsByUser/$uid/$id` | "Does this person already have a booking?" |
| `bookingCodeIndex/$code` | Booking QR → booking id. |
| `tickets/$ticketCode` | One per traveller. **The key is the QR payload.** |
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
