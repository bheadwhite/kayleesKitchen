import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Form } from "react-final-form"
import Select from "react-select"
import { toast } from "react-toastify"

import { Button, DeleteIcon, Dialog, RedoIcon, SectionHeading, Spinner, UndoIcon } from "components"
import { AssistantDrawer } from "components/AiAssistant"
import { TextField } from "components/finalForm"
import { ImageUpload } from "components/ImageUpload"
import { AddIngredient, Directions, ListIngredients, Makes, Tags } from "components/NewRecipe"
import { shouldNotSubmitAndFocusInputs } from "components/NewRecipe/utils"
import { diffRecipe } from "@/recipeDiff"
import { useAiDraftPresenter } from "contexts/AiDraftProvider"
import { useSessionUser } from "contexts/AuthProvider"
import {
  useDirections,
  useEditIngredientIndex,
  useEditSection,
  useIngredients,
  useRecipeHistory,
  useRecipeImageUrl,
  useRecipePresenter,
  useServes,
  useServingSize,
  useTags,
} from "contexts/RecipeProvider"
import useTagLibrary from "hooks/useTagLibrary"
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
  const tags = useTags()
  const serves = useServes()
  const servingSize = useServingSize()
  const editSection = useEditSection()
  // Subscribed here, not just in the list: `initialValues` below is what fills
  // the editor's fields, and it is only rebuilt when this component renders.
  const editIngredientIndex = useEditIngredientIndex()
  const currentImageUrl = useRecipeImageUrl()
  // Subscribed for the buttons' disabled state — and because an undo restores
  // the title, which only reaches the form through a rebuilt `initialValues`.
  const history = useRecipeHistory()
  const usersRecipes = useUsersRecipes()
  // Every tag anyone has used, so a second recipe gets "mexican" off a chip
  // rather than "Mexican food" out of someone's memory.
  // And every title in the box, so an idea the chef comes up with is one the
  // household does not already have filed. Same listener, so it costs nothing.
  const { tags: tagLibrary, colors: tagColors, recipeTitles } = useTagLibrary()

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  // Leave the editor clean for the next visit. Both presenters are owned by
  // their providers, so this resets rather than disposes them.
  useEffect(
    () => () => {
      presenter.reset()
      assistant.reset()
    },
    [presenter, assistant]
  )

  /**
   * ⌘Z / ⌘⇧Z for the whole recipe.
   *
   * Keystrokes inside a text field are left alone: the browser's own undo is
   * already there, it is finer-grained than this one, and taking it over would
   * mean ⌘Z inside a half-typed step threw away the step instead of the letter.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return

      event.preventDefault()
      if (event.shiftKey) presenter.redo()
      else presenter.undo()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [presenter])

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
    setDiscardOpen(false)
    presenter.reset()
    setEditMode(false)
  }

  /**
   * Cancel throws away everything since the last save, so with changes on the
   * screen it asks first. Without them there is nothing to lose and a dialog
   * would just be in the way.
   */
  const requestCancel = (pending: number) => {
    if (pending > 0) setDiscardOpen(true)
    else handleCancelEditMode()
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
        tags,
        // Firestore rejects `undefined`, and these are genuinely absent on a
        // recipe that does not say — null is what "not said" is stored as.
        serves: serves ?? null,
        servingSize: servingSize ?? null,
        email: user.email,
        contributor: user.displayName,
      }

      if (id) {
        // Only overwrite the stored image when a new file was chosen — otherwise
        // keep the URL already attached to this recipe.
        const image = file ? await uploadImageToRecipeId(file, user.email, id) : currentImageUrl
        await updateRecipeById(id, { ...base, image: image ?? null })

        // Updating leaves you where you were. Clearing the editor after an
        // update threw away the thing you were working on to prove it had been
        // saved, and the recipe on the screen is exactly the one that was just
        // written — so it stays, and becomes the new "unchanged".
        presenter.setImageFile(null) // Committed now; a re-save must not re-upload it.
        presenter.setImageUrl(image ?? null)
        presenter.markSaved(title, Boolean(image))
        toast.success("Your recipe has been updated.")
        return
      }

      // A brand-new recipe is filed away and the editor goes back to blank —
      // "Save recipe" means this one is done, and the next thing you type is a
      // different recipe rather than an edit of that one.
      const created = await addRecipe({ ...base, image: null })
      if (file) {
        const image = await uploadImageToRecipeId(file, user.email, created.id)
        await updateRecipeById(created.id, { ...base, image })
      }
      toast.success("Your recipe has been added.")

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

  const editIngredient = editIngredientIndex == null ? null : ingredients[editIngredientIndex]
  const initialValues: EditorValues = {
    title: presenter.getTitle(),
    image: presenter.getImageFile() ?? "",
    name: editIngredient?.name ?? "",
    amount: editIngredient?.amount ?? "",
    directions,
    tag: "",
    optional: editIngredient?.optional ?? false,
    unique: editIngredient?.unique ?? false,
    section: (editSection != null ? directions[editSection]?.sectionTitle : "") ?? "",
    ...editSteps,
  }

  return (
    <>
    <Form<EditorValues>
      onSubmit={onSubmit}
      validate={validate}
      initialValues={initialValues}
      destroyOnUnregister>
      {({ handleSubmit, values, errors, form: { change } }) => {
        // What is on the screen versus what was last saved. Computed here
        // rather than in the presenter because the title belongs to the form —
        // and it costs nothing: every input is already in hand.
        const changes = diffRecipe(presenter.getBaseline(), {
          title: values.title ?? "",
          serves,
          servingSize,
          ingredients,
          directions,
          tags,
          hasImage: currentImageUrl != null || presenter.getImageFile() != null,
        })

        // Nothing has been saved yet, so "new" is not news: a brand-new recipe
        // would otherwise wear a flag and a tint on every line it has.
        const marked = presenter.getBaseline() != null

        return (
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
          }}
          // Room for the save bar, which is fixed and so out of flow — without
          // this the last thing on the page sits underneath it.
          className='pb-[var(--editor-actions-h)]'>
          {/* Sticks for the reason the recipe list's search and the recipe
           *  page's action row do: this is the way into every *other* recipe,
           *  and the editor is a long form, so switching meant scrolling a whole
           *  recipe back up to reach it. With no title bar above it, this is the
           *  top bar of the page.
           *
           *  The negative margins reach back through the content column's own
           *  padding so the background covers the full width; without them the
           *  form slides visibly past on both sides. The menu is portaled to
           *  <body> (z-35), so it escapes the stacking context this creates and
           *  still opens over the form. */}
          <div className='sticky top-[var(--chrome-top)] z-30 -mx-3 mb-1 bg-ground px-3 pt-1 pb-2 sm:-mx-2.5 sm:px-2.5'>
            <Select<RecipeOption>
              className='w-full max-w-[400px]'
              placeholder='Edit an existing recipe'
              options={options}
              value={editMode ? options.find((o) => o.value.id === presenter.getId()) : null}
              onChange={handleOnPulledRecipe}
              styles={{
                // The menu is portaled to <body> to escape the form's clipping,
                // so it needs an explicit place on the app's z-scale (see
                // index.css): above the sticky bars, below the fixed chrome.
                // react-select's own default of 1 loses to the sticky filter;
                // the 999 this used to carry drew the open menu *over* the
                // fixed chrome as soon as the page scrolled.
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
          </div>

          <TextField
            name='title'
            fullWidth
            // The label is already the mono/uppercase meta line for this field,
            // so it is where the flag goes rather than another element.
            label={changes.title ? "Recipe title · changed" : "Recipe title"}
            className='font-heading text-2xl font-bold'
            onChange={(event) => {
              change("title", event.target.value)
              presenter.setTitle(event.target.value)
            }}
          />

          <ImageUpload />

          <Makes changed={marked && changes.makes} />

          <Tags
            known={tagLibrary}
            added={marked ? changes.tagsAdded : []}
            removed={marked ? changes.tagsRemoved : []}
          />

          <SectionHeading
            meta={`${ingredients.length} item${ingredients.length === 1 ? "" : "s"}${
              marked && changes.ingredientsRemoved > 0
                ? ` · ${changes.ingredientsRemoved} removed`
                : ""
            }`}>
            Ingredients
          </SectionHeading>
          <ListIngredients changes={marked ? changes.ingredients : undefined} />
          <AddIngredient />

          <Directions changes={marked ? changes.sections : undefined} />

          {/* Saving sits on the screen rather than at the end of it. The editor
           *  is a long form — ingredients, a dozen steps, an assistant — and
           *  the commitment it exists for was three scrolls away from wherever
           *  you were typing. Fixed directly on top of the nav bar, so the two
           *  read as one piece of chrome; `left/right-0` with the inner row
           *  capped at the content width keeps the fill edge-to-edge while the
           *  buttons stay in the column. */}
          <div className='fixed right-0 bottom-[calc(var(--navbar-h)+var(--sai-bottom))] left-0 z-40 border-t border-divider bg-ground'>
            <div className='mx-auto flex h-[var(--editor-actions-h)] w-full max-w-[900px] items-center gap-2 px-3 sm:px-2.5'>
              {/* The running count of what is unsaved, in the same mono voice as
               *  every other counter here. It is also the answer to "did that
               *  apply do anything?" — an assistant draft lands as a number. */}
              {/* Undo sits with the other things you do to the whole recipe,
               *  and stays reachable wherever the page is scrolled — the same
               *  reason the save button is here. */}
              <Button
                icon
                variant='ghost'
                onClick={() => presenter.undo()}
                disabled={!history.canUndo}
                aria-label='Undo'
                title='Undo (⌘Z)'
                className='mt-0 mr-0'>
                <UndoIcon />
              </Button>
              <Button
                icon
                variant='ghost'
                onClick={() => presenter.redo()}
                disabled={!history.canRedo}
                aria-label='Redo'
                title='Redo (⇧⌘Z)'
                className='mt-0 mr-0'>
                <RedoIcon />
              </Button>

              <span className='flex-1 truncate font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
                {changes.count === 0
                  ? editMode
                    ? "No changes"
                    : ""
                  : `${changes.count} unsaved change${changes.count === 1 ? "" : "s"}`}
              </span>

              {saving ? (
                <Spinner size={28} />
              ) : (
                <>
                  {editMode && (
                    <Button onClick={() => requestCancel(changes.count)} className='mt-0 mr-0'>
                      Cancel
                    </Button>
                  )}
                  {/* The one solid accent object on the page — the page's single
                   *  real commitment, which is what `primary` is reserved for.
                   *  Disabled with nothing to save: an Update that writes the
                   *  same bytes back still says "updated", which teaches you to
                   *  distrust the message. */}
                  <Button
                    type='submit'
                    variant='primary'
                    disabled={changes.count === 0}
                    className='mt-0 mr-0'>
                    {editMode ? "Update recipe" : "Save recipe"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Deleting stays at the far end of the scroll, deliberately: it is
           *  the one action here that cannot be undone, and it has no business
           *  sitting a thumb's width from Update. */}
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

          <Dialog
            open={discardOpen}
            onClose={() => setDiscardOpen(false)}
            title='Discard changes?'
            actions={
              <>
                <Button onClick={() => setDiscardOpen(false)}>Keep editing</Button>
                <Button onClick={handleCancelEditMode} variant='primary' danger>
                  Discard
                </Button>
              </>
            }>
            {`${changes.count} change${changes.count === 1 ? "" : "s"} to this recipe ` +
              "have not been saved. Closing the editor drops them."}
          </Dialog>
        </form>
        )
      }}
    </Form>

    {/* Outside the <form> on purpose: it owns a textarea and a file picker, and
     *  nothing in it belongs to react-final-form or to the recipe's submit. */}
    {/* The editor already holds the vocabulary for its own tag picker, so the
     *  chef reads it from here rather than opening a second listener over
     *  every recipe in the box. */}
    <AssistantDrawer
      tagLibrary={tagLibrary.map((tag) => tag.name)}
      recipeTitles={recipeTitles}
      tagColors={tagColors}
    />
    </>
  )
}

export default RecipeEditor
