import { defineConfig } from 'vite'

export default defineConfig({
    base: '/hydroiowa/riversensor',
    server: {
        port: 3432,
        proxy: {
            '/hydroiowa/api': {
                target: 'https://s-iihr80.iihr.uiowa.edu',
                changeOrigin: true,
                secure: false,
            },
        }
    }
})