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
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useFormState } from "react-final-form"

import {
  AddIcon,
  Button,
  CheckIcon,
  CloseIcon,
  DeleteIcon,
  Dialog,
  DragIndicatorIcon,
  WarningIcon,
} from "components"
import { TextField } from "components/finalForm"
import { useDirections, useEditSection, useRecipePresenter } from "contexts/RecipeProvider"

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
      "flex h-9 w-9 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded",
      "focus-visible:ring-brand-blue focus-visible:ring-2 focus-visible:outline-none",
      danger
        ? "text-brand-red hover:bg-brand-red/10"
        : "text-gray-500 hover:bg-black/5 hover:text-gray-700"
    )}>
    {children}
  </button>
)

interface StepRowProps {
  id: string
  text: string
  onEdit: () => void
  onDelete: () => void
}

/** One draggable step: grip, click-to-edit text, delete. */
const StepRow = ({ id, text, onEdit, onDelete }: StepRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        "flex items-start gap-1 rounded py-0.5",
        isDragging && "bg-brand-well relative z-10 shadow"
      )}>
      <button
        type='button'
        aria-label={`Reorder: ${text}`}
        // `touch-none` is required — without it the browser claims the gesture
        // for scrolling and the drag never starts on a phone.
        className='mt-0.5 flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none active:cursor-grabbing'
        {...attributes}
        {...listeners}>
        <DragIndicatorIcon />
      </button>

      <button
        type='button'
        onClick={onEdit}
        className='focus-visible:ring-brand-blue min-w-0 flex-1 cursor-text rounded px-1 py-1.5 text-left break-words hover:bg-black/5 focus-visible:ring-2 focus-visible:outline-none'
        title='Click to edit'>
        {text}
      </button>

      <IconButton onClick={onDelete} label={`Delete step: ${text}`} danger>
        <DeleteIcon />
      </IconButton>
    </div>
  )
}

const Directions = () => {
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
    stepRef.current?.querySelector("input")?.focus()
  }

  const updateStep = (index: number) => {
    presenter.updateSectionStep(index, values)
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

  return (
    <>
      <div className='border-brand-border relative mt-6 rounded border p-2 sm:p-1.5'>
        <div className='absolute -top-2.5 left-2.5 bg-white px-1.5'>Directions</div>

        <div className='directions-list'>
          {directions.length === 0 ? (
            <div className='text-brand-muted'> -- </div>
          ) : (
            directions.map(({ sectionTitle, steps, editStep }, index) => (
              <div
                key={`${sectionTitle}-${index}`}
                className='border-brand-border mb-4 rounded border p-2 sm:p-3'>
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
                    <>
                      <button
                        type='button'
                        onClick={() => presenter.setEditSection(index)}
                        title='Click to edit'
                        className='text-brand-blue focus-visible:ring-brand-blue min-w-0 flex-1 cursor-text rounded px-1 py-1.5 text-left font-semibold break-words hover:bg-black/5 focus-visible:ring-2 focus-visible:outline-none'>
                        {sectionTitle === "" ? (
                          <span className='text-gray-400'>Section Title</span>
                        ) : (
                          sectionTitle
                        )}
                      </button>
                      <IconButton
                        onClick={() => handleDeleteSection(index)}
                        label={`Delete section: ${sectionTitle || "untitled"}`}
                        danger>
                        <DeleteIcon />
                      </IconButton>
                    </>
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
                          // Same field name and id as the add-step input below —
                          // only one of the two is ever mounted, which keeps the
                          // `nextStep-{i}` contract in NewRecipe/utils.ts intact.
                          <div key={i} className='flex flex-wrap items-end gap-1 py-1'>
                            <div className='min-w-0 flex-1 basis-full sm:basis-0'>
                              <TextField
                                id={`nextStep-${index}`}
                                name={`nextStep-${index}`}
                                fullWidth
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
                            text={step}
                            onEdit={() => presenter.setEditStep(index, i)}
                            onDelete={() => presenter.deleteStep(index, i)}
                          />
                        )
                      )}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* ----------------------------------------------- add step */}
                {editStep == null && (
                  <div className='mt-1 flex items-end gap-2 pl-6'>
                    <div className='min-w-0 flex-1'>
                      <TextField
                        id={`nextStep-${index}`}
                        name={`nextStep-${index}`}
                        fullWidth
                        placeholder='type next step'
                        ref={stepRef}
                      />
                    </div>
                    <IconButton onClick={() => newStep(index)} label='Add step'>
                      <span id='add-step' className='flex items-center justify-center'>
                        <AddIcon />
                      </span>
                    </IconButton>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <Button onClick={addSection}>Add New Section</Button>
      </div>

      <Dialog open={confirmOpen} onClose={toggleConfirm} title='Delete section?'>
        <div className='p-4'>
          <WarningIcon className='text-brand-red' />
          <p className='my-2'>Are you sure you want to delete this section?</p>
          <Button onClick={toggleConfirm}>No</Button>
          <Button onClick={confirmDeleteSection} danger>
            Yes
          </Button>
        </div>
      </Dialog>
    </>
  )
}

export default Directions
