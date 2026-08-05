import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import { MenuIcon } from "components"
import { useAuthPresenter, useAuthStatus } from "contexts/AuthProvider"

const Menu = () => {
  const auth = useAuthPresenter()
  const status = useAuthStatus()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const goTo = (location: string) => {
    setOpen(false)
    navigate(location)
  }

  const handleSignOut = async () => {
    try {
      await auth.logOut()
      goTo("/login")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.")
    }
  }

  const items =
    status === "loggedIn"
      ? [
          { label: "Recipe Editor", onClick: () => goTo("/recipes/new") },
          { label: "Recipes", onClick: () => goTo("/recipes") },
          { label: "Signout", onClick: handleSignOut },
        ]
      : [{ label: "Login", onClick: () => goTo("/login") }]

  return (
    <div ref={containerRef} className='relative'>
      <button
        type='button'
        aria-label='menu'
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className='cursor-pointer rounded p-2 text-2xl hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'>
        <MenuIcon />
      </button>
      {open && (
        <div
          role='menu'
          className='absolute top-full right-0 z-50 mt-1 min-w-40 overflow-hidden rounded bg-white py-1 text-gray-900 shadow-lg'>
          {items.map((item) => (
            <button
              key={item.label}
              type='button'
              role='menuitem'
              onClick={item.onClick}
              className='block w-full cursor-pointer px-4 py-2 text-left text-sm hover:bg-black/5'>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default Menu
