import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  ClipboardCheck,
  FolderKanban,
  LifeBuoy,
  ListChecks,
  MessageCircle,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { Badge, PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Avatar } from "@/components/ui/primitives";
import { BRAND } from "@/lib/brand";
import { LanguageToggle } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";


function Section({ id, eyebrow, title, lead, children }: { id?: string; eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20">
      <div className="reveal">
        <p className="text-[13px] font-semibold text-brand">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl text-2xl font-semibold leading-tight sm:text-[32px]">{title}</h2>
        {lead && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{lead}</p>}
      </div>
      <div className="reveal mt-10">{children}</div>
    </section>
  );
}

/** Product preview assembled from the app's real UI pieces — no screenshots to go stale. */
async function HeroPreview() {
  const t = await getT();
  const rows = [
    { title: t("Spring campaign — hero visuals"), who: "Lina Haddad", status: "SUBMITTED_FOR_REVIEW", priority: "HIGH", due: "Today 16:00" },
    { title: t("Paid social copy, round 2"), who: "Omar Nasser", status: "IN_PROGRESS", priority: "MEDIUM", due: "Tomorrow 10:00" },
    { title: t("Landing page QA checklist"), who: "Maya Chen", status: "CHANGES_REQUESTED", priority: "URGENT", due: "Thu 12 Jun" },
    { title: t("Monthly performance report"), who: "Sam Ortiz", status: "NEW", priority: "LOW", due: "Mon 16 Jun" },
  ] as const;

  return (
    <div className="relative mx-auto w-full max-w-3xl text-start" aria-hidden>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold">{t("Needs your attention")}</p>
            <p className="text-xs text-muted">{t("4 tasks · 1 waiting for review")}</p>
          </div>
          <Badge tone="red">{t("1 help request")}</Badge>
        </div>
        <ul>
          {rows.map((row) => (
            <li key={row.title} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              <Avatar name={row.who} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{t(row.title)}</p>
                <p className="truncate text-xs text-muted">
                  {row.who} · {t(row.due)}
                </p>
              </div>
              <span className="hidden sm:block">
                <PriorityBadge priority={row.priority} />
              </span>
              <TaskStatusBadge status={row.status} />
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-6 -end-2 hidden w-64 animate-float rounded-xl border border-line bg-surface p-3.5 shadow-pop sm:block">
        <p className="text-xs font-medium text-muted">{t("Submission v2")}</p>
        <p className="mt-1 text-[13px] leading-snug">{t("Updated the hero crop and swapped the CTA colour as requested.")}</p>
        <div className="mt-3 flex gap-2">
          <span className={buttonClass({ size: "sm", className: "pointer-events-none flex-1" })}>{t("Approve")}</span>
          <span className={buttonClass({ size: "sm", variant: "secondary", className: "pointer-events-none flex-1" })}>{t("Request changes")}</span>
        </div>
      </div>
    </div>
  );
}

const steps = [
  { title: "Request access", body: "Tell us about your agency. Every workspace is approved by hand, so you start with a real conversation, not a credit-card form." },
  { title: "Set up your workspace", body: "Verify your email, choose a password, and your private workspace is ready. Your subscription is activated by our team." },
  { title: "Invite your team", body: "Add employees by email. They get a simple personal view with only the tasks assigned to them." },
  { title: "Run the work", body: "Create projects, assign tasks with deadlines, answer questions, and approve submissions from one review inbox." },
];

const features = [
  { icon: <FolderKanban />, title: "Projects with context", body: "Group tasks by client or campaign with dates, team members, progress and a running activity log." },
  { icon: <ListChecks />, title: "Tasks that say everything", body: "Description, checklist, attachments, tags, priority and deadline — the whole brief travels with the task." },
  { icon: <CalendarClock />, title: "Deadlines you can see", body: "List, board and calendar views plus reminders before a deadline and alerts the moment one slips." },
  { icon: <ClipboardCheck />, title: "A real review step", body: "Work is submitted, not just marked done. Approve it or request changes, with every version kept." },
  { icon: <LifeBuoy />, title: "Help requests", body: "When someone is blocked they say why in one click. It stays attached to the task until it is resolved." },
  { icon: <BellRing />, title: "Notifications that matter", body: "In-app and email alerts for assignments, submissions and reviews, with WhatsApp links for a quick nudge." },
];

const workflow = [
  { label: "Assigned", body: "The manager creates the task. The employee sees it immediately — no approval needed to begin." },
  { label: "In progress", body: "Work starts. Checklist items get ticked, questions go in comments." },
  { label: "Help requested", body: "Blocked? The employee flags it with a reason and the manager is notified." },
  { label: "Submitted", body: "Files and a note are sent for review. Earlier submissions are never overwritten." },
  { label: "Reviewed", body: "The manager approves or requests changes with written feedback." },
  { label: "Completed", body: "Approved work closes the task and updates project progress." },
];

const faqs = [
  { q: "Who is {brand} for?", a: "Marketing agencies and in-house marketing teams where one person hands out work and reviews it: a project manager, an account lead, a studio head." },
  { q: "How does pricing work?", a: "One fixed monthly subscription per workspace, regardless of how many tasks you create. We confirm the price with you when your request is approved." },
  { q: "Can employees see each other's work?", a: "No. Employees see only the tasks assigned to them. Managers see everything in their own workspace, and nothing in anyone else's." },
  { q: "What happens if a payment is late?", a: "Your workspace keeps working through a short grace period. After that it is suspended — not deleted. Everything is restored as soon as the subscription is renewed." },
  { q: "Is our data shared with other agencies?", a: "Never. Each workspace is isolated: projects, tasks, files, comments and activity are only reachable by members of that workspace." },
  { q: "Do we need to install anything?", a: "No. {brand} runs in the browser on desktop and mobile." },
];

export default async function LandingPage() {
  const t = await getT();
  return (
    <div className="bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5 sm:px-8">
          <Logo />
          <nav className="hidden flex-1 items-center gap-6 text-sm text-ink-soft md:flex" aria-label={t("Sections")}>
            <a href="#how-it-works" className="hover:text-ink">{t("How it works")}</a>
            <a href="#features" className="hover:text-ink">{t("Features")}</a>
            <a href="#workflow" className="hover:text-ink">{t("Workflow")}</a>
            <a href="#pricing" className="hover:text-ink">{t("Pricing")}</a>
            <a href="#faq" className="hover:text-ink">{t("FAQ")}</a>
          </nav>
          <div className="ms-auto flex items-center gap-1 sm:gap-2">
            <LanguageToggle />
            <Link href="/login" className={buttonClass({ variant: "ghost", size: "sm" })}>
              {t("Log in")}
            </Link>
            <Link href="/request-access" className={buttonClass({ size: "sm" })}>
              {t("Request access")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-14 text-center sm:px-8 sm:pt-20">
          <p className="mx-auto inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-soft">
            <span className="size-1.5 rounded-full bg-brand" />
            {t("Built for marketing agencies and in-house teams")}
          </p>
          <h1 className="anim-delay-1 mx-auto mt-5 max-w-3xl animate-fade-up text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[56px]">
            {t("Every brief, deadline and review in one calm workspace.")}
          </h1>
          <p className="anim-delay-2 mx-auto mt-5 max-w-xl animate-fade-up text-pretty text-base leading-relaxed text-ink-soft sm:text-lg">
            {BRAND.name} {t("helps your team organise projects, assign tasks, track deadlines, review work and communicate — without chasing updates across chat threads.")}
          </p>
          <div className="anim-delay-3 mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/request-access" className={buttonClass({ size: "lg" })}>
              {t("Request access")} <ArrowRight className="rtl:rotate-180" />
            </Link>
            <a href="#how-it-works" className={buttonClass({ size: "lg", variant: "secondary" })}>
              {t("See how it works")}
            </a>
          </div>
          <div className="anim-delay-4 mt-14 animate-fade-up sm:mt-16">
            <HeroPreview />
          </div>
        </section>

        {/* How it works */}
        <div className="border-y border-line bg-surface">
          <Section id="how-it-works" eyebrow={t("How it works")} title={t("From first request to finished campaign in four steps.")}>
            <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => (
                <li key={step.title}>
                  <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 text-[15px] font-semibold">{t(step.title)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t(step.body)}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        {/* Features */}
        <Section id="features" eyebrow={t("Features")} title={t("Everything a team needs to ship work. Nothing it doesn't.")} lead={t("No sprawling settings, no feature maze. A small set of tools that fit how marketing work actually moves.")}>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-surface p-6 transition-colors duration-200 hover:bg-paper">
                <div className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand [&_svg]:size-[18px]">{f.icon}</div>
                <h3 className="mt-4 text-[15px] font-semibold">{t(f.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t(f.body)}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Task workflow */}
        <div className="border-y border-line bg-surface">
          <Section id="workflow" eyebrow={t("Task workflow")} title={t("A clear path from assigned to approved.")} lead={t("Employees start immediately — there is no sign-off before work begins. The only gate is the one that matters: review.")}>
            <ol className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {workflow.map((step, i) => (
                <li key={step.label} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{i + 1}</span>
                  <div>
                    <h3 className="text-sm font-semibold">{t(step.label)}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t(step.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        {/* Team management + review system */}
        <Section eyebrow={t("Team & review")} title={t("Two views. One for running the team, one for doing the work.")}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md sm:p-8">
              <Users className="size-5 text-brand" />
              <h3 className="mt-4 text-lg font-semibold">{t("Team management without surveillance")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {t("Invite employees by email and see who is carrying what: active tasks, work waiting on you, and what was finished. No screenshots, no timers, no activity scores.")}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
                {["Email invitations with one-click setup", "A focused “My tasks” view for every employee", "Deactivate access without losing task history"].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md sm:p-8">
              <Upload className="size-5 text-brand" />
              <h3 className="mt-4 text-lg font-semibold">{t("A review inbox that keeps its history")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {t("Submissions arrive with files and a note. Approve in one click or send it back with specific feedback. Every round is kept, so “which version did we sign off?” always has an answer.")}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
                {["Images, video and documents on every submission", "Written feedback on each change request", "Full submission history on the task"].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Workspace & subscription */}
        <div className="border-y border-line bg-surface">
          <Section id="pricing" eyebrow={t("Workspaces & pricing")} title={t("One private workspace. One flat monthly price.")}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div className="space-y-6">
                {[
                  { icon: <ShieldCheck />, title: t("Isolated by design"), body: t("Your workspace is yours alone. Employees, projects, tasks, files and comments are never visible to another agency.") },
                  { icon: <Users />, title: t("Priced per workspace"), body: t("A fixed monthly subscription for each project manager's workspace. No per-task or per-project charges.") },
                  { icon: <MessageCircle />, title: t("Billing handled by people"), body: t("We confirm your plan and record payments directly with you. If a payment is late, a grace period applies before anything is paused — and your data is always preserved.") },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand [&_svg]:size-[18px]">{item.icon}</div>
                    <div>
                      <h3 className="text-[15px] font-semibold">{t(item.title)}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t(item.body)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-line bg-paper p-6 sm:p-8">
                <p className="text-sm font-semibold">{t("Workspace plan")}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{t("Flat monthly fee")}</p>
                <p className="mt-1 text-sm text-muted">{t("Confirmed with you when your request is approved.")}</p>
                <ul className="mt-6 space-y-2.5 text-sm text-ink-soft">
                  {["Unlimited projects and tasks", "Your whole team in one workspace", "Review workflow and submission history", "File attachments and notifications"].map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/request-access" className={buttonClass({ className: "mt-7 w-full" })}>
                  {t("Request access")}
                </Link>
              </div>
            </div>
          </Section>
        </div>

        {/* FAQ */}
        <Section id="faq" eyebrow={t("FAQ")} title={t("Questions, answered.")}>
          <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl border border-line bg-surface">
            {faqs.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex list-none items-center justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                  {t(item.q, { brand: BRAND.name })}
                  <span className="text-lg leading-none text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{t(item.a, { brand: BRAND.name })}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <div className="reveal rounded-3xl bg-brand px-6 py-14 text-center text-white sm:px-12">
            <h2 className="mx-auto max-w-xl text-balance text-2xl font-semibold leading-tight sm:text-[32px]">{t("Give your team one place to do its best work.")}</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/80">{t("Tell us about your agency and we'll set up your workspace.")}</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/request-access" className={buttonClass({ size: "lg", variant: "secondary", className: "border-transparent" })}>
                {t("Request access")} <ArrowRight className="rtl:rotate-180" />
              </Link>
              <Link href="/login" className={buttonClass({ size: "lg", variant: "ghost", className: "text-white hover:bg-white/10 hover:text-white" })}>
                {t("Log in")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <Logo />
            <p className="mt-2 text-[13px] text-muted">{t(BRAND.tagline)}.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft" aria-label={t("Footer")}>
            <a href="#features" className="hover:text-ink">{t("Features")}</a>
            <a href="#workflow" className="hover:text-ink">{t("Workflow")}</a>
            <a href="#faq" className="hover:text-ink">{t("FAQ")}</a>
            <Link href="/login" className="hover:text-ink">{t("Log in")}</Link>
            <Link href="/request-access" className="hover:text-ink">{t("Request access")}</Link>
          </nav>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto w-full max-w-6xl px-5 py-4 text-xs text-muted sm:px-8">
            © {new Date().getFullYear()} {BRAND.name}{t(". All rights reserved.")}
          </p>
        </div>
      </footer>
    </div>
  );
}
