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

**`/admin` shows a "Payments by UPI ID" table**, counted **transfer by transfer** rather
than booking by booking. That distinction is the whole point once a seat can be paid in
parts and by more than one method: a booking settled ₹2,000 by UPI and ₹99 in cash used to
put the full ₹2,099 against the UPI ID, and a booking paid entirely by bank transfer was
filed under a UPI ID it never touched. Cash and bank get their own rows, marked **Not UPI**.
Accounts are flagged active, paused, or no longer listed. Each booking's verification page names the ID to check the screenshot
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

### Paying in more than one go

**The first payment to a UPI ID you have never paid is capped by the bank** — commonly
₹2,000 for the first 24 hours. A ₹2,099 seat therefore often *cannot* be paid in one
transfer, and before this that was a dead end: one screenshot field, one amount, and a
student staring at a payment their app refused to make.

So a booking carries a **list of payments**. Pay what goes through, upload it, and the page
comes back asking for the balance with **the QR regenerated for the remaining amount** — so
the second transfer is exact and nobody does mental arithmetic at a payment screen. The
warning appears *before* they try, not after their bank refuses.

The admin's page shows **every transfer with its own screenshot**, the running total against
what is owed, and a red **"₹99 short"** banner when it doesn't add up. Confirming while short
is still possible — sometimes the club decides to eat it — but the button says so rather than
looking like a normal confirm. Overpayment is flagged too, as a refund to make.

The amount is typed by the student, so it is a **claim, not a fact** — it exists to make the
screenshot quick to check, and the admin check is still the control.

**Students don't type the amount.** It is the one number they have no reason to get right
and every reason to mistype, and an admin reads it off the screenshot anyway — so the page
records what it asked for, and each transfer on the admin's page has a **"Screenshot shows a
different amount? Correct it"** control. Lowering it puts the balance back on the student's
page, so a short payment becomes an outstanding one rather than a silently under-paid seat.

`Still owed` is a column in both the CSV and the Google Sheet, which makes "who hasn't
finished paying" a sort rather than a hunt.

> Bookings made before this read as a single full-amount transfer, so nothing already
> confirmed suddenly looks unpaid.

### Cash, and transfers straight to a lead

Plenty of students just hand over cash. Before this there was no way to record that: a
booking could only be paid by uploading a screenshot, so a paid-up student with cash in hand
stayed stuck at "awaiting payment".

**Record cash or a direct transfer** on the admin's booking page takes an amount, a method
(cash / bank transfer / UPI to a lead's own ID) and a note. It goes into the **same list of
transfers** as anything paid through the site, so a seat paid half in UPI and half in cash
adds up correctly and the shortfall banner still works.

> **Cash records who took it.** There is no statement behind a note handed over at a desk,
> so the signed-in admin's name is the only account of where ₹2,099 went. It's captured
> automatically, shown on the transfer, and exported in its own **"Cash taken by"** column —
> so let whoever actually collected it be the one who enters it.

**Find the student** with the search box at the top of `/admin` — email, name, NIFT ID,
phone or booking code all match. A search ignores the status chips, because hunting for a
booking you can't see due to the wrong filter is the exact frustration it exists to remove.

### Paying: QR, or a bank transfer

**The QR is the only UPI path.** There were per-app buttons — Google Pay, PhonePe, Paytm —
built on deep links. They were removed. Deep links broke twice in different ways (Chrome
refusing custom schemes, then apps showing their own restriction notices), each failure
looked to a student like the site was broken, and none of it was fixable from here. A QR
that always renders beats four buttons that sometimes work.

The QR carries the amount and the booking code, so there is nothing to type.

> **On a phone you cannot scan a QR that is on the screen you are holding.** The obvious
> workaround — screenshot it, open it from the gallery — is exactly the path apps cap at
> ₹2,000. So the page says plainly: open it on a **laptop**, or on a friend's phone, and
> scan from there.

**Bank transfer** is the fallback, folded away under the QR. It has no ₹2,000 ceiling, so it
is the answer when UPI has refused someone for a reason the club cannot fix — a daily limit,
an outage, a first payment to an unknown payee. The booking code goes in the remarks, since
a transfer carries no code of its own and otherwise the money is matched by amount alone.

Set it in **Trip settings → Bank transfer**. Blank fields hide the option entirely.

> The details live in the database, not in the code. An account number is not a secret — you
> hand it out to be paid — but this repository is public, and anything committed to it is in
> its history permanently.

### When a UPI ID stops working

Under the QR there is always a **"Tell the trip leads it's not working"** WhatsApp link,
pre-written with the booking code, the UPI ID shown and the amount — so a lead can act on it
without a round of "which one? whose booking?". If a second account is configured, a **"Use
a different UPI ID"** button sits beside it and the switch is written to the booking
immediately.

> This block used to be hidden unless two or more accounts existed, which meant a club
> running a single UPI ID — the normal case at the start — had no way to report anything at
> all, and a student whose payment kept failing simply gave up. It is now always shown.

### Email verification

**Booking is gated on it.** The form on `/book` does not render until the address is
verified, and the database rules refuse to create a booking unless
`auth.token.email_verified` is true — so it is a real gate, not a hidden button. The ticket
is emailed; an unverified address is a seat that gets paid for and then never reaches
anyone, and by then the money has moved and it is an argument rather than an inconvenience.

Admins are exempt in the rules, so recording a booking on someone's behalf still works.


Signing up sends a Firebase verification email, and an amber banner nags until the link is
clicked. The ticket is emailed, so an address nobody has proved is reachable is a seat that
quietly never gets its confirmation.

**Every message about email says to check Spam and Promotions.** That is not boilerplate:
automated mail to a student address lands there often enough that "I never got it" nearly
always means "I didn't look there". It's on the banner, on the re-send toast, and on the
"still not verified" message.

### WhatsApp group

Paste the group invite link into **Trip settings → Trip WhatsApp group**. It then appears:

- on the student's booking page, **only once their payment is verified**
- in their confirmation email
- in the WhatsApp message the admin sends

so the group is people who have actually paid.

#### "Can a link work for only one person?"

**No.** WhatsApp has no per-person invite — every `chat.whatsapp.com` link works for anyone
holding it, and a student who forwards theirs has let that person in. Nothing on our side
can change that, and any claim otherwise would be a lie told by a button.

What does work is WhatsApp's own **Group settings → Approve new participants**. Turn it on
once and every join waits for an admin, showing the number asking. That turns it into "is
this number on the list?", which **`/admin/join`** answers instantly — matched against
**confirmed bookings only**, on the last 10 digits, so someone who never paid is never let
in. It shows the name, NIFT ID and booking code for a match.

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

### Booking someone in yourself

Students pay in person, message a lead, or never get round to the site — and a club that
cannot write those down keeps the real list somewhere else, which is how a bus leaves with a
name nobody checked.

**Book a seat at the desk** on `/admin` takes a **name, NIFT ID and phone** — and the money,
in the same form. In person the cash changes hands in the same breath as the name, and
creating the seat then hunting for it in the list to record ₹2,099 you are already holding is
how a cash payment ends up remembered rather than written down.

If the amount covers the seat, **"Confirm the seat now and issue the ticket"** is offered and
on by default: the lead took the money themselves, so there is no screenshot to check and no
reason to queue it behind one.

**No email is asked for.** A lead has a name and a number; the address turns up later or not
at all. Link it from the booking's own page whenever it does, and signing in with it makes
`/book` offer them the seat instead of a blank form — then **they** fill in blood group,
allergies and emergency contact. A lead guessing at a blood group is worse than a blank, so
the roster shows the gap instead.

Changing a linked address moves the index entry rather than leaving the old one pointing here
— otherwise whoever owns the first address could still claim a seat that is no longer theirs.

> **At the bus, a desk booking needs no phone.** The scanner takes a booking code typed by
> hand, and the roster prints one against every name — so someone who never made an account,
> and has no QR to show, is checked in from the paper list like everyone else.

The claim is enforced by the **database rules**, not the button: a booking created this way
has an empty `bookerUid`, and the only write that may fill it in is one where the booking's
`claimEmail` equals `auth.token.email` and that address is verified. `bookerUid` is
otherwise immutable, so a claimed seat cannot be taken again.

`jawaiTrip/claimIndex/<email>` maps the address to the booking — a single key lookup, since
a student cannot list bookings. Emails are percent-encoded as keys rather than having their
dots flattened to `-`: `a.b@x.com` and `a-b@x.com` are different people.

> A signed-in student who guesses an address can learn *that* a booking exists for it. They
> cannot read it — that needs the matching verified email — so what leaks is one bit about
> an address they already knew.

The prompt sits above the booking form on purpose: a student who books a second seat without
noticing has taken two of eighty-nine and paid for one.

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
| `settings` | Price, dates, seats, UPI accounts, bank details, trip lead contact, WhatsApp group link. World-readable. |
| `finance` | What a seat costs the club. **Admin-only** — never world-readable. |
| `bookings/$id` | Booker, travellers, pricing breakdown, payment proof, status. |
| `bookingsByUser/$uid/$id` | "Does this person already have a booking?" |
| `bookingCodeIndex/$code` | Booking code → booking id. |
| `niftIdIndex/$niftId` | **One seat per NIFT ID** — the claim that enforces it. |
| `claimIndex/$email` | Email → a booking a lead made for them, until they claim it. |
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
| `/admin/join` | Admins | Check a number before letting it into the group |
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
