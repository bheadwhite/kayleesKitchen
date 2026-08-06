import { describe, expect, it } from "vitest"

import {
  addDays,
  dayLabel,
  daysBetween,
  fromISODate,
  rangeOf,
  relativeDayLabel,
  toISODate,
} from "./calendar"

describe("toISODate / fromISODate", () => {
  it("reads the local day, not the UTC one", () => {
    // 6pm on the 6th, wherever this runs. `toISOString().slice(0, 10)` reports
    // the 7th for anywhere west of London — the bug this module exists for.
    expect(toISODate(new Date(2026, 7, 6, 18, 30))).toBe("2026-08-06")
  })

  it("round-trips without walking the date backwards", () => {
    expect(toISODate(fromISODate("2026-08-06"))).toBe("2026-08-06")
  })

  it("lands on local midnight", () => {
    const date = fromISODate("2026-08-06")
    expect(date.getHours()).toBe(0)
    expect(date.getDate()).toBe(6)
  })

  it("pads a single-digit month and day", () => {
    expect(toISODate(new Date(2026, 0, 9))).toBe("2026-01-09")
  })
})

describe("addDays", () => {
  it("crosses a month end", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01")
  })

  it("crosses a year end", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("knows about leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29")
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01")
  })

  it("goes backwards", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
  })
})

describe("rangeOf", () => {
  it("starts on the day given and runs forward", () => {
    expect(rangeOf("2026-08-06", 3)).toEqual(["2026-08-06", "2026-08-07", "2026-08-08"])
  })

  it("is empty for no days", () => {
    expect(rangeOf("2026-08-06", 0)).toEqual([])
  })
})

describe("daysBetween", () => {
  it("counts forwards and backwards", () => {
    expect(daysBetween("2026-08-06", "2026-08-09")).toBe(3)
    expect(daysBetween("2026-08-09", "2026-08-06")).toBe(-3)
    expect(daysBetween("2026-08-06", "2026-08-06")).toBe(0)
  })

  it("survives a clock change — a 23-hour day is still one day", () => {
    // Rounded rather than floored precisely so this holds wherever DST lands.
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2)
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2)
  })
})

describe("labels", () => {
  it("writes the day out the same way everywhere", () => {
    expect(dayLabel("2026-08-06")).toBe("Thu 6 Aug")
  })

  it("names the days a cook is deciding about", () => {
    expect(relativeDayLabel("2026-08-06", "2026-08-06")).toBe("Today")
    expect(relativeDayLabel("2026-08-07", "2026-08-06")).toBe("Tomorrow")
    expect(relativeDayLabel("2026-08-05", "2026-08-06")).toBe("Yesterday")
    expect(relativeDayLabel("2026-08-09", "2026-08-06")).toBe("Sun 9 Aug")
  })
})
