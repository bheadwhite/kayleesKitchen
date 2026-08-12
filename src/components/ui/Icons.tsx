import type { ReactNode, SVGProps } from "react"

/**
 * Lucide icons (https://lucide.dev), drawn inline.
 *
 * The design system calls for Lucide at stroke-width 1.5 — thin and technical —
 * so unlike the filled Material paths these replaced, every icon here is a
 * *stroked* outline: `fill="none"`, `stroke="currentColor"`. Adding a Material
 * path to this file would land a solid black blob among hairline drawings.
 *
 * Sized in `em` so an icon matches whatever text it sits beside; pass
 * `className='h-6 w-6'` where a fixed size is wanted (the nav bar does).
 */
const Icon = ({ children, ...props }: { children: ReactNode } & SVGProps<SVGSVGElement>) => (
  <svg
    viewBox='0 0 24 24'
    width='1em'
    height='1em'
    fill='none'
    stroke='currentColor'
    strokeWidth={1.5}
    strokeLinecap='round'
    strokeLinejoin='round'
    focusable='false'
    aria-hidden='true'
    className='inline-block h-[1.25em] w-[1.25em] shrink-0 align-middle'
    {...props}>
    {children}
  </svg>
)

export const AddIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M12 5v14M5 12h14' />
  </Icon>
)

export const MinusIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M5 12h14' />
  </Icon>
)

export const ChefHatIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z' />
    <path d='M6 17h12' />
  </Icon>
)

export const UsersIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
    <circle cx='9' cy='7' r='4' />
    <path d='M22 21v-2a4 4 0 0 0-3-3.87' />
    <path d='M16 3.13a4 4 0 0 1 0 7.75' />
  </Icon>
)

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M20 6L9 17l-5-5' />
  </Icon>
)

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M18 6L6 18M6 6l12 12' />
  </Icon>
)

/** The design's pencil: a filled-nib outline rather than Lucide's bare stroke. */
export const EditIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M4 20h4L19.5 8.5a2.6 2.6 0 00-4-4L4 16v4z' />
    <path d='M14.5 6.5l3 3' />
  </Icon>
)

export const DeleteIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6' />
    <path d='M10 11v6M14 11v6' />
  </Icon>
)

export const ArrowUpwardIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M12 19V5M5 12l7-7 7 7' />
  </Icon>
)

export const ArrowDownwardIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M12 5v14M19 12l-7 7-7-7' />
  </Icon>
)

/**
 * Drag handle for reorderable rows — three rules, matching the design's step
 * rows. Lucide's `grip-horizontal` is dotted; at 1.5 stroke the dots turn to
 * mush on a phone, so this is the drawn version from the design instead.
 */
export const DragIndicatorIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M5 9h14M5 13h14M5 17h14' />
  </Icon>
)

/**
 * The pot the design draws for the recipe list — a lidded pot seen from the
 * front. It doubles as the placeholder for a recipe with no photo, which is
 * why it is here rather than inline in the nav bar.
 */
export const PotIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M4 10h16v6a4 4 0 01-4 4H8a4 4 0 01-4-4v-6z' />
    <path d='M2.5 10h19M9 6.5V4M15 6.5V4' />
  </Icon>
)

export const ArrowBackIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M19 12H5M12 19l-7-7 7-7' />
  </Icon>
)

export const ChevronRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M9 18l6-6-6-6' />
  </Icon>
)

/** `chevron-up` — the handle of a panel that pulls up from the bottom edge. */
export const ChevronUpIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M18 15l-6-6-6 6' />
  </Icon>
)

/** `activity` — the admin console's usage readout. */
export const ActivityIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M22 12h-4l-3 9L9 3l-3 9H2' />
  </Icon>
)

export const UndoIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M9 14L4 9l5-5' />
    <path d='M4 9h11a5 5 0 010 10h-4' />
  </Icon>
)

export const RedoIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M15 14l5-5-5-5' />
    <path d='M20 9H9a5 5 0 000 10h4' />
  </Icon>
)

export const TagIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z' />
    <path d='M7.5 7.5h.01' />
  </Icon>
)

export const CalendarIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M8 2v4M16 2v4' />
    <rect x='3' y='4' width='18' height='18' rx='2' />
    <path d='M3 10h18' />
  </Icon>
)

export const CartIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx='8' cy='21' r='1' />
    <circle cx='19' cy='21' r='1' />
    <path d='M2 2h2l2.6 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 6H5.1' />
  </Icon>
)

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx='11' cy='11' r='7' />
    <path d='M20 20l-3.6-3.6' />
  </Icon>
)

export const WarningIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z' />
    <path d='M12 9v4M12 17h.01' />
  </Icon>
)

export const LogoutIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4' />
    <path d='M16 17l5-5-5-5M21 12H9' />
  </Icon>
)

/** `send-horizontal` — the assistant composer's send action. */
export const SendIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M4 12h15M13 6l6 6-6 6' />
  </Icon>
)

/** `image-plus` — attaching photos to the assistant. */
export const ImageIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7' />
    <path d='M16 5h6M19 2v6' />
    <circle cx='9' cy='9' r='2' />
    <path d='M21 15l-4.5-4.5L3 19' />
  </Icon>
)

/** `sparkles` — the generated-image action, which is a model call, not a file. */
export const SparklesIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z' />
    <path d='M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z' />
  </Icon>
)

/**
 * The one icon that is not a Lucide outline: Google's brand mark keeps its own
 * four colors, so it does not go through <Icon>'s `stroke="currentColor"`.
 */
export const GoogleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox='0 0 48 48'
    width='1em'
    height='1em'
    focusable='false'
    aria-hidden='true'
    className='inline-block h-[1.25em] w-[1.25em] shrink-0 align-middle'
    {...props}>
    <path
      fill='#4285F4'
      d='M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z'
    />
    <path
      fill='#34A853'
      d='M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z'
    />
    <path
      fill='#FBBC05'
      d='M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z'
    />
    <path
      fill='#EA4335'
      d='M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z'
    />
  </svg>
)
