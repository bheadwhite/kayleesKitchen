import Menu from "./Menu"

/** Replaces MUI's <AppBar> + <Toolbar>. */
const Toolbar = () => (
  <header className='fixed top-0 right-0 left-0 z-40 bg-brand-blue text-white shadow-md'>
    <div className='mx-auto flex h-16 w-full max-w-[900px] items-center px-4'>
      <h1 className='flex-1 text-xl font-medium'>Kitchen Help</h1>
      <Menu />
    </div>
  </header>
)

export default Toolbar
