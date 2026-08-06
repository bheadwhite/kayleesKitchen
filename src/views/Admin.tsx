import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"

import { SectionHeading } from "components"
import { useSessionUser } from "contexts/AuthProvider"
import { onAiUsageSnapshot, onLoginEventsSnapshot } from "fire/services"
import { isAdmin } from "@/admin"
import { APP_BUILT_AT, APP_COMMIT, APP_VERSION, buildDate } from "@/version"
import type { AiUsageEvent, LoginEvent } from "@/types"

const number = new Intl.NumberFormat()

/** Which callable a row came from. A feed row must never read as a blank. */
const FEATURE_LABELS: Record<AiUsageEvent["feature"], string> = {
  assistant: "Chef · editor",
  chef: "Chef · recipe",
  image: "Image",
}

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
 * Both feeds are capped server-side (newest 200 / 100), so the totals here are
 * "recent", not all-time. That is deliberate: an unbounded listener on a
 * collection that grows with every AI call would eventually pull the whole
 * history down to a phone. The stat labels say "recent" so the number is not
 * mistaken for a lifetime bill.
 */
const Admin = () => {
  const user = useSessionUser()
  const [usage, setUsage] = useState<AiUsageEvent[]>([])
  const [logins, setLogins] = useState<LoginEvent[]>([])
  // A denied read and an empty collection look identical otherwise — both show
  // nothing. This is the difference between "no calls yet" and "your rules are
  // rejecting me", which are very different problems.
  const [feedError, setFeedError] = useState<string | null>(null)

  const allowed = isAdmin(user)

  useEffect(() => {
    if (!allowed) return
    const onError = (error: Error) => setFeedError(error.message)
    const stopUsage = onAiUsageSnapshot(setUsage, onError)
    const stopLogins = onLoginEventsSnapshot(setLogins, onError)
    return () => {
      stopUsage()
      stopLogins()
    }
  }, [allowed])

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
    const slowest = usage.reduce((n, e) => Math.max(n, e.ms), 0)
    return { input, output, cacheRead, failed, assistant, chef, images, slowest }
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

      <SectionHeading meta={`last ${usage.length} calls`}>AI</SectionHeading>
      <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <Stat label='Chef · editor' value={number.format(totals.assistant)} hint='calls' />
        <Stat label='Chef · recipe' value={number.format(totals.chef)} hint='calls' />
        <Stat label='Images' value={number.format(totals.images)} hint='generated' />
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

      <SectionHeading as='h3'>Recent AI calls</SectionHeading>
      {usage.length === 0 ? (
        <p className='py-4 text-muted'>Nothing recorded yet.</p>
      ) : (
        <ul>
          {usage.slice(0, 25).map((event) => (
            <li key={event.id} className='border-b border-ink/8 py-2.5'>
              <div className='flex items-baseline justify-between gap-3'>
                <span className='font-medium'>
                  {FEATURE_LABELS[event.feature] ?? event.feature}
                  {!event.ok && <span className='text-danger'> · {event.errorCode ?? "failed"}</span>}
                </span>
                <span className='shrink-0 font-mono text-xs text-muted'>{when(event.at)}</span>
              </div>
              <div className='text-[13px] text-muted'>
                {event.email ?? "unknown"}
                {event.images > 0 && ` · ${event.images} photo${event.images === 1 ? "" : "s"}`}
                {event.inputTokens + event.outputTokens > 0 &&
                  ` · ${compact(event.inputTokens)} in / ${compact(event.outputTokens)} out`}
                {` · ${(event.ms / 1000).toFixed(1)}s`}
              </div>
            </li>
          ))}
        </ul>
      )}

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
