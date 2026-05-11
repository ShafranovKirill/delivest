import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import path from 'path'

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '../../')
  const loadedEnv = loadEnv(mode, rootDir, '')

  return {
    envDir: rootDir,
    envPrefix: ['VITE_', 'DB_', 'STORAGE_'],
    server: {
      port: Number(loadedEnv.VITE_PORT_WEB) || 5173,
    },
    plugins: [
      vue(),
      Components({
        resolvers: [PrimeVueResolver()],
      }),
    ],
    resolve: {
      alias: {
        '@delivest/types': path.resolve(__dirname, '../../libs/types/src/index.ts'),
        '@delivest/common': path.resolve(__dirname, '../../libs/common/src/index.ts'),
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
