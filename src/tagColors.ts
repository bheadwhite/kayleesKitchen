/**
 * The one place colour beyond the steel accent is allowed.
 *
 * The "Industry" system is deliberately mono — see the styling section of
 * CLAUDE.md — so this is a *closed* palette rather than a colour picker: eight
 * tints drawn at the same value as `steel-100`, each with a hairline border and
 * ink dark enough to read on it. An arbitrary hex would let a tag be drawn as
 * pure red on white, which is a different design system, and would have to be
 * contrast-checked on every render.
 *
 * Tags store the **id**, never the hex. Re-tuning a tint later is then an edit
 * to this file rather than a migration over every recipe.
 */
export interface TagColor {
  id: string
  label: string
  /** Chip fill. */
  bg: string
  /** Hairline, the same role as `divider` elsewhere. */
  border: string
  /** Label ink, chosen to clear 4.5:1 on `bg`. */
  text: string
}

export const TAG_COLORS: TagColor[] = [
  { id: "steel", label: "Steel", bg: "#eef6ff", border: "#94bce3", text: "#2c455d" },
  { id: "sage", label: "Sage", bg: "#edf3ea", border: "#a4c098", text: "#2f4527" },
  { id: "teal", label: "Teal", bg: "#e6f3f2", border: "#8bc0ba", text: "#1e4643" },
  { id: "amber", label: "Amber", bg: "#faf2e1", border: "#d9b471", text: "#5c4212" },
  { id: "clay", label: "Clay", bg: "#faeee9", border: "#dda491", text: "#68301f" },
  { id: "rose", label: "Rose", bg: "#fbebf0", border: "#dc9db4", text: "#63233a" },
  { id: "plum", label: "Plum", bg: "#f3edf6", border: "#bb9dc9", text: "#472a54" },
  { id: "slate", label: "Slate", bg: "#eceff1", border: "#a5b0b8", text: "#30383f" },
]

/** What an untagged-by-colour tag wears — the accent it would have had anyway. */
export const DEFAULT_TAG_COLOR = TAG_COLORS[0]

/** Unknown ids fall back rather than throwing: the palette may shrink. */
export const colorFor = (id?: string | null): TagColor =>
  TAG_COLORS.find((color) => color.id === id) ?? DEFAULT_TAG_COLOR

/** Inline styles, because Tailwind cannot build a class from a runtime value. */
export const chipStyle = (id?: string | null) => {
  const color = colorFor(id)
  return { backgroundColor: color.bg, borderColor: color.border, color: color.text }
}
