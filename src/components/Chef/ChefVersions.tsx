import clsx from "clsx"
import { useState } from "react"

import { Button, CloseIcon, Dialog } from "components"
import { useChefPresenter, useChefVariants, useSavedAs } from "contexts/ChefProvider"
import type { ChefVariant } from "@/types"

/**
 * The copies of this recipe someone kept, as a row of chips.
 *
 * This is the payoff for saving one at all. "Double it" is a question a
 * household asks of the same recipe every year, and the chef's answer does not
 * change between askings — so the second time you want it, tapping a chip loads
 * it out of Firestore with **no model call**, no wait, and no chance of getting
 * a subtly different answer than the one you cooked from last time.
 *
 * Rendered inside `<ChefBanner>` rather than as its own strip: "which version
 * am I looking at" and "which versions exist" are one question, and answering
 * it in two places on the same screen means reading both to be sure.
 */
const ChefVersions = () => {
  const chef = useChefPresenter()
  const variants = useChefVariants()
  const savedAs = useSavedAs()
  const [forgetting, setForgetting] = useState<ChefVariant | null>(null)

  if (variants.length === 0) return null

  return (
    <div className='mt-2 flex flex-wrap items-center gap-1.5 border-t border-ink/10 pt-2'>
      <span className='mr-0.5 font-mono text-[10px] tracking-[0.14em] text-muted uppercase'>
        Kept
      </span>

      {variants.map((variant) => {
        const loaded = variant.id === savedAs
        return (
          <span
            key={variant.id}
            className={clsx(
              "inline-flex items-center border",
              loaded ? "border-steel bg-steel text-ground" : "border-divider bg-ground"
            )}>
            <button
              type='button'
              onClick={() => chef.useVariant(variant)}
              aria-pressed={loaded}
              // No spinner and no disabled state: this is a read of something
              // already on the device, so there is nothing to wait for. That
              // difference from asking the chef is the point of the feature.
              className='cursor-pointer px-2.5 py-1 text-[13px] tracking-[0.02em] hover:bg-ink/7'>
              {variant.label}
            </button>
            <button
              type='button'
              onClick={() => setForgetting(variant)}
              aria-label={`Forget "${variant.label}"`}
              className={clsx(
                "flex h-7 w-6 cursor-pointer items-center justify-center border-l",
                loaded ? "border-ground/30 hover:bg-ground/20" : "border-divider hover:bg-ink/7"
              )}>
              <CloseIcon className='h-3 w-3' />
            </button>
          </span>
        )
      })}

      {/* Behind a confirm, unlike discarding the copy on screen: that one costs
       *  a tap to get back, this one costs a model call — and it is shared, so
       *  the thing being thrown away may be something someone else kept. */}
      <Dialog
        open={forgetting != null}
        title='Forget this version?'
        onClose={() => setForgetting(null)}
        actions={
          <>
            <Button onClick={() => setForgetting(null)}>Keep it</Button>
            <Button
              danger
              onClick={() => {
                if (forgetting) void chef.forgetVariant(forgetting.id)
                setForgetting(null)
              }}>
              Forget
            </Button>
          </>
        }>
        <p>
          &ldquo;{forgetting?.label}&rdquo; goes for everyone, not just you. Getting it back
          means asking the chef to work it out again.
        </p>
      </Dialog>
    </div>
  )
}

export default ChefVersions
