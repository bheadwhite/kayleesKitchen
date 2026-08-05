import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// jsdom has no layout, so scrolling is unimplemented and every call logs a
// "Not implemented" error. Views that scroll on navigation hit this.
window.scrollTo = vi.fn()
