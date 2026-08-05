import clsx from "clsx"
import { NavLink } from "react-router-dom"

import { Avatar, EditIcon, PotIcon, firstNameFor, nameFor } from "components"
import { useAuthStatus, useSessionUser } from "contexts/AuthProvider"

const itemClass =
  "flex cursor-pointer touch-manipulation flex-col items-center justify-center gap-[5px] " +
  "border-t-2 px-1 text-[12.5px] leading-none font-medium tracking-[0.03em] transition-colors " +
  "hover:bg-steel-100 focus-visible:-outline-offset-2"

/**
 * The active tab takes a 2px steel rule along its top edge and a steel-tinted
 * fill, not just a color change: at 12.5px a tint alone is a weak signal, and
 * the rule reads as part of the same drawn grid as every other hairline here.
 */
const activeClass = "border-steel bg-steel-100 text-steel-700"
const idleClass = "border-transparent text-muted"

/** Icons are a fixed 23px here — a tab bar wants one mark size, not em sizing. */
const iconClass = "h-[23px] w-[23px] shrink-0"

/**
 * The app's primary navigation: a tab bar pinned to the bottom of the window.
 *
 * It replaced a hamburger menu in the header. Installed as a PWA this is a
 * thumb-reach app used with wet hands in a kitchen — the bottom edge is the one
 * place always reachable one-handed, and a tab bar shows where you are without
 * a tap, which a menu behind a button cannot.
 *
 * The third tab is the account, not a sign-out button. Signing out is one
 * mis-tap away from the tab you use most, and it is destructive in the way that
 * matters here — it drops half-typed work in the editor. It lives at the bottom
 * of <Profile> instead, where nothing else is adjacent.
 *
 * Every entry needs a session, so the whole bar is absent until there is one;
 * <Login> and <Register> get the full height of the screen.
 */
const NavBar = () => {
  const status = useAuthStatus()
  const user = useSessionUser()

  if (status !== "loggedIn") return null

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(itemClass, isActive ? activeClass : idleClass)

  return (
    <nav
      aria-label='Main'
      // `pb-[var(--sai-bottom)]` on the outer element and the fixed height on the
      // inner one: the bar's background has to reach the bottom of the screen,
      // but its buttons must sit above the home indicator, not under it.
      className='fixed right-0 bottom-0 left-0 z-40 border-t border-divider bg-ground pb-[var(--sai-bottom)]'>
      <div className='mx-auto grid h-[var(--navbar-h)] w-full max-w-[900px] grid-cols-3'>
        {/* `end`, or /recipes/new would light up both tabs. */}
        <NavLink to='/recipes' end className={linkClass}>
          <PotIcon className={iconClass} />
          Recipes
        </NavLink>
        <NavLink to='/recipes/new' className={linkClass}>
          <EditIcon className={iconClass} />
          Editor
        </NavLink>
        {/* The label prefixes rather than replaces the visible name: on its own,
         *  a nav item announced as "Sam" says nothing about where it goes, but
         *  an accessible name that omits the visible text breaks voice control. */}
        <NavLink to='/profile' aria-label={`Account: ${nameFor(user)}`} className={linkClass}>
          {/* `tone='current'` so the avatar's frame follows the tab's own
           *  active/idle color instead of staying steel on an idle tab. */}
          <Avatar user={user} tone='current' className='h-[23px] w-[23px] text-[11px]' />
          <span className='max-w-full truncate'>{firstNameFor(user)}</span>
        </NavLink>
      </div>
    </nav>
  )
}

export default NavBar
