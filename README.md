# Stitch Voice Chat v2

An AI front desk for upholstery shops, by CreativeFactory.studio / buildyou (Toronto).

Stitch is a copper shop robot (model CR-7). Clients chat with Stitch by text or voice, get an instant estimate,
see AI previews of their piece, and book a drop-off. Shop staff run every job from one board.

- **Client side** (public, one page per shop at `/s/your-shop`): chat with memory and a self-filling job sheet,
  photo before/after preview, dream-project builder, instant estimate with 13% HST, swatch library, booking with
  Interac e-Transfer deposit instructions, and a private job page at `/j/<token>`.
- **Shop side** (`/shop`, staff sign in by email link): dashboard, jobs board (Lead → Quoted → Deposit received →
  In progress → Ready → Picked up), client files, quote builder with print/PDF, suppliers vault, swatches,
  shop settings, Teach Stitch, and a billing placeholder (14-day trial, then $29 CAD/month).

## Demo mode (no setup)

If the Supabase settings are empty, the app runs in **demo mode**: all data lives in the browser
(localStorage), seeded with "Maple Upholstery (demo)". Open `/s/maple-demo` as a client and `/shop` as staff.
Chat still calls `/api/chat` when it can reach it; with no AI key Stitch says it is offline (it never makes up answers).

There is also a single-file phone preview at `../preview/index.html` (build it with `npm run build:preview-file`).
It needs no server. Chat in that file always shows the offline notice, because there is no `/api` behind it.

---

## What you need

- A computer with **Node.js 18 or newer** (https://nodejs.org, the "LTS" button). On Android, Termux works too:
  `pkg install nodejs-lts`.
- Free accounts (only for the full version, not for the demo):
  - **Google AI Studio** for the chat key: https://aistudio.google.com/apikey
  - **Supabase** for the database, staff sign-in and photos: https://supabase.com
  - **Vercel** to put it online: https://vercel.com
  - Optional: **Cloudflare** for before/after previews made from the real photo.

## Run it on your computer

Each line is one command. Run them inside this folder.

    npm install

    npm run dev:api

That starts the API on port 8787. Open a second terminal in the same folder and run:

    npm run dev

Then open http://localhost:5173 in your browser. Why two terminals: one runs the screens, the other runs the
small server that talks to the AI.

To give Stitch a brain locally, copy `.env.example` to `.env.local` and put your key after `GEMINI_API_KEY=`.
Restart `npm run dev:api` after changing it.

## Set up Supabase (database, sign-in, photos)

1. Sign in at https://supabase.com and press **New project**. Pick a name, a strong database password, and the
   region closest to you (Canada Central if offered). Wait about 2 minutes.
2. Open **SQL Editor**, press **New query**, paste the whole of `supabase/schema.sql`, and press **Run**.
   It should say "Success". It creates the tables, the security rules, and the `photos` storage bucket.
3. Open **Storage** and check there is a bucket named `photos` marked **Public**. If it is missing, press
   **New bucket**, name it exactly `photos`, switch on **Public bucket**, and save. (Photo file names are random,
   so a link cannot be guessed.)
4. Open **Authentication → URL Configuration**. Set **Site URL** to your live address (for example
   `https://stitch-voice-chat.vercel.app`). Under **Redirect URLs** add `https://YOUR-ADDRESS/shop` and, for local
   testing, `http://localhost:5173/shop`. This is where the sign-in email sends staff.
5. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key. You need them below.
   Never use the `service_role` key in this app.

Supabase's free email sender allows only a few sign-in emails per hour. That is fine to start; for more, add your
own SMTP under Authentication → Emails.

## Environment variables

| Name | Where it is used | Needed? |
| --- | --- | --- |
| `GEMINI_API_KEY` | `/api/chat` (server only) | Yes, for Stitch to answer |
| `VITE_SUPABASE_URL` | browser | For the real database. Empty = demo mode |
| `VITE_SUPABASE_ANON_KEY` | browser | Same as above |
| `SUPABASE_URL` | `/api/chat` reads the shop's Teach Stitch answers | Same value as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | `/api/chat` | Same value as `VITE_SUPABASE_ANON_KEY` |
| `CF_ACCOUNT_ID` | `/api/render` | Optional: photo-based before/after |
| `CF_API_TOKEN` | `/api/render` | Optional, with the one above |

The `VITE_` values are baked into the page when it is built, so after changing them you must deploy again.

## Put it online with Vercel

1. Put this folder in a GitHub repository (GitHub Desktop is the easiest way: **Add → Add existing repository**,
   then **Publish**). Do not upload `.env.local`; the `.gitignore` already leaves it out.
2. Sign in at https://vercel.com with GitHub and press **Add New → Project**. Pick the repository.
3. Vercel detects **Vite**. Leave the build command (`npm run build`) and output folder (`dist`) as they are.
4. Open **Environment Variables** and add each name from the table above with its value.
5. Press **Deploy**. When it finishes, open the address Vercel gives you.
6. Check it: open `https://YOUR-ADDRESS/api/health`. It shows which parts are switched on, without showing keys:
   `{"ok":true,"ai":true,"photoRender":false,"database":true}`.
7. Go to `/shop`, enter your email, open the sign-in link, and create your shop. Your client page is `/s/your-shop`.

`vercel.json` already sends every page address to the app and gives the chat and render functions up to 30 seconds.

## Optional: photo before/after with Cloudflare

1. Sign in at https://dash.cloudflare.com, open **AI → Workers AI**, and press **Use REST API**.
2. Create an API token with the **Workers AI** permission. Copy the token and your **Account ID**.
3. Add them on Vercel as `CF_ACCOUNT_ID` and `CF_API_TOKEN`, then redeploy.

Without them, the "before and after" preview is drawn from a text description instead of the photo, and the page
says so. Dream builds always use Pollinations (free, no key). Every image is labelled "AI preview, final may vary."

## How Stitch answers

- `/api/chat` receives the **whole conversation** and the job sheet every time, so Stitch remembers what was said
  and only introduces itself on the first message. (The old app sent only the newest question.)
- It picks the 6 to 8 most relevant entries from the 365-entry shop book (`shared/stitch-kb-all.json`), scoring
  titles, other names (aliases, for example welt = piping = cording) and text. A shop's own **Teach Stitch**
  answers are searched first and win.
- Rules in the instructions: no invented prices (it points to the estimate, which uses the shop's rates), legends
  are "traditionally said", fire-code and legal questions go to staff, HST is 13%, numbers as digits, one missing
  detail at a time, and inches or cm asked only once.
- If Gemini fails or times out (12 seconds), the client gets an honest "Stitch is offline" notice. No canned answers.
- Model: `gemini-flash-lite-latest`.

## Estimator math

Yards of 54-inch plain fabric, from the live app's sofa formula:
`(width + 2 × depth + 12) ÷ 36 × factor + allowance`, in inches (cm are converted), rounded up to the half yard.
Sofa uses factor 2.5 and allowance 2; other pieces have their own (see `shared/estimator.ts`). Patterned fabric
adds 15%. Cost = yards × fabric price + labour for the piece + foam + supplies, then 13% HST. The client sees a
range (the shop's low and high fabric price) marked "approximate, confirmed after inspection". The quote builder
does exact math to the cent.

The demo shop's rates are made-up demo numbers. Set real ones in **/shop → Settings**.

## Testing

    npm test

Unit tests: estimator and quote math, shop-book search, job-sheet reading ("width is 75 and depth is 45"),
conversation memory and the one-time intro.

Smoke tests (need a build and three terminals):

    npm run build
    npm run mock:gemini
    GEMINI_API_KEY=fake GEMINI_BASE_URL=http://localhost:9999/v1beta SERVE_DIST=1 npm run dev:api
    npm run test:smoke:api
    npm run test:smoke:browser

The mock Gemini answers only with what it received, which proves the full history and job sheet reach the model.
It is for tests only. The browser test needs Playwright's Chromium (`npx playwright install chromium`).

Database rules can be checked on plain Postgres with `supabase/tests/supabase-stub.sql` then `schema.sql` then
`supabase/tests/rls-test.sql` (prints "RLS TESTS PASSED").

## Files

- `api/chat.ts`, `api/render.ts`, `api/health.ts`: Vercel serverless functions. `api/_lib.ts`: shared helpers.
- `shared/`: code used by both the browser and the API (estimator, shop-book search, job sheet, prompt, renders).
- `src/`: the React app. `src/data/` has the two data backends: `supabaseStore.ts` (real) and `localStore.ts` (demo).
- `supabase/schema.sql`: tables, row-level security, public functions and the photo bucket.
- `server/local-api.ts`: runs the API on your computer.
- `scripts/build-preview-file.mjs`: builds the single-file preview.

## Known limits

- Billing is a placeholder: no payments are taken.
- Stitch does not send emails or texts. When a quote is sent, staff copy the client link or use the Email/Text buttons
  on their own phone. Clients see shop replies when they open their job link.
- Voice input depends on the browser (works in Chrome on Android; not in Firefox). "Read replies aloud" is off by
  default so it does not talk over a screen reader.
- The chat limiter is per server instance only. Heavy abuse would need a shared limiter (for example Upstash).

© CreativeFactory.studio. All rights reserved.
