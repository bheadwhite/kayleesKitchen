import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import SessionSheet from "./SessionSheet"
import type {
  PlanningSession,
  SessionInvite,
  SessionMember,
  UserProfile,
} from "@/types"

const me: SessionMember = { uid: "u1", name: "Brent", email: "bhead@example.test" }

const session = {
  id: "s1",
  name: "Whiteheads",
  ownerUid: "u1",
  covers: 5,
  memberUids: ["u1"],
  members: [me],
  createdAt: null,
} as unknown as PlanningSession

const person = (firstName: string, lastName: string, email: string): UserProfile =>
  ({ firstName, lastName, email }) as UserProfile

const ask = (toEmail: string): SessionInvite =>
  ({ id: `${toEmail}_s1`, sessionId: "s1", toEmail }) as SessionInvite

const show = (people: UserProfile[], onInvite = vi.fn(), asked: SessionInvite[] = []) => {
  render(
    <SessionSheet
      open
      onClose={vi.fn()}
      sessions={[session]}
      current={session}
      me={me}
      people={people}
      asked={asked}
      onPick={vi.fn()}
      onStart={vi.fn()}
      onInvite={onInvite}
      onLeave={vi.fn()}
      onDelete={vi.fn()}
      iOwnThis
      plannedCount={0}
      itemCount={0}
      isBusy={false}
    />
  )
  return onInvite
}

const search = () => screen.getByLabelText(/search people/i)

const twoKaylees = [
  person("Kaylee", "Whitehead", "kaylee.whitehead1@gmail.com"),
  person("Kaylee", "Whitehead", "kaylee.w@example.test"),
]

/**
 * One profile per *address* is an invariant. One profile per *name* is not, and
 * must not be — two people can be called the same thing and both belong in this
 * list. What the picker owes them is a way to tell which is which: an invite
 * sent to the wrong row reaches a real person who is not the one meant.
 */
describe("who a row is", () => {
  it("carries the address under every name", async () => {
    show(twoKaylees)
    await userEvent.type(search(), "kay")

    expect(screen.getAllByText("Kaylee Whitehead")).toHaveLength(2)
    // The address is what the invite is addressed to, so it is what the row
    // has to show.
    expect(screen.getByText("kaylee.whitehead1@gmail.com")).toBeInTheDocument()
    expect(screen.getByText("kaylee.w@example.test")).toBeInTheDocument()
  })

  it("does not print the address twice when it is standing in for a missing name", async () => {
    show([person("", "", "nameless@example.test")])
    await userEvent.type(search(), "nameless")

    expect(screen.getAllByText("nameless@example.test")).toHaveLength(1)
  })

  it("gives each Invite button a label naming a different person", async () => {
    show(twoKaylees)
    await userEvent.type(search(), "kay")

    // Two buttons reading "Ask Kaylee Whitehead into Whiteheads" is the same
    // bug again for anyone not looking at the screen.
    const labels = screen
      .getAllByRole("button", { name: /^Ask / })
      .map((button) => button.getAttribute("aria-label"))
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("invites the address belonging to the row that was pressed", async () => {
    const onInvite = show(twoKaylees)
    await userEvent.type(search(), "kay")
    await userEvent.click(screen.getByRole("button", { name: /kaylee\.w@example\.test/ }))

    expect(onInvite).toHaveBeenCalledWith("kaylee.w@example.test")
  })
})

describe("finding someone", () => {
  const roster = [
    person("Kaylee", "Whitehead", "kaylee.whitehead1@gmail.com"),
    person("Ryan", "Tarver", "ryan.tarver21@gmail.com"),
  ]

  it("matches a first name", async () => {
    show(roster)
    await userEvent.type(search(), "kaylee")

    expect(screen.getByRole("button", { name: /kaylee\.whitehead1/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /ryan/ })).not.toBeInTheDocument()
  })

  it("matches a last name", async () => {
    show(roster)
    await userEvent.type(search(), "tarver")

    expect(screen.getByRole("button", { name: /ryan\.tarver21/ })).toBeInTheDocument()
  })

  it("matches an address, including the part after the @", async () => {
    show(roster)
    await userEvent.type(search(), "gmail.com")

    expect(screen.getAllByRole("button", { name: /^Ask / })).toHaveLength(2)
  })

  it("ignores the case of a pasted address", async () => {
    show(roster)
    // Phones capitalise, and a copied address arrives however it was written.
    await userEvent.type(search(), "Kaylee.Whitehead1@GMAIL.com")

    expect(screen.getByRole("button", { name: /kaylee\.whitehead1/ })).toBeInTheDocument()
  })

  it("says so when nobody matches, rather than offering the wrong person", async () => {
    show(roster)
    await userEvent.type(search(), "nobody@example.test")

    expect(screen.queryByRole("button", { name: /^Ask / })).not.toBeInTheDocument()
    expect(screen.getByText(/need an account/i)).toBeInTheDocument()
  })
})

/**
 * Pressing Invite used to leave nothing behind: the sheet looked identical
 * afterwards, and asking again was the only way to find out you already had.
 */
describe("asks already sent", () => {
  const roster = [
    person("Kaylee", "Whitehead", "kaylee.whitehead1@gmail.com"),
    person("Ryan", "Tarver", "ryan.tarver21@gmail.com"),
  ]

  it("lists whoever has been asked alongside the members", () => {
    show(roster, vi.fn(), [ask("kaylee.whitehead1@gmail.com")])

    expect(screen.getByText("Kaylee Whitehead")).toBeInTheDocument()
    expect(screen.getByText("asked")).toBeInTheDocument()
    // Counted apart from the members: they are not in yet.
    expect(screen.getByText(/1 in · 1 asked/)).toBeInTheDocument()
  })

  it("does not offer to ask someone who is already waiting", async () => {
    show(roster, vi.fn(), [ask("kaylee.whitehead1@gmail.com")])
    await userEvent.type(search(), "kaylee")

    expect(screen.queryByRole("button", { name: /^Ask /})).not.toBeInTheDocument()
    expect(screen.getByText(/need an account/i)).toBeInTheDocument()
  })

  it("matches an ask to its person however the address was cased", () => {
    // An invite written before addresses were normalised still names a person.
    show(roster, vi.fn(), [ask("Kaylee.Whitehead1@gmail.com")])

    expect(screen.getByText("Kaylee Whitehead")).toBeInTheDocument()
  })

  it("falls back to the address when no profile matches the ask", () => {
    show(roster, vi.fn(), [ask("stranger@example.test")])

    expect(screen.getByText("stranger@example.test")).toBeInTheDocument()
  })

  it("still offers everybody who has not been asked", async () => {
    show(roster, vi.fn(), [ask("kaylee.whitehead1@gmail.com")])
    await userEvent.type(search(), "ryan")

    expect(screen.getByRole("button", { name: /ryan\.tarver21/ })).toBeInTheDocument()
  })
})
