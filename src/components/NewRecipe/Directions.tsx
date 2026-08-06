import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import clsx from "clsx"
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import { useFormState } from "react-final-form"

import {
  AddIcon,
  Button,
  ChangeMark,
  CheckIcon,
  CloseIcon,
  Dialog,
  DragIndicatorIcon,
  SectionHeading,
} from "components"
import { TextArea, TextField } from "components/finalForm"
import { useDirections, useEditSection, useRecipePresenter } from "contexts/RecipeProvider"
import usePeek from "hooks/usePeek"
import type { RowChange, RowDiff, SectionChanges } from "@/recipeDiff"

interface DirectionsProps {
  /** Per-section difference from the saved recipe, from `diffRecipe`. */
  changes?: SectionChanges[]
}

/** Small square icon button — the row chrome, not a primary action. */
const IconButton = ({
  onClick,
  label,
  danger = false,
  children,
}: {
  onClick: () => void
  label: string
  danger?: boolean
  children: ReactNode
}) => (
  <button
    type='button'
    onClick={onClick}
    aria-label={label}
    title={label}
    className={clsx(
      "flex h-9 w-9 shrink-0 cursor-pointer touch-manipulation items-center justify-center",
      danger ? "text-muted hover:text-danger" : "text-muted hover:text-steel"
    )}>
    {children}
  </button>
)

interface StepRowProps {
  id: string
  /** 1-based position within the whole recipe, shown as the step's number. */
  number: number
  text: string
  /** How this step differs from the saved recipe. */
  change?: RowDiff
  onEdit: () => void
  onDelete: () => void
  onRevert: () => void
}

/** One draggable step: number over grip, click-to-edit text, delete. */
const StepRow = ({ id, number, text, change, onEdit, onDelete, onRevert }: StepRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const { peeking, handlers } = usePeek(change?.before != null)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        "grid grid-cols-[36px_1fr_36px] items-start gap-2 border-t border-ink/10 py-2.5",
        change != null && change.kind !== "same" && "bg-steel-100",
        peeking && "bg-steel-200",
        isDragging && "relative z-10 bg-surface"
      )}>
      {/* Number above handle, both centred in a 36px gutter — the design's step
       *  column. The zero-padded number is what makes a long list scannable. */}
      <div className='flex flex-col items-center gap-1'>
        <span className='font-heading text-base font-semibold tracking-[0.06em] text-steel'>
          {String(number).padStart(2, "0")}
        </span>
        <button
          type='button'
          aria-label={`Reorder: ${text}`}
          // `touch-none` is required — without it the browser claims the gesture
          // for scrolling and the drag never starts on a phone.
          className='flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted hover:text-ink active:cursor-grabbing'
          {...attributes}
          {...listeners}>
          <DragIndicatorIcon className='h-4 w-4' />
        </button>
      </div>

      {/* The mark is a sibling of the text, not inside it: it is a button of
       *  its own now, and a button inside a button is both invalid markup and
       *  a press that opens the editor. */}
      <div className='flex min-w-0 items-start gap-2'>
        <button
          type='button'
          onClick={onEdit}
          // `pre-wrap` keeps the line breaks the textarea editor allows; without
          // it a step written as several lines reads back as one run-on.
          className='min-w-0 flex-1 cursor-text pt-0.5 text-left text-[16.5px] leading-relaxed break-words whitespace-pre-wrap select-none hover:text-steel-700'
          title={
            change?.before != null ? "Click to edit · hold to see what it said" : "Click to edit"
          }
          {...handlers}>
          {peeking ? <span className='text-muted line-through'>{change?.before}</span> : text}
        </button>
        <ChangeMark change={change?.kind} onRevert={onRevert} className='mt-1.5' />
      </div>

      <IconButton onClick={onDelete} label={`Delete step: ${text}`} danger>
        <CloseIcon className='h-4 w-4' />
      </IconButton>
    </div>
  )
}

interface SectionTitleProps {
  title: string
  /** "added" for a whole new section, "changed" for a renamed one. */
  mark: RowChange
  /** What it was called before. Absent unless it was renamed. */
  before?: string
  onEdit: () => void
  onDelete: () => void
  onRevert: () => void
}

/** A section's heading: click to rename, hold to see what it was called. */
const SectionTitle = ({ title, mark, before, onEdit, onDelete, onRevert }: SectionTitleProps) => {
  const { peeking, handlers } = usePeek(before != null)
  // A section renamed *from* nothing has an empty previous title, and an empty
  // strikethrough reads as a bug rather than as an answer.
  const previous = before === "" ? "Untitled section" : before

  return (
    <>
      <button
        type='button'
        onClick={onEdit}
        title={before != null ? "Click to edit · hold to see what it said" : "Click to edit"}
        className={clsx(
          "min-w-0 flex-1 cursor-text py-1 text-left font-heading text-xl font-semibold",
          "tracking-[0.06em] break-words text-steel-700 uppercase select-none"
        )}
        {...handlers}>
        {peeking ? (
          <span className='text-muted line-through'>{previous}</span>
        ) : title === "" ? (
          <span className='text-muted'>Section title</span>
        ) : (
          title
        )}
      </button>
      {/* Reverting only means something where there is a saved title to go
       *  back to — a brand-new section has the delete button beside it. */}
      <ChangeMark
        change={mark}
        onRevert={before != null ? onRevert : undefined}
        className='mt-2'
      />
      <IconButton
        onClick={onDelete}
        label={`Delete section: ${title || "untitled"}`}
        danger>
        <CloseIcon className='h-4 w-4' />
      </IconButton>
    </>
  )
}

const Directions = ({ changes = [] }: DirectionsProps) => {
  const presenter = useRecipePresenter()
  const directions = useDirections()
  const editSection = useEditSection()
  const { values } = useFormState<Record<string, any>>()

  const stepRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  const sensors = useSensors(
    // A short press-and-hold on touch keeps vertical scrolling working; a small
    // drag distance on mouse keeps a plain click from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Focus a section title as soon as it enters edit mode while still blank.
  useEffect(() => {
    if (editSection == null) return
    const input = sectionRef.current?.querySelector("input")
    if (input) input.focus()
  }, [editSection])

  const addSection = () => {
    presenter.addNewSection("")
    setTimeout(() => {
      const list = document.getElementsByClassName("directions-list")[0]
      list?.lastElementChild?.querySelector("input")?.focus()
    }, 0)
  }

  const newStep = (index: number) => {
    presenter.addNewStep(index, values[`nextStep-${index}`])
    stepRef.current?.querySelector("textarea")?.focus()
  }

  const updateStep = (index: number) => {
    presenter.updateSectionStep(index, values)
  }

  /**
   * Steps are textareas, so Enter belongs to the text — it starts a new line
   * inside the step rather than committing it. Cmd/Ctrl+Enter is the commit,
   * which keeps a run of steps typeable without reaching for the mouse.
   */
  const stepKeys =
    (commit: () => void, cancel?: () => void) =>
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        commit()
      } else if (event.key === "Escape" && cancel != null) {
        event.preventDefault()
        cancel()
      }
    }

  const toggleConfirm = () => setConfirmOpen((open) => !open)

  const handleDeleteSection = (index: number) => {
    setDeleteIndex(index)
    setConfirmOpen(true)
  }

  const confirmDeleteSection = () => {
    if (deleteIndex != null) presenter.deleteSection(deleteIndex)
    setConfirmOpen(false)
    setDeleteIndex(null)
  }

  const handleDragEnd = (sectionIndex: number) => (event: DragEndEvent) => {
    const { active, over } = event
    if (over == null || active.id === over.id) return
    presenter.moveStep(sectionIndex, Number(active.id), Number(over.id))
  }

  // Steps are numbered across the whole recipe, not restarted per section —
  // "step 9" means one thing to someone cooking from it.
  let stepNumber = 0
  const totalSteps = directions.reduce((total, section) => total + section.steps.length, 0)

  return (
    <>
      <div>
        <SectionHeading
          meta={`${totalSteps} step${totalSteps === 1 ? "" : "s"} · ${directions.length} section${
            directions.length === 1 ? "" : "s"
          }`}>
          Guide
        </SectionHeading>

        <div className='directions-list'>
          {directions.length === 0 ? (
            <p className='py-3 text-muted'>No steps yet.</p>
          ) : (
            directions.map(({ sectionTitle, steps, editStep }, index) => {
              // Consumed on the way past, so each section knows where its own
              // numbering starts in the running count.
              const sectionFirstStep = stepNumber
              stepNumber += steps.length
              const sectionChange = changes[index]

              return (
                <div key={`${sectionTitle}-${index}`} className='pt-5'>
                {/* -------------------------------------------------- title */}
                <div className='flex items-start gap-1'>
                  {editSection === index ? (
                    <div className='flex flex-1 flex-wrap items-end gap-1'>
                      <div className='min-w-0 flex-1 basis-full sm:basis-0'>
                        <TextField
                          id='sectionInput'
                          name='section'
                          placeholder='Section Title'
                          fullWidth
                          ref={sectionRef}
                        />
                      </div>
                      <IconButton
                        onClick={() => presenter.updateSectionTitle(values.section)}
                        label='Save section title'>
                        <CheckIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => presenter.setEditSection(null)}
                        label='Cancel editing section'>
                        <CloseIcon />
                      </IconButton>
                    </div>
                  ) : (
                    <SectionTitle
                      title={sectionTitle}
                      mark={
                        sectionChange?.added
                          ? "added"
                          : sectionChange?.titleChanged
                            ? "changed"
                            : "same"
                      }
                      before={sectionChange?.titleBefore}
                      onEdit={() => presenter.setEditSection(index)}
                      onDelete={() => handleDeleteSection(index)}
                      onRevert={() => presenter.revertSectionTitle(index)}
                    />
                  )}
                </div>

                {/* -------------------------------------------------- steps */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={handleDragEnd(index)}>
                  <SortableContext
                    items={steps.map((_, i) => String(i))}
                    strategy={verticalListSortingStrategy}>
                    <div className='mt-1'>
                      {steps.map((step, i) =>
                        editStep === i ? (
                          // Same field name and id as the add-step box below,
                          // which is safe only because the two are never
                          // mounted together — one `nextStep-{i}` field per
                          // section, so react-final-form has one value for it.
                          <div key={i} className='flex flex-wrap items-end gap-1 py-1'>
                            <div className='min-w-0 flex-1 basis-full sm:basis-0'>
                              <TextArea
                                id={`nextStep-${index}`}
                                name={`nextStep-${index}`}
                                fullWidth
                                autoFocus
                                onKeyDown={stepKeys(
                                  () => updateStep(index),
                                  () => presenter.clearEditStep(index)
                                )}
                              />
                            </div>
                            <IconButton onClick={() => updateStep(index)} label='Save step'>
                              <CheckIcon />
                            </IconButton>
                            <IconButton
                              onClick={() => presenter.clearEditStep(index)}
                              label='Cancel editing step'>
                              <CloseIcon />
                            </IconButton>
                          </div>
                        ) : (
                          <StepRow
                            key={i}
                            id={String(i)}
                            number={sectionFirstStep + i + 1}
                            text={step}
                            change={sectionChange?.steps[i]}
                            onEdit={() => presenter.setEditStep(index, i)}
                            onDelete={() => presenter.deleteStep(index, i)}
                            onRevert={() => presenter.revertStep(index, i)}
                          />
                        )
                      )}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* A deleted step leaves no row to flag, so the section says so
                 *  itself — otherwise the one kind of change you most want to
                 *  catch before saving is the only one that is invisible. */}
                {sectionChange != null && sectionChange.stepsRemoved > 0 && (
                  <p className='mt-1 pl-[44px] font-mono text-[10px] tracking-[0.14em] text-muted uppercase'>
                    {sectionChange.stepsRemoved} step
                    {sectionChange.stepsRemoved === 1 ? "" : "s"} removed
                  </p>
                )}

                {/* ----------------------------------------------- add step */}
                {editStep == null && (
                  <div className='mt-2 flex items-end gap-2 pl-[44px]'>
                    <div className='min-w-0 flex-1'>
                      <TextArea
                        id={`nextStep-${index}`}
                        name={`nextStep-${index}`}
                        fullWidth
                        placeholder='Type the next step'
                        ref={stepRef}
                        onKeyDown={stepKeys(() => newStep(index))}
                      />
                    </div>
                    <IconButton onClick={() => newStep(index)} label='Add step'>
                      <AddIcon />
                    </IconButton>
                  </div>
                )}
                </div>
              )
            })
          )}
        </div>

        {/* Dashed, not solid: the system draws "add another one of these" as an
         *  open slot rather than a committed object. */}
        <button
          type='button'
          onClick={addSection}
          className='mt-6 h-12 w-full cursor-pointer border border-dashed border-ink/30 font-heading text-[15px] font-semibold tracking-[0.12em] text-steel-700 uppercase hover:border-steel hover:bg-steel-100'>
          + Add section
        </button>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={toggleConfirm}
        title='Delete section?'
        actions={
          <>
            <Button onClick={toggleConfirm}>Cancel</Button>
            <Button onClick={confirmDeleteSection} variant='primary' danger>
              Delete section
            </Button>
          </>
        }>
        This removes the section and every step in it.
      </Dialog>
    </>
  )
}

export default Directions
