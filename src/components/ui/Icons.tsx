import type { SVGProps } from "react"

/**
 * Inline replacements for the handful of @material-ui/icons we used.
 * Same 24x24 Material paths, no dependency.
 */
const Icon = ({ path, ...props }: { path: string } & SVGProps<SVGSVGElement>) => (
  <svg
    viewBox='0 0 24 24'
    width='1em'
    height='1em'
    fill='currentColor'
    focusable='false'
    aria-hidden='true'
    className='inline-block h-[1.25em] w-[1.25em] shrink-0 align-middle'
    {...props}>
    <path d={path} />
  </svg>
)

export const AddIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon path='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' {...props} />
)

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon path='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' {...props} />
)

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon
    path='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
    {...props}
  />
)

export const EditIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon
    path='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'
    {...props}
  />
)

export const DeleteIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon
    path='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'
    {...props}
  />
)

export const ArrowUpwardIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon path='M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z' {...props} />
)

export const ArrowDownwardIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon path='M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z' {...props} />
)

export const WarningIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon path='M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z' {...props} />
)

export const MenuIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon path='M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z' {...props} />
)
