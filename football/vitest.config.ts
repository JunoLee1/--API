/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vitest 전용 설정.
 *
 * vite.config.ts 와 별개로 유지하는 이유:
 * - tailwindcss plugin 은 test 환경(jsdom) 에서 불필요하며, PostCSS 파이프라인이
 *   무거우면 test collection 이 느려진다.
 * - server proxy 등 dev 전용 설정은 test 에 무관.
 * - `@` 경로 alias 만 그대로 재사용.
 *
 * `esbuild.jsx = 'automatic'` 를 명시하는 이유:
 * @vitejs/plugin-react v6 은 프로덕션 빌드에서 oxc 로 JSX 를 자동 런타임으로
 * 변환하지만, Vitest 는 파일을 esbuild 로 트랜스파일한다. esbuild 의 JSX 기본값은
 * classic (`React.createElement`) 이므로 `React` 심볼이 import 되지 않은 컴포넌트/
 * 테스트 파일에서 `ReferenceError: React is not defined` 가 발생한다.
 * `jsx: 'automatic'` 을 설정하면 esbuild 가 `react/jsx-runtime` 을 자동 주입한다.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'src/generated/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
})
