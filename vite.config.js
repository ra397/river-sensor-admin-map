import { defineConfig } from 'vite'

export default defineConfig({
    base: './',
    build: {
        sourcemap: true,
    },
    server: {
        // proxy: {
        //     '/api2': {
        //         target: 'http://localhost:8080',
        //         changeOrigin: true,
        //         secure: false,
        //     },
        // },
        proxy: {
            '/api2': {
                target: 'https://hydroiowa.org',
                changeOrigin: true,
                secure: false,
            },
        }
    }
})