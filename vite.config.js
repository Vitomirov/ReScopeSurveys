import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import browserslist from 'browserslist'

const ESBUILD_FAMILY = {
  chrome: 'chrome',
  and_chr: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
  safari: 'safari',
  ios_saf: 'ios',
}

function versionBelow(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0)
    if (diff !== 0) return diff < 0
  }
  return false
}

/** Lowest version of each engine in package.json browserslist. Opera tracks Chrome. */
function esbuildTargetFromBrowserslist() {
  const lowest = new Map()
  for (const entry of browserslist()) {
    const [name, rawVersion = ''] = entry.split(' ')
    const version = rawVersion.split('-')[0]
    const family = ESBUILD_FAMILY[name]
    if (!family || !/^\d+(\.\d+)*$/.test(version || '')) continue
    const current = lowest.get(family)
    if (!current || versionBelow(version, current)) lowest.set(family, version)
  }
  for (const family of ['chrome', 'edge', 'firefox', 'safari', 'ios']) {
    if (!lowest.has(family)) {
      throw new Error(`browserslist is missing a ${family} target`)
    }
  }
  return [...lowest.entries()].map(([family, version]) => `${family}${version}`)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '3003'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './shared'),
      },
    },
    build: {
      target: esbuildTargetFromBrowserslist(),
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor'
            if (id.includes('@dnd-kit')) return 'dnd-kit'
            if (id.includes('lucide-react')) return 'lucide'
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        },
      },
    },
  }
})
