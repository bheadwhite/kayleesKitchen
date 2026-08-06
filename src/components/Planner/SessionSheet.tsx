import clsx from "clsx"
import { useEffect, useState } from "react"

import { Button, CheckIcon, Dialog, SectionHeading } from "components"
import CoversStepper from "./CoversStepper"
import { DEFAULT_COVERS } from "presenters/PlannerPresenter"
import type { PlanningSession, SessionMember, UserProfile } from "@/types"

interface SessionSheetProps {
  open: boolean
  onClose: () => void
  sessions: PlanningSession[]
  current: PlanningSession | null
  me: SessionMember | null
  /** Everyone with an account, so a session can ask them in. */
  people: UserProfile[]
  onPick: (sessionId: string) => void
  onStart: (name: string, covers: number) => void
  onInvite: (email: string) => void
  onLeave: () => void
  onDelete: () => void
  /** Whoever started it deletes; everybody else leaves. */
  iOwnThis: boolean
  /** What deletion would take with it, so the confirmation can say. */
  plannedCount: number
  itemCount: number
  isBusy: boolean
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?"

const Person = ({
  name,
  meta,
  dashed = false,
  action,
}: {
  name: string
  meta?: string
  dashed?: boolean
  action?: React.ReactNode
}) => (
  <li className='flex min-h-[54px] items-center gap-3 border-b border-ink/10 py-2 last:border-b-0'>
    <span
      className={clsx(
        "grid h-9 w-9 shrink-0 place-items-center border font-heading text-[13px] font-semibold",
        dashed ? "border-dashed border-divider text-muted" : "border-steel text-steel-700"
      )}>
      {initialsOf(name)}
    </span>
    <span className='min-w-0 flex-1 truncate text-[16px]'>{name}</span>
    {meta && <span className='shrink-0 font-mono text-[11px] text-muted'>{meta}</span>}
    {action}
  </li>
)

/**
 * Switching between the sessions somebody is in, and starting or leaving one.
 *
 * A sheet from the bottom rather than a page: switching session is not
 * navigation — the Plan tab is the same tab either way — and coming back to
 * exactly the week you were looking at is the point. It doubles as the members
 * screen because "who is in this" and "which one am I in" are the same question
 * asked from two directions.
 */
const SessionSheet = ({
  open,
  onClose,
  sessions,
  current,
  me,
  people,
  onPick,
  onStart,
  onInvite,
  onLeave,
  onDelete,
  iOwnThis,
  plannedCount,
  itemCount,
  isBusy,
}: SessionSheetProps) => {
  const [name, setName] = useState("")
  const [covers, setCovers] = useState(DEFAULT_COVERS)
  const [ending, setEnding] = useState(false)
  const [search, setSearch] = useState("")

  // Disarm when the sheet closes or the session changes under it — a primed
  // "Delete it" must never be left sitting over a different session's name,
  // and a half-typed search belongs to the session it was typed in.
  useEffect(() => {
    setEnding(false)
    setSearch("")
  }, [open, current?.id])

  const start = () => {
    if (name.trim() === "") return
    onStart(name, covers)
    setName("")
    setCovers(DEFAULT_COVERS)
  }

  const invitable = people.filter(
    (person) => person.email !== me?.email && !current?.members.some((m) => m.email === person.email)
  )

  /**
   * Matched on name *and* address, because a household knows each other by
   * first name but an account may carry only an email — and "b" should find
   * "B W" as readily as "bheadwhite@…". Capped so the sheet cannot grow a
   * scrolling roster by another route.
   */
  const matches = (() => {
    const needle = search.trim().toLowerCase()
    if (needle === "") return []
    return invitable
      .filter((person) =>
        `${person.firstName} ${person.lastName} ${person.email}`.toLowerCase().includes(needle)
      )
      .slice(0, 6)
  })()

  return (
    <Dialog open={open} onClose={onClose} title='Planning sessions'>
      <p className='-mt-1 mb-2 text-muted'>Each one keeps its own week and list.</p>

      {sessions.length === 0 ? (
        <p className='py-2'>
          You're not in any session yet. Start one below, or take an ask from your own tab.
        </p>
      ) : (
        <ul className='-mx-1'>
          {sessions.map((session) => {
            const isCurrent = session.id === current?.id
            return (
              <li key={session.id} className='border-b border-ink/10 last:border-b-0'>
                <button
                  type='button'
                  onClick={() => {
                    onPick(session.id)
                    onClose()
                  }}
                  className={clsx(
                    "flex w-full cursor-pointer touch-manipulation items-center gap-3 px-1 py-3 text-left",
                    isCurrent ? "bg-steel-100" : "hover:bg-ink/5"
                  )}>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate font-heading text-[19px] font-semibold'>
                      {session.name}
                    </span>
                    <span className='block truncate text-[13px] text-muted'>
                      {session.members.length === 1
                        ? "just you"
                        : `${session.members.length} people`}{" "}
                      · cooking for {session.covers}
                    </span>
                  </span>
                  {isCurrent && <CheckIcon className='h-5 w-5 shrink-0 text-steel' />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <SectionHeading>Start a new one</SectionHeading>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") start()
        }}
        placeholder='Weeknights, Sunday supper…'
        aria-label='Name for the new session'
        className='mt-2 h-12 w-full border border-divider bg-surface px-3 text-base hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0'
      />
      <div className='mt-2 flex items-center gap-2'>
        <CoversStepper value={covers} onChange={setCovers} noun='at the table' />
        <Button
          variant='primary'
          onClick={start}
          disabled={isBusy || name.trim() === ""}
          className='mt-0 mr-0 h-11 flex-1'>
          Start
        </Button>
      </div>
      <p className='mt-2 text-[13px] leading-snug text-muted'>
        Starts empty with you in it, cooking for {covers}. Ask people in once it exists.
      </p>

      {current != null && (
        <>
          <SectionHeading meta={`${current.members.length} in`}>In this session</SectionHeading>
          <ul>
            {current.members.map((member) => (
              <Person
                key={member.uid}
                name={member.uid === me?.uid ? `${member.name} (you)` : member.name}
                meta={member.uid === current.ownerUid ? "started it" : undefined}
              />
            ))}
          </ul>

          {invitable.length > 0 && (
            <>
              <SectionHeading>Ask someone in</SectionHeading>
              {/* Type to narrow rather than listing everybody: the roster grows
               *  with the app and a session sheet is not the place to scroll
               *  past it. Nothing is offered until something is typed, so this
               *  costs three lines however many accounts exist. */}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Start typing a name…'
                aria-label='Search people to ask in'
                className='mt-2 h-11 w-full border border-divider bg-surface px-3 text-base hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0'
              />

              {search.trim() !== "" && (
                <ul className='mt-1 max-h-[184px] overflow-y-auto'>
                  {matches.length === 0 ? (
                    <li className='py-3 text-[13px] text-muted'>
                      Nobody here matches "{search.trim()}". They need an account before
                      they can be asked in.
                    </li>
                  ) : (
                    matches.map((person) => {
                      const name =
                        `${person.firstName} ${person.lastName}`.trim() || person.email
                      return (
                        <Person
                          key={person.email}
                          name={name}
                          dashed
                          action={
                            <Button
                              onClick={() => {
                                onInvite(person.email)
                                setSearch("")
                              }}
                              className='mt-0 mr-0'
                              aria-label={`Ask ${name} into ${current.name}`}>
                              Invite
                            </Button>
                          }
                        />
                      )
                    })
                  )}
                </ul>
              )}

              <p className='mt-2 text-[13px] leading-snug text-muted'>
                The ask lands on their own tab and waits there until they take it. Once
                they're in they see this week and the shopping list — never your other
                sessions.
              </p>
            </>
          )}

          {/* Two different endings, and they are not the same act. Whoever
           *  started a session can delete it, taking the week and the list with
           *  it; everybody else leaves, which takes them out without taking
           *  anything away from the people still cooking it. */}
          {ending ? (
            <div className='mt-6 border border-danger/40 bg-danger-100 p-3'>
              <p className='font-heading text-[17px] font-semibold text-danger'>
                {iOwnThis ? `Delete ${current.name}?` : `Leave ${current.name}?`}
              </p>
              <p className='mt-1.5 text-sm'>
                {iOwnThis ? (
                  <>
                    This deletes the session for everyone in it —{" "}
                    <strong>
                      {plural(plannedCount, "planned meal")} and{" "}
                      {plural(itemCount, "item")} on the shopping list
                    </strong>
                    , plus any asks still waiting. It cannot be undone. Your recipes are
                    not touched.
                  </>
                ) : (
                  <>
                    The session carries on without you, and you'd need another ask to get
                    back in. Nothing is deleted.
                  </>
                )}
              </p>
              <div className='mt-3 grid grid-cols-2 gap-2'>
                <Button onClick={() => setEnding(false)} className='mt-0 mr-0 bg-ground'>
                  Keep it
                </Button>
                <Button
                  danger
                  variant='primary'
                  disabled={isBusy}
                  onClick={() => {
                    setEnding(false)
                    if (iOwnThis) onDelete()
                    else onLeave()
                  }}
                  className='mt-0 mr-0'>
                  {iOwnThis ? "Delete it" : "Leave"}
                </Button>
              </div>
            </div>
          ) : (
            <Button danger onClick={() => setEnding(true)} className='mt-6 w-full border-dashed'>
              {iOwnThis ? `Delete ${current.name}` : `Leave ${current.name}`}
            </Button>
          )}
        </>
      )}
    </Dialog>
  )
}

export default SessionSheet
