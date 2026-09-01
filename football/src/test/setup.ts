/**
 * Vitest 전역 setup.
 *
 * - `@testing-library/jest-dom/vitest` matchers 를 `expect` 에 확장 등록
 * - Node 25 built-in localStorage/sessionStorage 무효화 이슈 shim
 * - 각 테스트 종료 후 render 된 DOM 을 정리 (RTL 표준 패턴)
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Node 25 부터 experimental `--experimental-webstorage` 로 `localStorage` /
 * `sessionStorage` 를 native 로 제공하지만 `--localstorage-file` 이 지정되지
 * 않으면 method 들이 undefined 로 남아 있다. Vitest 워커는 `--localstorage-file`
 * 없이 노드를 spawn 하므로 그대로 두면 앱 코드가 `localStorage.getItem is not
 * a function` 으로 폭발한다. jsdom 은 globalThis 에 이미 storage 가 있으면
 * override 하지 않기 때문에, setup 단계에서 in-memory 구현으로 대체한다.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.has(key) ? (store.get(key) as string) : null
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: createMemoryStorage(),
})
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  writable: true,
  value: createMemoryStorage(),
})

beforeEach(() => {
  // 테스트 사이 storage 상태 격리
  globalThis.localStorage.clear()
  globalThis.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
})
