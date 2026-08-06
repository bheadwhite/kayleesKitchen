import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import {
  Avatar,
  Button,
  ChevronRightIcon,
  Dialog,
  LogoutIcon,
  SectionHeading,
  nameFor,
} from "components"
import { useAuthPresenter, useAuthStatus, useSessionUser } from "contexts/AuthProvider"
import useUsersRecipes from "hooks/useUsersRecipes"
import { buildDate, buildLabel } from "@/version"
import { onRecipesSnapshot } from "fire/services"
import type { Recipe } from "@/types"

const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  return (words.length === 1 ? words[0].slice(0, 1) : words[0][0] + words[1][0]).toUpperCase()
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

/**
 * Account settings: who you are, what you have written, and who else cooks here.
 *
 * It is also where signing out lives. The nav bar used to carry a Logout tab,
 * and one mis-tap next to "Editor" ended the session and dropped whatever was
 * half-typed there. A navigation away, behind a confirm, costs a deliberate
 * user two taps and saves an accidental one from losing work.
 *
 * The profile itself is not editable here: the display name is assembled from
 * the Firestore `users` document (see `AuthPresenter._toSessionUser`), and
 * nothing in the app writes it back yet.
 */
const Profile = () => {
  const auth = useAuthPresenter()
  const status = useAuthStatus()
  const user = useSessionUser()
  const navigate = useNavigate()
  const myRecipes = useUsersRecipes()
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  // The household is everyone who has contributed, which only the full list
  // knows — `useUsersRecipes` is scoped to one email by design.
  useEffect(() => onRecipesSnapshot(setAllRecipes), [])

  const household = useMemo(() => {
    const counts = new Map<string, number>()
    allRecipes.forEach((recipe) => {
      const cook = recipe.contributor?.trim()
      if (cook) counts.set(cook, (counts.get(cook) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }))
  }, [allRecipes])

  const mine = useMemo(
    () => myRecipes.filter((recipe) => Boolean(recipe.title)),
    [myRecipes]
  )

  const handleSignOut = async () => {
    setConfirmOpen(false)
    try {
      await auth.logOut()
      navigate("/login")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.")
    }
  }

  return (
    <div className='w-full max-w-[560px]'>
      <div className='flex items-center gap-4 pt-2'>
        <Avatar
          user={user}
          className='blueprint h-[72px] w-[72px] text-[26px] tracking-[0.06em]'
        />
        <div className='min-w-0'>
          <p className='truncate font-heading text-[22px] leading-tight font-semibold'>
            {nameFor(user)}
          </p>
          {user?.email && <p className='mt-0.5 truncate text-sm text-ink/70'>{user.email}</p>}
          <p className='mt-0.5 font-mono text-xs text-muted'>
            {plural(mine.length, "recipe")} contributed
          </p>
        </div>
      </div>

      <SectionHeading meta={plural(mine.length, "recipe")}>Your recipes</SectionHeading>
      {mine.length === 0 ? (
        <p className='py-4 text-muted'>Nothing yet — the editor is the middle tab.</p>
      ) : (
        <ul>
          {mine.map((recipe) => (
            <li key={recipe.id ?? recipe.title}>
              <button
                type='button'
                onClick={() => navigate(`/recipes?open=${encodeURIComponent(recipe.id ?? "")}`)}
                className='flex w-full cursor-pointer items-center gap-3 border-b border-ink/10 py-3.5 text-left hover:bg-ink/4'>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-heading text-lg font-semibold'>
                    {recipe.title}
                  </span>
                  <span className='text-[13.5px] text-muted'>
                    {plural(recipe.ingredients?.length ?? 0, "ingredient")} ·{" "}
                    {plural(recipe.directions?.length ?? 0, "section")}
                  </span>
                </span>
                <ChevronRightIcon className='h-4 w-4 shrink-0 text-muted' />
              </button>
            </li>
          ))}
        </ul>
      )}

      <SectionHeading meta={plural(household.length, "cook")}>The household</SectionHeading>
      {household.length === 0 ? (
        <p className='py-4 text-muted'>No recipes have been contributed yet.</p>
      ) : (
        <ul>
          {household.map((cook) => (
            <li key={cook.name}>
              {/* Tapping a cook filters the list to them — the same thing you
               *  would otherwise do by typing their name into the search box. */}
              <button
                type='button'
                onClick={() => navigate(`/recipes?cook=${encodeURIComponent(cook.name)}`)}
                className='flex w-full cursor-pointer items-center gap-3 border-b border-ink/10 py-3 text-left hover:bg-ink/4'>
                <span
                  aria-hidden='true'
                  className='flex h-[38px] w-[38px] shrink-0 items-center justify-center border border-steel font-heading text-sm font-semibold tracking-[0.04em] text-steel-700'>
                  {initialsOf(cook.name)}
                </span>
                <span className='min-w-0 flex-1 truncate text-[16.5px]'>
                  {cook.name}
                  {user?.displayName === cook.name && (
                    <span className='text-muted'> (you)</span>
                  )}
                </span>
                <span className='shrink-0 font-mono text-[13px] text-muted'>
                  {plural(cook.count, "recipe")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The admin console is a nav tab now, not a row here — two entry points
       *  to the same page in a four-item app is clutter, not convenience. */}

      <SectionHeading>Session</SectionHeading>
      <div className='pt-3'>
        <Button
          danger
          onClick={() => setConfirmOpen(true)}
          disabled={status === "loggingOut"}
          className='mt-0 ml-0'>
          <LogoutIcon />
          {status === "loggingOut" ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      {/* Which build is running. Bottom of the page and quiet, but always
       *  present — "did my fix actually deploy?" should be answerable from a
       *  phone without asking anyone. */}
      <p className='mt-8 border-t border-divider pt-3 font-mono text-[11px] tracking-[0.1em] text-muted'>
        {buildLabel()}
        {buildDate() && ` · ${buildDate()}`}
      </p>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title='Sign out?'
        actions={
          <>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleSignOut} variant='primary' danger>
              Yes, sign out
            </Button>
          </>
        }>
        Signing out of Kitchen Help. Anything unsaved in the recipe editor will be lost.
      </Dialog>
    </div>
  )
}

export default Profile
