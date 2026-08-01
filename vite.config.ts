/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

const PWA_MANIFEST = {
  name: 'Glamorous Gallery By Mahi',
  short_name: 'Glamorous Gallery',
  description: 'Multi-Branch Fashion Retail & E-commerce Business Automation System',
  theme_color: '#F8F6F2',
  background_color: '#F8F6F2',
  lang: 'en',
  dir: 'ltr' as const,
  categories: ['shopping', 'fashion', 'lifestyle'] as const,
}

const analyzeBundle = process.env.ANALYZE === '1'

const appBuildId =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.GITHUB_SHA ??
  `local-${Date.now()}`

function injectBuildIdMeta(): Plugin {
  return {
    name: 'inject-build-id-meta',
    transformIndexHtml(html) {
      const meta = `<meta name="app-build-id" content="${appBuildId}" />`
      if (html.includes('name="app-build-id"')) {
        return html.replace(/<meta name="app-build-id" content="[^"]*" \/>/, meta)
      }
      return html.replace('</head>', `    ${meta}\n  </head>`)
    },
  }
}

export default defineConfig({
  base: '/',
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  plugins: [
    injectBuildIdMeta(),
    react({
      jsxRuntime: 'automatic',
    }),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-512-maskable.png',
        'icons/apple-touch-icon.png',
        'icons/icon-monochrome.png',
        'offline.html',
      ],
      manifest: {
        name: PWA_MANIFEST.name,
        short_name: PWA_MANIFEST.short_name,
        description: PWA_MANIFEST.description,
        theme_color: PWA_MANIFEST.theme_color,
        background_color: PWA_MANIFEST.background_color,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: PWA_MANIFEST.lang,
        dir: PWA_MANIFEST.dir,
        categories: [...PWA_MANIFEST.categories],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-monochrome.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'monochrome',
          },
        ],
      },
      workbox: {
        globPatterns: ['index.html', 'offline.html', 'manifest.webmanifest', 'favicon.svg', 'icons/*'],
        globIgnores: ['**/assets/**', '**/*.map'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/print\//, /^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin === true &&
              request.method === 'GET' &&
              request.mode === 'navigate' &&
              !url.pathname.startsWith('/print/') &&
              !url.pathname.startsWith('/assets/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    analyzeBundle
      ? visualizer({
          filename: 'dist/bundle-report.html',
          gzipSize: true,
          brotliSize: true,
          open: false,
          template: 'treemap',
        })
      : undefined,
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'vendor-router-query',
              test: /node_modules[\\/](react-router|react-router-dom|@tanstack[\\/]react-query)[\\/]/,
            },
            {
              name: 'vendor-supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
            },
            {
              name: 'vendor-recharts',
              test: /node_modules[\\/](recharts|d3-[^/]+|internmap|victory-vendor)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/test/setup/vitest.setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Gate on unit-tested logic paths; page/UI trees climb separately toward 80%.
      include: [
        'src/features/pos/cart-utils.ts',
        'src/features/pos/pos-workflows.ts',
        'src/features/sales/schemas/**',
        'src/features/accounting/repositories/unified-core-wrappers.ts',
        'src/lib/permissions/**',
        'src/components/permission-gate/**',
        'src/app/guards/PermissionRoute.tsx',
      ],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**'],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },
  },
})
