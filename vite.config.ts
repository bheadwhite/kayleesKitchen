import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import checker from 'vite-plugin-checker'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
    checker({ typescript: true }), // Add the checker plugin here
  ],
server: {
    port: 3000,
    //proxy: {
    //  '/api': {
    //    target: '<EXAMPLE_BACKEND.COM>:8080',
    //    changeOrigin: true,
    //    rewrite: (path) => path.replace(/^\/api/, ''), // Optionally strip out the '/api' base path
    //  },
    //},
    //cors: false,
  }
})
