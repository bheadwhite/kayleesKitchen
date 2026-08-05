/**
 * The app's title bar. Navigation used to live here behind a hamburger; it now
 * sits in <NavBar> along the bottom edge, so this is pure chrome.
 *
 * It is the ground color with a hairline under it, not a solid colored band:
 * in this design system the accent is spent on one object per view, and a
 * permanent 64px block of it would spend it on the least important thing on
 * screen. The wordmark carries the brand instead.
 *
 * `pt-[var(--sai-top)]` on the header with the height on the inner row: the
 * background has to reach the top of the screen and fill the notch area, while
 * the wordmark stays below it.
 */
const Toolbar = () => (
  <header className='fixed top-0 right-0 left-0 z-40 border-b border-divider bg-ground pt-[var(--sai-top)]'>
    <div className='mx-auto flex h-[var(--header-h)] w-full max-w-[900px] items-center gap-2 px-4'>
      <h1 className='min-w-0 flex-1 truncate font-heading text-2xl font-bold tracking-[0.07em] uppercase'>
        Kitchen Help
      </h1>
    </div>
  </header>
)

export default Toolbar
