import { describe, expect, it } from "vitest"

import { UndoStack } from "./UndoStack"

describe("UndoStack", () => {
  it("has nothing to do when empty", () => {
    const stack = new UndoStack<string>()

    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)
    expect(stack.undo("a")).toBeUndefined()
    expect(stack.redo("a")).toBeUndefined()
  })

  it("walks back and forward through recorded states", () => {
    const stack = new UndoStack<string>()
    stack.record("a") // about to become b
    stack.record("b") // about to become c

    expect(stack.undo("c")).toBe("b")
    expect(stack.undo("b")).toBe("a")
    expect(stack.canUndo).toBe(false)

    expect(stack.redo("a")).toBe("b")
    expect(stack.redo("b")).toBe("c")
    expect(stack.canRedo).toBe(false)
  })

  it("makes redo unreachable once a new edit branches off an undo", () => {
    const stack = new UndoStack<string>()
    stack.record("a")
    stack.record("b")

    expect(stack.undo("c")).toBe("b")
    expect(stack.canRedo).toBe(true)

    // A new edit from here: "c" and this new state are two different futures,
    // and nothing can reconcile them. The abandoned branch is gone.
    stack.record("b")

    expect(stack.canRedo).toBe(false)
    expect(stack.redo("d")).toBeUndefined()
  })

  it("drops the oldest step once it is full", () => {
    const stack = new UndoStack<number>(3)
    for (let i = 0; i < 5; i += 1) stack.record(i)

    expect(stack.depth.undo).toBe(3)
    // 0 and 1 fell off the bottom; 2 is as far back as it goes.
    expect(stack.undo(5)).toBe(4)
    expect(stack.undo(4)).toBe(3)
    expect(stack.undo(3)).toBe(2)
    expect(stack.canUndo).toBe(false)
  })

  it("forgets both directions when cleared", () => {
    const stack = new UndoStack<string>()
    stack.record("a")
    stack.undo("b")
    stack.clear()

    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)
  })
})
