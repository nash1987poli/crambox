# CramBox — n8n Automation Guide

Two workflows: **(1) Issue & deliver an activation code** when someone buys, and **(2) Daily study nudge** to keep students consistent. Both use your existing Google "Codes" sheet + the Apps Script.

---

## One-time setup

1. **Add a header in the Codes sheet:** column **G = `Email`** (row 1). (Code | Name | Status | Device | Activated | MaxDevices | Email)
2. **Set your secret:** in the Apps Script, change `ISSUE_SECRET` from `CHANGE-ME-...` to your own long random string. **Redeploy** (Deploy → Manage deployments → Edit → New version).
3. Note your Web App URL (same one CramBox uses) — n8n calls it.

---

## Workflow 1 — Issue & deliver a code (Form → your approval → email)

**Goal:** buyer fills a form → you approve → a code is generated, written to the sheet, and emailed automatically.

### Nodes (in order)

1. **Form Trigger** (n8n Form, Tally, or Google Form → Webhook)
   - Fields: `name`, `email`, `whatsapp`, `ecocash_reference`, `plan` (Solo / Squad-3 / Squad-5)

2. **(Approval) Send you a message** — *Gmail* or *Telegram* node
   - To: you. Body: "New order: {{name}} {{email}} paid ref {{ecocash_reference}} for {{plan}}. Reply/click to approve."
   - Use n8n's **Wait → "On webhook call"** (or a Telegram "approval" button) so the flow pauses until you confirm the EcoCash payment is real.

3. **Set `maxDevices`** — *Edit Fields (Set)* node
   - `maxDevices` = `1` if plan is Solo, `3` if Squad-3, `5` if Squad-5
   - (Expression: `{{ $json.plan === 'Squad-5' ? 5 : $json.plan === 'Squad-3' ? 3 : 1 }}`)

4. **Issue the code** — *HTTP Request* node
   - Method: **POST**
   - URL: your Apps Script Web App URL
   - Body (JSON / "Using Fields Below" → raw):
     ```json
     {
       "action": "issue",
       "key": "YOUR_ISSUE_SECRET",
       "name": "{{ $json.name }}",
       "email": "{{ $json.email }}",
       "maxDevices": {{ $json.maxDevices }}
     }
     ```
   - Header: `Content-Type: text/plain;charset=utf-8` (avoids CORS preflight; the script uses JSON.parse)
   - The response contains `{ "ok": true, "code": "CB-XXXXXXXX" }`

5. **Email the code** — *Gmail* (or SMTP) node
   - To: `{{ $json.email }}` (the buyer)
   - Subject: `Your CramBox activation code 🎓`
   - Body:
     ```
     Hi {{ $('Form Trigger').item.json.name }},

     Welcome to CramBox! Your activation code is:

         {{ $json.code }}

     How to use it:
     1. Open https://crambox-prep.vercel.app on your phone
     2. Enter the code above
     3. Study offline — no data needed after the first load

     Studying with friends? Ask about Squad codes (cheaper per person).
     Good luck 🔥
     ```

**Result:** order in → you approve (~5 sec) → code minted in the sheet → buyer gets it by email. Hands-off after approval.

> **Later (full auto):** replace nodes 1–2 with a **Paynow webhook** (fires only on *confirmed* payment) and drop the approval step.

---

## Workflow 2 — Daily study nudge (keeps students consistent)

**Goal:** a daily/every-few-days email reminding active students to study — the "come back tomorrow" trigger the offline app can't send itself.

### Nodes (in order)

1. **Schedule Trigger** — e.g. every day at 17:00 (after school).

2. **Read active students** — *Google Sheets* node (Read rows from "Codes")
   - Filter to rows where `Status` is `USED` or `ACTIVE` **and** `Email` is not blank.

3. **Send the nudge** — *Gmail* node (loop over rows)
   - To: `{{ $json.Email }}`
   - Subject: `🔥 Don't lose your streak — 10 minutes today`
   - Body (rotate a few of these so it doesn't feel robotic):
     ```
     Hi {{ $json.Name }},

     One 10-minute session today keeps your readiness climbing.
     Your exam won't wait — and neither should you 💪

     Jump back in: https://crambox-prep.vercel.app

     Tip: do a quick Spar with the Invigilator to hit your weak topics.
     ```

### Honest limitation (and the v2 upgrade)
Right now the server only knows **who activated** (name + email) — **not** their streak, readiness, or weak topic (that data lives offline on each phone). So v1 nudges are **motivational but generic**.

**v2 (personalised nudges):** have the app send a tiny, optional "heartbeat" (streak, days-to-exam, weakest topic) to a sheet whenever it's online. Then the nudge can say *"You're at 62% — your weak topic is Mensuration, worth 9 marks."* This needs a small in-app change (an opt-in online ping) — a future task, not required for v1.

---

## Security notes
- The `issue` endpoint is gated by `ISSUE_SECRET` — keep it secret; only n8n should know it.
- Never expose `ISSUE_SECRET` in the CramBox app (the app never issues codes — only validates them).
- The approval step in Workflow 1 is your fraud check until Paynow confirms payments automatically.
