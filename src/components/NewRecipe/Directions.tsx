import { useEffect, useRef, useState } from "react"
import { useFormState } from "react-final-form"

import {
  AddIcon,
  ArrowDownwardIcon,
  ArrowUpwardIcon,
  Button,
  CheckIcon,
  CloseIcon,
  DeleteIcon,
  Dialog,
  EditIcon,
  WarningIcon,
} from "components"
import { TextField } from "components/finalForm"
import { useDirections, useEditSection, useRecipePresenter } from "contexts/RecipeProvider"

const Directions = () => {
  const presenter = useRecipePresenter()
  const directions = useDirections()
  const editSection = useEditSection()
  const { values } = useFormState<Record<string, any>>()

  const stepRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  // Focus a section title as soon as it enters edit mode while still blank.
  useEffect(() => {
    if (editSection == null) return
    const input = sectionRef.current?.querySelector("input")
    if (input && input.value === "") input.focus()
  }, [editSection])

  const addSection = () => {
    presenter.addNewSection("")
    // Focus the new section's step field once it has rendered.
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
    stepRef.current?.querySelector("input")?.focus()
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

  return (
    <>
      <div className='relative mt-4 rounded border border-brand-border p-1.5'>
        <div className='absolute -top-2.5 left-2.5 bg-white px-1.5'>Directions</div>

        <div className='directions-list'>
          {directions.length === 0 ? (
            <div className='text-brand-muted'> -- </div>
          ) : (
            directions.map(({ sectionTitle, steps, editStep }, index) => (
              <div
                key={`${sectionTitle}-${index}`}
                className='mb-4 rounded border border-black p-4'>
                <div className='font-semibold text-brand-blue'>
                  {editSection === index ? (
                    <div className='flex items-end gap-2'>
                      <TextField
                        id='sectionInput'
                        name='section'
                        placeholder='Section Title'
                        ref={sectionRef}
                      />
                      <Button
                        onClick={() => presenter.updateSectionTitle(values.section)}
                        className='bg-brand-green hover:bg-brand-green/85'
                        aria-label='Save section title'>
                        <CheckIcon />
                      </Button>
                      <Button
                        onClick={() => presenter.setEditSection(null)}
                        danger
                        aria-label='Cancel editing section'>
                        <CloseIcon />
                      </Button>
                    </div>
                  ) : (
                    <div className='flex flex-wrap items-center gap-1'>
                      {sectionTitle === "" ? (
                        <span className='text-gray-400'>Section Title</span>
                      ) : (
                        sectionTitle
                      )}
                      <Button onClick={() => presenter.setEditSection(index)} className='ml-4'>
                        Edit Title
                      </Button>
                      <Button onClick={() => handleDeleteSection(index)} danger>
                        Delete Section
                      </Button>
                    </div>
                  )}
                </div>

                {steps.map((step, i) => (
                  <div key={i} className='flex flex-wrap items-center gap-1 py-0.5 font-normal'>
                    <span className='mr-2 text-black'>- {step}</span>
                    <Button onClick={() => presenter.setEditStep(index, i)} aria-label='Edit step'>
                      <EditIcon />
                    </Button>
                    <Button
                      onClick={() => presenter.deleteStep(index, i)}
                      danger
                      aria-label='Delete step'>
                      <DeleteIcon />
                    </Button>
                    <Button
                      onClick={() => presenter.moveStepUpOne(index, i)}
                      aria-label='Move step up'>
                      <ArrowUpwardIcon />
                    </Button>
                    <Button
                      onClick={() => presenter.moveStepDownOne(index, i)}
                      aria-label='Move step down'>
                      <ArrowDownwardIcon />
                    </Button>
                  </div>
                ))}

                <div className='flex items-end gap-2'>
                  <TextField
                    id={`nextStep-${index}`}
                    name={`nextStep-${index}`}
                    fullWidth
                    placeholder='type next step'
                    ref={stepRef}
                  />
                  {editStep == null ? (
                    <Button onClick={() => newStep(index)} aria-label='Add step'>
                      <span id='add-step' className='flex items-center justify-center'>
                        <AddIcon />
                      </span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => updateStep(index)}
                        className='bg-brand-green hover:bg-brand-green/85'
                        aria-label='Save step'>
                        <CheckIcon />
                      </Button>
                      <Button
                        onClick={() => presenter.clearEditStep(index)}
                        danger
                        aria-label='Cancel editing step'>
                        <CloseIcon />
                      </Button>
                    </>
                  )}
                </div>
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
