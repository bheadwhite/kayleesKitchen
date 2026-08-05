import { useEffect, useMemo, useState } from "react"
import { Form } from "react-final-form"
import Select from "react-select"
import { toast } from "react-toastify"

import { Button, Dialog, Spinner, WarningIcon } from "components"
import { TextField } from "components/finalForm"
import { ImageUpload } from "components/ImageUpload"
import { AddIngredient, Directions, ListIngredients } from "components/NewRecipe"
import { shouldNotSubmitAndFocusInputs } from "components/NewRecipe/utils"
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
  const user = useSessionUser()
  const directions = useDirections()
  const ingredients = useIngredients()
  const editSection = useEditSection()
  const currentImageUrl = useRecipeImageUrl()
  const usersRecipes = useUsersRecipes()

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Leave the editor clean for the next visit. The presenter itself is owned by
  // <RecipeProvider>, so this resets rather than disposes it.
  useEffect(() => () => presenter.reset(), [presenter])

  const options = useMemo<RecipeOption[]>(
    () =>
      usersRecipes
        .filter((recipe) => Boolean(recipe.title))
        .map((recipe) => ({ label: recipe.title, value: recipe })),
    [usersRecipes]
  )

  const handleOnPulledRecipe = async (option: RecipeOption | null) => {
    if (option == null || user == null) return
    const recipe = option.value

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
  }

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
            className='mb-1 max-w-[400px]'
            placeholder='Edit an existing recipe'
            options={options}
            value={editMode ? options.find((o) => o.value.id === presenter.getId()) : null}
            onChange={handleOnPulledRecipe}
            styles={{ menuPortal: (base) => ({ ...base, zIndex: 999 }) }}
            menuPortalTarget={document.body}
          />

          <TextField
            name='title'
            fullWidth
            label='Recipe Title'
            onChange={(event) => {
              change("title", event.target.value)
              presenter.setTitle(event.target.value)
            }}
          />

          <ImageUpload />

          <div className='relative mt-4 mb-1 rounded border border-brand-border p-1.5'>
            <div className='absolute -top-2.5 left-2.5 bg-white px-1.5'>Ingredients</div>
            <ListIngredients />
            <AddIngredient />
          </div>

          <Directions />

          <div className='mt-4 flex items-center justify-end gap-2 bg-brand-well p-4'>
            {saving ? (
              <Spinner size={32} />
            ) : (
              <>
                {editMode && <Button onClick={handleCancelEditMode}>Cancel</Button>}
                <Button type='submit'>{editMode ? "Update Recipe" : "Submit Recipe"}</Button>
              </>
            )}
          </div>

          {editMode && (
            <div className='mt-20 mb-52'>
              <Button onClick={() => setConfirmOpen(true)} danger>
                Delete Recipe
              </Button>
            </div>
          )}

          <Dialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title='Delete recipe?'>
            <div className='p-4'>
              <WarningIcon className='text-brand-red' />
              <p className='my-2'>Are you sure you want to delete this Recipe?</p>
              <Button onClick={() => setConfirmOpen(false)}>No</Button>
              <Button onClick={handleDelete} danger>
                Yes
              </Button>
            </div>
          </Dialog>
        </form>
      )}
    </Form>
  )
}

export default RecipeEditor
