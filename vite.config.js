import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {

      '/api/auth/login': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth\/login\/?/, '/api/users/login')
      },
      '/vendor/register-request/': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/workflows': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/users': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/dashboard': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/reports': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/locations': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/locations/, '/api/locations/')
      },
      '/api/materials': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api/employee/quote-comparison': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/employee/award-quote': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/employee': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/vendors/all': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/vendors\/all\/?$/, '/api/vendors/all/')
      },
      '/api/vendors': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/api/vendor/asns/history/.+': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/api/vendor/asns/.+': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '^/api/vendor/asns/?$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/vendor/create-pr-options': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api/vendor/selection-list': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '^/api/vendor/purchase-orders/\\d+/?$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/api/vendor/purchase-requisitions/[^/]+/create-rfq/?$': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api/vendor/purchase-requisitions': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/vendor/quotations': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/purchase-requisitions': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/vendor/gate-entry': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/vendor/all': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api/vendor': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/stages': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/auth/me': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/messages': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/requests': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/extract-invoice': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/extract-invoice/, '/extract-invoice')
      },
      '/api/budget': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/budget/, '/api')
      },
      '/api/department-status': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/organization': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      }
    }
  }
})
