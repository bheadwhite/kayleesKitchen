import clsx from "clsx"
import { useState } from "react"

import Chef from "./Chef"
import { ChefHatIcon, Drawer, Spinner } from "components"
import { useChefFork, useChefStatus, useChefTurns } from "contexts/ChefProvider"

interface ChefDrawerProps {
  /** Lets the recipe page's banner open the panel — see `<ChefBanner>`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * The chef, in a drawer you pull out over the recipe you are reading — the same
 * chef the editor has, met somewhere it can only read.
 *
 * Over the top rather than below: the question is always about a line you are
 * looking at, and a conversation appended to the end of the recipe would mean
 * scrolling past every step to ask about the second ingredient.
 *
 * `open` is optional so the launcher works on its own, and controllable so the
 * banner over the recipe — the other place the copy is visible — can open it on
 * the servings figure.
 */
const ChefDrawer = ({ open: controlledOpen, onOpenChange }: ChefDrawerProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const turns = useChefTurns()
  const fork = useChefFork()
  const { isAsking } = useChefStatus()

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-label='Open the chef'
        className={clsx(
          "fixed right-3 z-40 flex h-12 cursor-pointer touch-manipulation items-center gap-2",
          "bottom-[calc(var(--navbar-h)+var(--sai-bottom)+0.75rem)]",
          "border border-steel bg-steel px-4 text-ground shadow-[0_4px_14px_rgba(43,43,45,0.2)]",
          "font-heading text-sm font-semibold tracking-[0.09em] uppercase hover:bg-steel-600",
          open && "invisible"
        )}>
        {isAsking ? <Spinner size={18} /> : <ChefHatIcon />}
        Chef
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title='Chef'
        closeLabel='Close chef'
        focusId='chef-message'
        meta={
          fork != null
            ? `feeds ${fork.serves}`
            : turns.length > 0
              ? `${turns.length} message${turns.length === 1 ? "" : "s"}`
              : undefined
        }>
        <Chef />
      </Drawer>
    </>
  )
}

export default ChefDrawer
