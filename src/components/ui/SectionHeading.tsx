import type { ReactNode } from "react"

interface SectionHeadingProps {
  children: ReactNode
  /**
   * A count or status, set right — the system's "spec sheet" annotation.
   *
   * A node rather than a string so the annotation can also be a control, which
   * is where a section-scoped toggle belongs: the admin console's "only
   * failures" filter acts on the list under this heading and nothing else. The
   * mono/uppercase styling is not applied for you — a control brings its own,
   * or it inherits nothing and looks like neither.
   */
  meta?: ReactNode
  /** Heading level. The recipe view nests these under its <h1>. */
  as?: "h2" | "h3"
}

/**
 * The divider every major section of a recipe sits under: mono, uppercase,
 * widely tracked, with a hairline rule and an optional count on the right.
 *
 * It replaced the editor's old "fieldset with a floating label" boxes. Those
 * drew four borders around content that needed none; this draws one line and
 * lets the whitespace do the grouping, which is what the system asks for.
 */
const SectionHeading = ({ children, meta, as: Tag = "h2" }: SectionHeadingProps) => (
  <div className='mt-7 mb-1 flex items-baseline justify-between gap-3 border-b border-divider pb-2'>
    <Tag className='font-mono text-[15px] font-semibold tracking-[0.16em] uppercase'>
      {children}
    </Tag>
    {meta && <span className='shrink-0 font-mono text-xs text-muted'>{meta}</span>}
  </div>
)

export default SectionHeading
