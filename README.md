# Studioline

Multi-tenant work management for marketing agencies: a platform owner approves and bills Project Managers, each Project Manager runs an isolated workspace, and employees work through the tasks assigned to them.

Built with Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, and MongoDB (Mongoose).

## Roles

| Role | Area | What they do |
| --- | --- | --- |
| Platform owner | `/owner` | Approves registration requests, activates subscriptions, records payments, suspends/disables accounts, sees operational activity. Never sees workspace content. |
| Project Manager | `/workspace` | Owns one workspace. Creates projects and tasks, invites employees, answers help requests, reviews submissions. |
| Employee | `/my` | Sees only their own tasks. Starts work, asks for help, submits for review. |

## Getting started

```bash
npm install
cp .env.example .env        # then fill in the values
```

**Database.** Use a MongoDB Atlas connection string in `MONGODB_URI`, or run a local database for development (data is kept in `.data/`):

```bash
npm run db:dev
```

**Create the owner account.** Set `OWNER_EMAIL` and `OWNER_PASSWORD` in `.env`, then:

```bash
npm run seed:owner
```

**Optional sample data** (development only — one active workspace with a manager, three employees and tasks in every state). Set `DEMO_PASSWORD` in `.env` or let the script generate one:

```bash
npm run seed:demo
```

**Run the app:**

```bash
npm run dev
```

With `EMAIL_PROVIDER=console` no email is sent; setup and invitation links are shown on screen for you to copy or send on WhatsApp (they are also printed to the server log).

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js development server, production build, production server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (subscription rules, task workflow, date/money helpers) |
| `npm run db:dev` | Local MongoDB for development |
| `npm run seed:owner` | Create or reset the owner account |
| `npm run seed:demo` | Load sample data |

## How it fits together

```
src/
  app/                    Routes
    (auth)/               Login, request access, account setup, invitation, password reset
    owner/                Platform owner area
    workspace/            Project Manager area
    my/                   Employee area
    api/uploads           File upload endpoint
    api/files/[id]        Access-checked file download
    api/cron/daily        Scheduled maintenance
  components/             UI (ui/ = design-system primitives)
  lib/                    Framework-agnostic logic and infrastructure
    subscription/status   ← the single source of truth for subscription state
    tasks/workflow        ← the task state machine
    email/                Email abstraction + templates
    storage/              File storage abstraction
    auth/                 Password hashing, tokens, sessions
  models/                 Mongoose schemas
  server/                 Server-only services
    context.ts            Authorization guards
    tenant.ts             Tenant scoping helpers
    actions/              Server actions (all mutations)
  proxy.ts                Early redirect for signed-out visitors
```

### Account lifecycle

```
PENDING_APPROVAL ──approve──▶ PENDING_VERIFICATION ──setup link──▶ PENDING_PAYMENT
      │                                                                 │ owner activates
      └─reject─▶ (rejected)                                             ▼
                                                                     ACTIVE ◀──── payment recorded
                                                                        │ renewal date passes
                                                                        ▼
                                                                    PAST_DUE ── grace period ──▶ SUSPENDED
```

`CANCELLED` is set when the owner cancels the subscription. Suspension and cancellation never delete data.

- The first two states live on the registration request; the rest on the workspace.
- `src/lib/subscription/status.ts` computes the status from the subscription, the manual-suspension flag and the grace period, and defines what each status permits. Nothing else re-derives these rules.
- `syncWorkspaceStatus` (in `src/server/subscription.ts`) persists the result. It runs on every protected request, after every owner billing action, and in the daily cron job, so the state is current without anyone having to remember to update it.
- The grace period is configurable under **Owner → Settings**.

### Tenant isolation

Every tenant document carries `workspaceId`. The guards in `src/server/context.ts` resolve the signed-in user's workspace from the session — never from the request — and the helpers in `src/server/tenant.ts` (`scope`, `taskScope`) build the filter every query starts from. Employees are additionally limited to tasks assigned to them. Files are served only through `/api/files/[id]`, which repeats those checks.

The owner area reads billing data, head-counts and `PLATFORM`-scope activity only.

### Languages (English / Arabic)

The interface ships in English and Arabic, with full right-to-left layout for Arabic. The language button is in the sidebar, the landing header and the sign-in pages; the choice is stored in a cookie and on the user's account.

- English text is the translation key: `t("Save changes")`. Server components use `const t = await getT()`, client components `const t = useT()` (both in `src/lib/i18n`).
- Arabic strings live in `src/lib/i18n/ar/`. A string without an entry falls back to English, and `tests/i18n.test.ts` checks that placeholders match.
- Notifications and activity entries are stored as a template plus values (`msg("New task: {title}", { title })`), so each reader sees them in their own language. Emails are written in the recipient's language.
- Layout uses logical Tailwind classes (`ps-`, `me-`, `start-`, `text-start`) so it mirrors automatically; use those rather than `pl-`/`mr-`/`left-`.
- To add a language: add it to `LOCALES` in `src/lib/i18n/config.ts`, add a dictionary, and register it in `translator.ts`.

Browser tab titles and user-written content (task titles, comments) are not translated.

### Security notes

- Passwords are hashed with bcrypt (cost 12). Sessions are random 256-bit tokens stored hashed, in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie.
- Setup, invitation and reset links are single-use, expiring tokens stored hashed.
- Login, registration and password reset are rate-limited, and do not reveal whether an email is registered.
- Every server action validates input with zod and re-checks role, tenant, and subscription state on the server.
- Uploads are restricted by extension and size, stored privately, and only allow-listed media types are rendered inline.

## Configuration

All configuration is through environment variables — see [.env.example](.env.example).

**Email (optional).** `EMAIL_PROVIDER` selects `console`, `smtp`, or `resend`. With `console` no email leaves the server and the app still works: after approving a request or inviting an employee, the owner/manager is shown the one-time link with **Copy** and **Send on WhatsApp** buttons, and password resets are done by generating a reset link for the person (Team page for employees, the Project Manager page for managers). To add a provider, implement `EmailProvider` in `src/lib/email/index.ts`.

*Free setup with Gmail:* turn on 2-Step Verification for the Google account, create an **App password** (Google Account → Security → App passwords), then set these environment variables on the host and redeploy:

```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your.address@gmail.com
SMTP_PASSWORD=<the 16-character app password>
EMAIL_FROM="Studioline <your.address@gmail.com>"
```

Then open **Owner → Settings → Email** and press *Send a test email to me*; a failure shows the exact reason from the mail server. Gmail allows roughly 500 messages a day and sends only as the signed-in account. Notifications are sent after the page responds, so a slow mail server never slows the app.

**File storage.** `STORAGE_PROVIDER` selects:

- `mongodb` (default) — files are stored in a GridFS bucket in the same database. Nothing else to set up, and it works on serverless hosting. Best for small files; Atlas's free tier holds 512 MB in total.
- `cloudinary` — for larger or many files. Assets are uploaded as `authenticated` and delivered through short-lived signed URLs.
- `local` — writes to `./.uploads`; development only.

To add another provider, implement `StorageProvider` in `src/lib/storage/index.ts`.

**Branding.** The product name lives in `src/lib/brand.ts`; colours and fonts are theme tokens at the top of `src/app/globals.css`. The site ships no image files: the logo is inline SVG and fonts are bundled at build time.

## Deployment

The app needs a host that runs Node.js (it is not a static site). It has no dependency on a writable disk or on any service other than MongoDB, so a free setup works:

**Free setup: Vercel (Hobby) + MongoDB Atlas (M0)**

1. In Atlas, under *Network Access*, allow `0.0.0.0/0` (Vercel's addresses change).
2. Push the project to a GitHub repository and import it in Vercel.
3. In Vercel → *Settings → Environment Variables* add `MONGODB_URI` and `CRON_SECRET` (any long random string). Everything else has a working default: files go to MongoDB, links use the project's `*.vercel.app` domain, and `MAX_UPLOAD_MB` is 4. Set `APP_URL` only if you attach your own domain.
4. Deploy, then create the owner account once from your computer, with the same `MONGODB_URI` in `.env`: `npm run seed:owner`.
5. The daily job in `vercel.json` runs automatically (reminders and subscription emails). Subscription status itself is also refreshed on every request, so nothing breaks if the job is skipped.

On any other Node host: `npm run build`, `npm start`, and call `GET /api/cron/daily` once a day with the header `Authorization: Bearer $CRON_SECRET`.

### Known limits

- **Upload size.** Files pass through the app server. Vercel caps request bodies at about 4.5 MB, so the default limit is 4 MB per file. Large videos need a host without that cap, or direct-to-Cloudinary signed uploads (the storage abstraction is the place to add them); until then, share big files as a link in the task.
- **Payments are manual.** There is no payment gateway. The owner records payments; a gateway can be added later by creating `Payment` records from its webhooks and calling `syncWorkspaceStatus`.
- **WhatsApp** uses click-to-chat links (`wa.me`) with a pre-filled message. Nothing is sent automatically.
- **Billing dates** are calendar dates in UTC; task deadlines follow each workspace's timezone.
