/**
 * Global test setup loaded by every vitest test file (see vitest.config.ts).
 *
 * - Registers Testing Library's jest-dom DOM matchers.
 * - Polyfills browser APIs jsdom lacks or that PrimeReact/theming code expects
 *   (window.matchMedia, ResizeObserver).
 * - Stubs global fetch so accidental API calls during smoke tests fail softly;
 *   individual tests override it via vi.stubGlobal/vi.spyOn as needed.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// --- window.matchMedia ---------------------------------------------------
// jsdom does not implement matchMedia; ThemeContext + media-query.ts depend on
// it for the light/dark/system theme switch.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated but still used by some libs
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// --- ResizeObserver ------------------------------------------------------
// Some PrimeReact components measure their container on mount.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
}

// --- fetch stub ------------------------------------------------------------
// Default soft-fail network layer. Tests that exercise the API client should
// replace this with vi.spyOn(globalThis, 'fetch') / vi.stubGlobal('fetch', ...).
vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
)

// --- isolation -------------------------------------------------------------
// tokens.ts and ThemeContext persist state in localStorage; clear it between
// tests so ordering never matters.
afterEach(() => {
  window.localStorage.clear()
})
