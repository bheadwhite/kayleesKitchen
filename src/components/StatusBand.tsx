/**
 * The painted strip behind the status bar, and nothing else.
 *
 * This is what is left of the title bar. A fixed row reading "Kitchen Help" sat
 * here for years carrying no navigation, no actions and no state — the name is
 * already on the home-screen icon, in the app switcher, in the tab title and in
 * the manifest, and <NavBar> answers "where am I" far better than a wordmark
 * can. What it cost was 56px of a phone, permanently, above whatever each view
 * sticks underneath it. Each view's own bar — the recipe list's search, the
 * recipe's "All recipes", the editor's picker, the Plan tab's segments — is now
 * the top bar, which is the bar that was carrying something all along.
 *
 * What could not go with it: installed edge-to-edge under `viewport-fit=cover`,
 * *something* has to paint behind the status bar, or the clock sits over a
 * recipe scrolling underneath it. That is this, and it is deliberately bare —
 * no wordmark, and no hairline under it, which with nothing above would read as
 * a rule drawn across the top of the page for no reason.
 *
 * In a browser tab `--sai-top` is `0px`, so this is a zero-height element that
 * draws nothing at all. No conditional styling, exactly as everywhere else that
 * pays an inset.
 */
const StatusBand = () => (
  <div aria-hidden='true' className='fixed inset-x-0 top-0 z-40 h-[var(--sai-top)] bg-ground' />
)

export default StatusBand
