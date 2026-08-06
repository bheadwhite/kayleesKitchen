import clsx from "clsx"
import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"

import { SectionHeading } from "components"
import { useSessionUser } from "contexts/AuthProvider"
import { onAiUsageSnapshot, onDailyUsageSnapshot, onLoginEventsSnapshot } from "fire/services"
import { isAdmin } from "@/admin"
import { costOf, money, unpricedModels } from "@/aiPricing"
import { APP_BUILT_AT, APP_COMMIT, APP_VERSION, buildDate } from "@/version"
import type { AiUsageEvent, DailyUsage, LoginEvent, UsageBucket } from "@/types"

const number = new Intl.NumberFormat()

/** Which callable a row came from. A feed row must never read as a blank. */
const FEATURE_LABELS: Record<AiUsageEvent["feature"], string> = {
  assistant: "Chef · editor",
  chef: "Chef · recipe",
  image: "Image",
  shopping: "Shopping list",
  scaling: "Scaling rules",
}

const TABS = [
  { id: "spend", label: "Spend" },
  { id: "calls", label: "Calls" },
  { id: "logins", label: "Sign-ins" },
] as const

type TabId = (typeof TABS)[number]["id"]

/** Compact token counts — six-digit numbers make a phone table unreadable. */
const compact = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `${Math.round(value / 1_000)}k`
      : String(value)

const when = (at: Date | null) => (at == null ? "just now" : at.toLocaleString())

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className='border border-divider bg-surface px-3 py-2.5'>
    <div className='font-mono text-[10px] tracking-[0.14em] text-muted uppercase'>{label}</div>
    <div className='font-heading text-2xl font-semibold'>{value}</div>
    {hint && <div className='text-xs text-muted'>{hint}</div>}
  </div>
)

/**
 * Admin console: what the AI has been spending and who has been signing in.
 *
 * ⚠️ The `isAdmin` gate below hides the page; it does not protect the data.
 * Firestore rules are what stop another signed-in user reading `aiUsage` and
 * `loginEvents` straight from the SDK — see `firestore.rules.snippet`.
 *
 * **Three feeds, and the third is the one that answers "what does this cost".**
 * The raw feeds are capped (newest 200 AI calls / 100 sign-ins) because an
 * unbounded listener on a collection that grows with every call would
 * eventually pull the whole history onto a phone — so their totals are
 * "recent", not all-time, and the labels say so. The daily rollups
 * (`onDailyUsageSnapshot`) are what make a month readable: one document per
 * day, so sixty of them is two months rather than a slice of one week.
 *
 * Split across tabs because the call feed grows with traffic and was pushing
 * the totals — the thing you open this page for — off the top. The failure
 * count rides on the Calls tab so a problem stays visible without opening it.
 */
const Admin = () => {
  const user = useSessionUser()
  const [usage, setUsage] = useState<AiUsageEvent[]>([])
  const [logins, setLogins] = useState<LoginEvent[]>([])
  const [daily, setDaily] = useState<DailyUsage[]>([])
  // A denied read and an empty collection look identical otherwise — both show
  // nothing. This is the difference between "no calls yet" and "your rules are
  // rejecting me", which are very different problems.
  const [feedError, setFeedError] = useState<string | null>(null)
  const [failuresOnly, setFailuresOnly] = useState(false)
  const [tab, setTab] = useState<TabId>("spend")

  const allowed = isAdmin(user)

  useEffect(() => {
    if (!allowed) return
    const onError = (error: Error) => setFeedError(error.message)
    const stopUsage = onAiUsageSnapshot(setUsage, onError)
    const stopLogins = onLoginEventsSnapshot(setLogins, onError)
    const stopDaily = onDailyUsageSnapshot(setDaily, onError)
    return () => {
      stopUsage()
      stopLogins()
      stopDaily()
    }
  }, [allowed])

  // Counted over the whole 200-event window rather than the 25 rows drawn, so
  // the toggle can say how many it would find — a filter offering to show
  // failures without saying whether there are any is a guess.
  const failedCount = usage.filter((event) => !event.ok).length
  const shown = failuresOnly ? usage.filter((event) => !event.ok) : usage

  /**
   * Cost over the recorded days, priced at read time from `aiPricing`.
   *
   * Summed per (feature, model) rather than per feature, because the rate
   * belongs to the model — the moment one callable runs something cheaper than
   * another, pricing a feature from its bare token totals is silently wrong.
   */
  const spend = useMemo(() => {
    const perFeature = new Map<
      AiUsageEvent["feature"],
      { cost: number; calls: number; models: Set<string> }
    >()
    const allModels: Record<string, UsageBucket> = {}
    let total = 0

    for (const day of daily) {
      for (const [name, bucket] of Object.entries(day.features)) {
        if (bucket == null) continue
        const feature = name as AiUsageEvent["feature"]
        const seen = perFeature.get(feature) ?? { cost: 0, calls: 0, models: new Set<string>() }
        seen.calls += bucket.calls
        for (const [model, usage] of Object.entries(bucket.models)) {
          const cost = costOf(model, usage)
          seen.cost += cost
          total += cost
          seen.models.add(model)
        }
        perFeature.set(feature, seen)
      }
      for (const [model, bucket] of Object.entries(day.models)) {
        allModels[model] = bucket
      }
    }

    // Days that recorded something, not calendar days between first and last:
    // a quiet Tuesday with no cooking writes no document, and counting it as a
    // zero would drag the average down and understate what a busy week costs.
    const days = daily.length
    return {
      days,
      total,
      perDay: days > 0 ? total / days : 0,
      unpriced: unpricedModels(allModels),
      byFeature: [...perFeature.entries()]
        .map(([feature, s]) => ({
          feature,
          cost: s.cost,
          calls: s.calls,
          perCall: s.calls > 0 ? s.cost / s.calls : 0,
          models: [...s.models].sort(),
        }))
        .sort((a, b) => b.cost - a.cost),
    }
  }, [daily])

  const totals = useMemo(() => {
    const input = usage.reduce((n, e) => n + e.inputTokens, 0)
    const output = usage.reduce((n, e) => n + e.outputTokens, 0)
    const cacheRead = usage.reduce((n, e) => n + e.cacheReadTokens, 0)
    const failed = usage.filter((e) => !e.ok).length
    // Counted per feature rather than as "everything that wasn't the
    // assistant": a third caller landing in the else-branch of a two-way split
    // is the sort of thing a console reports confidently and wrongly.
    const assistant = usage.filter((e) => e.feature === "assistant").length
    const chef = usage.filter((e) => e.feature === "chef").length
    const images = usage.filter((e) => e.feature === "image").length
    const shopping = usage.filter((e) => e.feature === "shopping").length
    const scaling = usage.filter((e) => e.feature === "scaling").length
    const slowest = usage.reduce((n, e) => Math.max(n, e.ms), 0)
    return {
      input,
      output,
      cacheRead,
      failed,
      assistant,
      chef,
      images,
      shopping,
      scaling,
      slowest,
    }
  }, [usage])

  /**
   * Per-person totals, heaviest first. Input and output are kept apart because
   * they are priced apart — output costs several times input, so one number
   * hides which person is actually expensive.
   */
  const byPerson = useMemo(() => {
    type Tally = {
      calls: number
      input: number
      output: number
      cacheRead: number
      images: number
      failed: number
    }
    const counts = new Map<string, Tally>()

    usage.forEach((event) => {
      const key = event.email ?? "unknown"
      const seen: Tally = counts.get(key) ?? {
        calls: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        images: 0,
        failed: 0,
      }
      counts.set(key, {
        calls: seen.calls + 1,
        input: seen.input + event.inputTokens,
        output: seen.output + event.outputTokens,
        cacheRead: seen.cacheRead + event.cacheReadTokens,
        images: seen.images + (event.feature === "image" ? 1 : 0),
        failed: seen.failed + (event.ok ? 0 : 1),
      })
    })

    return [...counts.entries()].sort(
      ([, a], [, b]) => b.input + b.output - (a.input + a.output)
    )
  }, [usage])

  /**
   * One row per person rather than one per event. A raw feed of sign-ins is
   * mostly the same few names repeated — what the list is actually being read
   * for is who uses this and when they were last here, and that is a property
   * of the person, not of any single event.
   *
   * Most-recent first, and keyed by email with the uid as fallback so an
   * account with no address still gets its own row instead of being merged
   * with every other one.
   */
  const byUser = useMemo(() => {
    type Seen = { who: string; count: number; last: Date | null; methods: Set<string> }
    const people = new Map<string, Seen>()

    logins.forEach((event) => {
      const key = event.email ?? event.uid
      const seen = people.get(key)
      if (seen == null) {
        people.set(key, {
          who: key,
          count: 1,
          last: event.at,
          methods: new Set([event.method]),
        })
        return
      }
      seen.count += 1
      seen.methods.add(event.method)
      if (event.at != null && (seen.last == null || event.at > seen.last)) seen.last = event.at
    })

    return [...people.values()].sort(
      (a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0)
    )
  }, [logins])

  // A non-admin who guesses the URL goes back to their own profile rather than
  // being told the page exists.
  if (user != null && !allowed) return <Navigate to='/profile' replace />

  return (
    <div className='w-full max-w-[720px]'>
      <p className='font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
        Admin console
      </p>
      <h1 className='font-heading text-[30px] leading-tight font-bold'>Usage</h1>

      {feedError && (
        <p className='mt-3 border border-danger/40 bg-danger-100 px-3 py-2 text-sm text-danger'>
          Could not read the logs: {feedError}
        </p>
      )}

      {/* Tabs rather than one long scroll: the call feed is a per-row list that
       *  grows with traffic, and it was pushing the totals — the thing you open
       *  this page to read — further off the top every week. The failure count
       *  rides on the tab so a problem is visible without opening it, which is
       *  the one thing hiding a list behind a tab could otherwise cost. */}
      <div
        role='tablist'
        aria-label='Admin console sections'
        className='mt-4 flex gap-1 border-b border-divider'>
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              role='tab'
              type='button'
              aria-selected={active}
              onClick={() => setTab(id)}
              className={clsx(
                "-mb-px cursor-pointer touch-manipulation border-b-2 px-3 py-2 font-mono text-[11px] tracking-[0.14em] uppercase",
                active
                  ? "border-steel text-ink"
                  : "border-transparent text-muted hover:text-ink"
              )}>
              {label}
              {id === "calls" && failedCount > 0 && (
                <span className='text-danger'> · {number.format(failedCount)}</span>
              )}
            </button>
          )
        })}
      </div>

      {tab === "spend" && (
        <>
      <SectionHeading meta={`last ${usage.length} calls`}>AI</SectionHeading>
      <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <Stat label='Chef · editor' value={number.format(totals.assistant)} hint='calls' />
        <Stat label='Chef · recipe' value={number.format(totals.chef)} hint='calls' />
        <Stat label='Images' value={number.format(totals.images)} hint='generated' />
        <Stat label='Shopping list' value={number.format(totals.shopping)} hint='builds' />
        {/* This one should trend to nothing: a recipe's scaling rules are
         *  bought once per version and then answer every serving count. A
         *  number that keeps climbing means the cache is missing — most likely
         *  the two fingerprint implementations have drifted apart. */}
        <Stat label='Scaling rules' value={number.format(totals.scaling)} hint='recipes read' />
        <Stat label='Tokens in' value={compact(totals.input)} hint={`${compact(totals.cacheRead)} cached`} />
        <Stat label='Tokens out' value={compact(totals.output)} />
      </div>
      {(totals.failed > 0 || totals.slowest > 0) && (
        <p className='mt-2 text-sm text-muted'>
          {totals.failed > 0 && (
            <span className='text-danger'>{number.format(totals.failed)} failed · </span>
          )}
          slowest call {(totals.slowest / 1000).toFixed(1)}s
        </p>
      )}

      {/* The question the raw feed structurally cannot answer: what does this
       *  cost over time. Reads the daily rollups, so a month is thirty
       *  documents rather than a slice of the newest 200 calls. */}
      {spend.days > 0 && (
        <>
          <SectionHeading as='h3' meta={`${spend.days} day${spend.days === 1 ? "" : "s"}`}>
            Spend
          </SectionHeading>
          <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
            <Stat label='Recorded' value={money(spend.total)} hint={`${spend.days}d`} />
            <Stat label='Per day' value={money(spend.perDay)} hint='average' />
            {/* Projected from the observed average, and labelled as a
             *  projection: a fortnight of a household's cooking is a small
             *  sample and a holiday week would move it a lot. */}
            <Stat label='30 days' value={money(spend.perDay * 30)} hint='at this rate' />
            <Stat label='Per year' value={money(spend.perDay * 365)} hint='at this rate' />
          </div>

          {/* The number that decides anything: what each feature costs per
           *  call, and how often it runs. A feature that is expensive per call
           *  but runs twice a month is not where the money is. */}
          <ul className='mt-3'>
            {spend.byFeature.map(({ feature, cost, calls, perCall, models }) => (
              <li key={feature} className='border-b border-ink/8 py-2'>
                <div className='flex items-baseline justify-between gap-3'>
                  <span className='min-w-0 truncate font-medium'>
                    {FEATURE_LABELS[feature] ?? feature}
                  </span>
                  <span className='shrink-0 font-mono text-[13px]'>{money(cost)}</span>
                </div>
                <div className='font-mono text-[11px] text-muted'>
                  {number.format(calls)} call{calls === 1 ? "" : "s"} · {money(perCall)}/call ·{" "}
                  {models.join(", ")}
                </div>
              </li>
            ))}
          </ul>

          <p className='mt-2 text-xs text-muted'>
            Computed from recorded tokens at hand-maintained rates in{" "}
            <code className='font-mono'>src/aiPricing.ts</code> — an estimate for comparison,
            not an invoice.
            {spend.unpriced.length > 0 && (
              <span className='text-danger'>
                {" "}
                No rate on file for {spend.unpriced.join(", ")}, so those are counted as zero.
              </span>
            )}
          </p>
        </>
      )}

      {byPerson.length > 0 && (
        <>
          <SectionHeading as='h3' meta={`${byPerson.length} cooks`}>
            Tokens by person
          </SectionHeading>
          <ul>
            {byPerson.map(([email, stat]) => (
              <li key={email} className='border-b border-ink/8 py-2.5'>
                <div className='flex items-baseline justify-between gap-3'>
                  <span className='min-w-0 truncate font-medium'>{email}</span>
                  {/* In and out kept apart because they are priced apart —
                   *  output runs several times input, so a single combined
                   *  number hides who is actually expensive. */}
                  <span className='shrink-0 font-mono text-[13px]'>
                    {compact(stat.input)} in · {compact(stat.output)} out
                  </span>
                </div>
                <div className='font-mono text-[11px] text-muted'>
                  {number.format(stat.calls)} call{stat.calls === 1 ? "" : "s"}
                  {stat.images > 0 && ` · ${number.format(stat.images)} image`}
                  {stat.images > 1 && "s"}
                  {stat.cacheRead > 0 && ` · ${compact(stat.cacheRead)} cached`}
                  {stat.failed > 0 && (
                    <span className='text-danger'> · {number.format(stat.failed)} failed</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
        </>
      )}

      {/* On its own tab the feed no longer competes with the totals for the top
       *  of the page, so it renders the **whole** window rather than the first
       *  25 of it. The cap that matters is the listener's: `onAiUsageSnapshot`
       *  asks for the newest 200 and nothing here can widen that.
       *
       *  That bound is deliberate and stays — an unbounded listener on a
       *  collection that grows with every AI call would eventually pull the
       *  whole history onto a phone. What changed is that it no longer costs
       *  anything to lose the tail: `aiUsageDaily` keeps the totals forever, so
       *  this feed is free to be what it is good at — the newest 200 calls,
       *  with what the provider said about the ones that failed.
       *
       *  "Only failures" reaches that whole window rather than a page of it,
       *  and is hidden when nothing has failed, because a filter that can only
       *  ever empty the list is a control with one state. */}
      {tab === "calls" && (
        <>
      <SectionHeading
        as='h3'
        meta={
          failedCount > 0 ? (
            <button
              type='button'
              onClick={() => setFailuresOnly((on) => !on)}
              className={clsx(
                "cursor-pointer touch-manipulation font-mono text-[10px] tracking-[0.14em] uppercase",
                failuresOnly ? "text-danger" : "text-muted hover:text-ink"
              )}>
              {failuresOnly ? `${number.format(failedCount)} failed · show all` : "only failures"}
            </button>
          ) : undefined
        }>
        Recent AI calls
      </SectionHeading>
      {shown.length === 0 ? (
        <p className='py-4 text-muted'>Nothing recorded yet.</p>
      ) : (
        <ul>
          {shown.map((event) => (
            <li key={event.id} className='border-b border-ink/8 py-2.5'>
              <div className='flex items-baseline justify-between gap-3'>
                <span className='font-medium'>
                  {FEATURE_LABELS[event.feature] ?? event.feature}
                  {!event.ok && (
                    <span className='text-danger'>
                      {" · "}
                      {event.errorCode ?? "failed"}
                      {event.errorStatus != null && ` ${event.errorStatus}`}
                    </span>
                  )}
                </span>
                <span className='shrink-0 font-mono text-xs text-muted'>{when(event.at)}</span>
              </div>
              <div className='text-[13px] text-muted'>
                {event.email ?? "unknown"}
                {event.images > 0 && ` · ${event.images} photo${event.images === 1 ? "" : "s"}`}
                {event.inputTokens + event.outputTokens > 0 &&
                  ` · ${compact(event.inputTokens)} in / ${compact(event.outputTokens)} out`}
                {` · ${(event.ms / 1000).toFixed(1)}s`}
                {/* Only worth saying when it took more than one swing — every
                 *  successful first-try call would otherwise wear "1 try". */}
                {event.attempts != null && event.attempts > 1 && ` · ${event.attempts} tries`}
              </div>
              {/* What the provider actually said. `break-words` because a
               *  rejection quotes the offending value and will not wrap on its
               *  own; `whitespace-pre-wrap` because some arrive with newlines
               *  and reading them as one run-on line is the thing this is
               *  meant to fix. Events written before this was recorded simply
               *  have none, and show the code alone as they always did. */}
              {!event.ok && event.errorMessage && (
                <p className='mt-1 border-l-2 border-danger/40 pl-2 font-mono text-[11px] leading-snug break-words whitespace-pre-wrap text-danger'>
                  {event.errorMessage}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
        </>
      )}

      {tab === "logins" && (
        <>
      <SectionHeading
        meta={
          byUser.length > 0
            ? `${byUser.length} ${byUser.length === 1 ? "person" : "people"} · last ${logins.length}`
            : undefined
        }>
        Sign-ins
      </SectionHeading>
      {byUser.length === 0 ? (
        <p className='py-4 text-muted'>Nothing recorded yet.</p>
      ) : (
        <ul>
          {byUser.map((person) => (
            <li key={person.who} className='border-b border-ink/8 py-2.5'>
              <div className='flex items-baseline justify-between gap-3'>
                <span className='min-w-0 truncate font-medium'>{person.who}</span>
                <span className='shrink-0 font-mono text-[13px] text-muted'>
                  {number.format(person.count)} sign-in{person.count === 1 ? "" : "s"}
                </span>
              </div>
              <div className='font-mono text-[11px] text-muted'>
                {[...person.methods].join(", ")} · last {when(person.last)}
              </div>
            </li>
          ))}
        </ul>
      )}
        </>
      )}

      {/* Outside the tabs on purpose. The commit is what makes "did my fix
       *  actually deploy?" answerable from a phone, and an answer you have to
       *  go looking for behind a tab is one you stop checking. */}
      <SectionHeading>Build</SectionHeading>
      <dl className='pt-3 font-mono text-[13px]'>
        <div className='flex justify-between gap-3 border-b border-ink/8 py-1.5'>
          <dt className='text-muted'>version</dt>
          <dd>{APP_VERSION}</dd>
        </div>
        <div className='flex justify-between gap-3 border-b border-ink/8 py-1.5'>
          <dt className='text-muted'>commit</dt>
          <dd>{APP_COMMIT}</dd>
        </div>
        <div className='flex justify-between gap-3 border-b border-ink/8 py-1.5'>
          <dt className='text-muted'>built</dt>
          <dd>{buildDate() || APP_BUILT_AT || "—"}</dd>
        </div>
      </dl>
    </div>
  )
}

export default Admin
