import { describe, expect, it } from "vitest"

import { isValidEmail, normaliseEmail } from "./email"

describe("normaliseEmail", () => {
  it("folds the case, so one person is one person", () => {
    // The pair that put Kaylee in the invite picker twice. Firebase had already
    // decided these were one account; only the profile disagreed.
    expect(normaliseEmail("Kaylee.Whitehead1@gmail.com")).toBe(
      normaliseEmail("kaylee.whitehead1@gmail.com")
    )
  })

  it("trims, because a pasted address carries what came with it", () => {
    expect(normaliseEmail("  cook@example.test\n")).toBe("cook@example.test")
  })
})

describe("isValidEmail", () => {
  it("rejects the address that got into the database", () => {
    // `maint .8@gmail.com`. The old pattern's `[^@]+` matched the space, and a
    // profile nobody could reach sat in the people picker until it was noticed.
    expect(isValidEmail("maint .8@gmail.com")).toBe(false)
    expect(isValidEmail("maint.8@gmail.com")).toBe(true)
  })

  it("is anchored, so an address inside a sentence is not an address", () => {
    // The old pattern was unanchored and accepted all of these.
    expect(isValidEmail("ask maint@gmail.com about it")).toBe(false)
    expect(isValidEmail("maint@gmail.com,gary@gmail.com")).toBe(false)
  })

  it("wants a domain that could resolve", () => {
    expect(isValidEmail("cook@example")).toBe(false)
    expect(isValidEmail("cook@.test")).toBe(false)
    expect(isValidEmail("cook@example..test")).toBe(false)
    expect(isValidEmail("cook@example.test.")).toBe(false)
    expect(isValidEmail("@example.test")).toBe(false)
    expect(isValidEmail("cook@@example.test")).toBe(false)
  })

  it("takes ordinary addresses, including the awkward-looking ones", () => {
    expect(isValidEmail("cook@example.test")).toBe(true)
    expect(isValidEmail("first.last+weeknights@example.co.uk")).toBe(true)
    expect(isValidEmail("a@b.co")).toBe(true)
    // Trimmed before it is judged: whitespace off a paste is not a typo to
    // report back, it is whitespace to drop.
    expect(isValidEmail("  cook@example.test  ")).toBe(true)
  })
})
