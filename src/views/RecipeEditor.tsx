import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Form } from "react-final-form"
import Select from "react-select"
import { toast } from "react-toastify"

import { Button, DeleteIcon, Dialog, SectionHeading, Spinner } from "components"
import { AiAssistant } from "components/AiAssistant"
import { TextField } from "components/finalForm"
import { ImageUpload } from "components/ImageUpload"
import { AddIngredient, Directions, ListIngredients } from "components/NewRecipe"
import { shouldNotSubmitAndFocusInputs } from "components/NewRecipe/utils"
import { useAiDraftPresenter } from "contexts/AiDraftProvider"
import { useSessionUser } from "contexts/AuthProvider"
import {
  useDirections,
  useEditSection,
  useIngredients,
  useRecipeImageUrl,
  useRecipePresenter,
} from "contexts/RecipeProvider"
import useUsersRecipes from "hooks/useUsersRecipes"
import {
  addRecipe,
  deleteRecipeById,
  getImageUrlByEmailId,
  updateRecipeById,
  uploadImageToRecipeId,
} from "fire/services"
import type { DirectionSection, Recipe } from "@/types"

interface RecipeOption {
  label: string
  value: Recipe
}

interface EditorValues {
  title: string
  directions: DirectionSection[]
  [key: string]: any
}

const RecipeEditor = () => {
  const presenter = useRecipePresenter()
  const assistant = useAiDraftPresenter()
  const user = useSessionUser()
  const directions = useDirections()
  const ingredients = useIngredients()
  const editSection = useEditSection()
  const currentImageUrl = useRecipeImageUrl()
  const usersRecipes = useUsersRecipes()

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Leave the editor clean for the next visit. Both presenters are owned by
  // their providers, so this resets rather than disposes them.
  useEffect(
    () => () => {
      presenter.reset()
      assistant.reset()
    },
    [presenter, assistant]
  )

  const options = useMemo<RecipeOption[]>(
    () =>
      usersRecipes
        .filter((recipe) => Boolean(recipe.title))
        .map((recipe) => ({ label: recipe.title, value: recipe })),
    [usersRecipes]
  )

  /**
   * Loads a recipe into the editor. Shared by the picker and by the `?edit=`
   * link the recipe view sends — one implementation, so a change to how a
   * recipe is opened cannot apply to only one of the two routes in.
   */
  const openForEditing = useCallback(
    async (recipe: Recipe) => {
      if (user == null) return

      presenter.loadRecipe(recipe)
      setEditMode(true)

      if (recipe.image && recipe.id) {
        try {
          presenter.setImageUrl(await getImageUrlByEmailId(user.email, recipe.id))
        } catch {
          presenter.setImageUrl(null)
        }
      } else {
        presenter.setImageUrl(null)
      }
    },
    [presenter, user]
  )

  const handleOnPulledRecipe = (option: RecipeOption | null) => {
    if (option == null) return
    void openForEditing(option.value)
  }

  // Arriving from the recipe view's Edit button. `usersRecipes` is a live
  // snapshot that lands after mount, so this waits for the recipe rather than
  // reading an empty list. The ref keeps it to one shot — without it, pressing
  // Cancel would immediately reload the recipe the URL still names.
  const [searchParams] = useSearchParams()
  const editId = useRef(searchParams.get("edit")).current
  const openedFromUrl = useRef(false)

  useEffect(() => {
    if (editId == null || openedFromUrl.current) return
    const match = usersRecipes.find((recipe) => recipe.id === editId)
    if (match == null) return
    openedFromUrl.current = true
    void openForEditing(match)
  }, [usersRecipes, editId, openForEditing])

  const handleCancelEditMode = () => {
    presenter.reset()
    setEditMode(false)
  }

  const handleDelete = async () => {
    const id = presenter.getId()
    setConfirmOpen(false)
    if (!id) return

    try {
      await deleteRecipeById(id)
      toast.success("Recipe has been deleted.")
      presenter.reset()
      setEditMode(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete recipe.")
    }
  }

  const onSubmit = async ({ title, directions: submittedDirections }: EditorValues) => {
    if (user == null) return
    setSaving(true)

    try {
      const id = presenter.getId()
      const file = presenter.getImageFile()
      // `editStep` is editor-only state and must not be persisted.
      const cleanDirections = submittedDirections.map(({ editStep: _editStep, ...rest }) => rest)
      const base = {
        title,
        ingredients,
        directions: cleanDirections,
        email: user.email,
        contributor: user.displayName,
      }

      if (id) {
        // Only overwrite the stored image when a new file was chosen — otherwise
        // keep the URL already attached to this recipe.
        const image = file ? await uploadImageToRecipeId(file, user.email, id) : currentImageUrl
        await updateRecipeById(id, { ...base, image: image ?? null })
        toast.success("Your recipe has been updated.")
      } else {
        // Create first so the image can be stored under the real recipe id.
        const created = await addRecipe({ ...base, image: null })
        if (file) {
          const image = await uploadImageToRecipeId(file, user.email, created.id)
          await updateRecipeById(created.id, { ...base, image })
        }
        toast.success("Your recipe has been added.")
      }

      presenter.reset()
      setEditMode(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Could not save recipe.")
    } finally {
      setSaving(false)
    }
  }

  const validate = (values: EditorValues) => {
    const errors: Record<string, string> = {}
    if (!values.title || values.title.length < 1) {
      errors.title = "A recipe title is required."
    }
    if (ingredients.length < 1) {
      errors.ingredients = "Please submit at least one ingredient."
    }
    if (!values.directions || values.directions.length < 1) {
      errors.directions = "At least one direction is required."
    }
    return errors
  }

  const editSteps = useMemo(() => {
    const steps: Record<string, string> = {}
    directions.forEach((section, i) => {
      if (section.editStep != null) {
        steps[`nextStep-${i}`] = section.steps[section.editStep]
      }
    })
    return steps
  }, [directions])

  const editIngredient = presenter.getEditIngredient()
  const initialValues: EditorValues = {
    title: presenter.getTitle(),
    image: presenter.getImageFile() ?? "",
    name: editIngredient.name ?? "",
    amount: editIngredient.amount ?? "",
    directions,
    optional: editIngredient.optional ?? false,
    unique: editIngredient.unique ?? false,
    section: (editSection != null ? directions[editSection]?.sectionTitle : "") ?? "",
    ...editSteps,
  }

  return (
    <Form<EditorValues>
      onSubmit={onSubmit}
      validate={validate}
      initialValues={initialValues}
      destroyOnUnregister>
      {({ handleSubmit, values, errors, form: { change } }) => (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            // Enter inside an ingredient/section/step field commits that row
            // instead of submitting the recipe.
            if (shouldNotSubmitAndFocusInputs(values, presenter, change)) return

            const messages = Object.values(errors ?? {})
            if (messages.length > 0) {
              messages.forEach((message) => toast.info(String(message)))
              return
            }
            void handleSubmit()
          }}>
          <Select<RecipeOption>
            className='mb-1 w-full max-w-[400px]'
            placeholder='Edit an existing recipe'
            options={options}
            value={editMode ? options.find((o) => o.value.id === presenter.getId()) : null}
            onChange={handleOnPulledRecipe}
            styles={{
              // The menu is portaled to <body> to escape the form's clipping, so
              // it needs an explicit place on the app's z-scale (see index.css):
              // above the recipe list's sticky filter, below the fixed toolbar
              // and nav bar. react-select's own default of 1 loses to the sticky
              // filter; the 999 this used to carry drew the open menu *over* the
              // toolbar as soon as the page scrolled.
              menuPortal: (base) => ({ ...base, zIndex: 35 }),
              // Long enough to be worth opening, short enough that it cannot
              // reach the nav bar at the bottom of the window.
              menu: (base) => ({ ...base, maxHeight: "50dvh" }),
              menuList: (base) => ({ ...base, maxHeight: "50dvh" }),
              // react-select's 38px default control is under the 44px touch
              // minimum, and its 14px text makes iOS zoom in on focus.
              control: (base) => ({ ...base, minHeight: 44 }),
              input: (base) => ({ ...base, fontSize: 16 }),
              placeholder: (base) => ({ ...base, fontSize: 16 }),
              singleValue: (base) => ({ ...base, fontSize: 16 }),
              option: (base) => ({ ...base, fontSize: 16, paddingTop: 10, paddingBottom: 10 }),
            }}
            menuPortalTarget={document.body}
          />

          <TextField
            name='title'
            fullWidth
            label='Recipe title'
            className='font-heading text-2xl font-bold'
            onChange={(event) => {
              change("title", event.target.value)
              presenter.setTitle(event.target.value)
            }}
          />

          <ImageUpload />

          <SectionHeading
            meta={`${ingredients.length} item${ingredients.length === 1 ? "" : "s"}`}>
            Ingredients
          </SectionHeading>
          <ListIngredients />
          <AddIngredient />

          <Directions />

          <AiAssistant />

          <div className='mt-8 flex flex-col items-stretch gap-2 border-t border-divider pt-4 max-sm:[&>button]:mr-0 sm:flex-row sm:items-center sm:justify-end'>
            {saving ? (
              <div className='flex justify-center'>
                <Spinner size={32} />
              </div>
            ) : (
              <>
                {editMode && <Button onClick={handleCancelEditMode}>Cancel</Button>}
                {/* The one solid accent object on the page — the page's single
                 *  real commitment, which is what `primary` is reserved for. */}
                <Button type='submit' variant='primary'>
                  {editMode ? "Update recipe" : "Save recipe"}
                </Button>
              </>
            )}
          </div>

          {editMode && (
            <div className='mt-16 sm:mt-20'>
              <Button
                onClick={() => setConfirmOpen(true)}
                danger
                className='w-full max-sm:mr-0 sm:w-auto'>
                <DeleteIcon />
                Delete recipe
              </Button>
            </div>
          )}

          <Dialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title='Delete recipe?'
            actions={
              <>
                <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button onClick={handleDelete} variant='primary' danger>
                  Delete recipe
                </Button>
              </>
            }>
            This removes the recipe for everyone. It cannot be undone.
          </Dialog>
        </form>
      )}
    </Form>
  )
}

export default RecipeEditor
