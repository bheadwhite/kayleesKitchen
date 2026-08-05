import clsx from "clsx"
import { useState } from "react"

import type { SessionUser } from "@/types"

interface AvatarProps {
  user: SessionUser | null
  /**
   * `steel` frames the avatar in the accent — the default, and what a standalone
   * avatar wants. `current` inherits the parent's color so a nav tab can tint
   * the frame along with its label.
   */
  tone?: "steel" | "current"
  /** Tailwind size classes — the call sites want very different scales. */
  className?: string
}

/**
 * Initials from a display name, falling back to the email's local part so an
 * account that never got a profile document still shows a letter rather than a
 * blank square. Two letters at most: three initials are unreadable at 23px.
 */
export const initialsFor = (user: SessionUser | null): string => {
  const source = user?.displayName?.trim() || user?.email?.split("@")[0] || ""
  const words = source.split(/[\s._-]+/).filter(Boolean)
  if (words.length === 0) return "?"
  const letters = words.length === 1 ? words[0].slice(0, 1) : words[0][0] + words[1][0]
  return letters.toUpperCase()
}

/** The name to show beside or under the avatar. Never the raw email domain. */
export const nameFor = (user: SessionUser | null): string =>
  user?.displayName?.trim() || user?.email?.split("@")[0] || "Account"

/** Just the first word of it — all a 12.5px nav tab has room for. */
export const firstNameFor = (user: SessionUser | null): string =>
  nameFor(user).split(/\s+/)[0]

/**
 * The user's Google picture, or their initials in a hairline square.
 *
 * Square and framed, like every other object in this system — a round avatar
 * would be the only circle on the page. The image is swapped out for the
 * initials on `onError` as well as when there is no URL: Google's
 * `lh3.googleusercontent.com` links do go stale, and a broken-image glyph in
 * the nav bar is worse than initials.
 */
const Avatar = ({ user, tone = "steel", className }: AvatarProps) => {
  const [failed, setFailed] = useState(false)
  const initials = initialsFor(user)
  const showImage = Boolean(user?.photoURL) && !failed

  return (
    <span
      className={clsx(
        // No `overflow-hidden`: the photo is already cropped by `object-cover`,
        // and clipping would eat the registration marks when a caller frames
        // this with `.blueprint` (the profile page does).
        "inline-flex shrink-0 items-center justify-center border",
        "font-heading font-semibold tracking-[0.04em] select-none",
        tone === "steel" ? "border-steel text-steel-700" : "border-current text-current",
        showImage ? "bg-surface" : tone === "steel" && "bg-steel-100",
        className ?? "h-7 w-7 text-[11px]"
      )}
      // The name is always rendered as text next to this, so the picture itself
      // is decoration — announcing the initials again would just be noise.
      aria-hidden='true'>
      {showImage ? (
        <img
          src={user?.photoURL ?? undefined}
          alt=''
          referrerPolicy='no-referrer'
          onError={() => setFailed(true)}
          className='h-full w-full object-cover'
        />
      ) : (
        initials
      )}
    </span>
  )
}

export default Avatar
