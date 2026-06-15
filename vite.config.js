import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
    base: command === 'serve' ? '/hydroiowa/riversensor/' : './',
    build: {
        sourcemap: true,
    },
    server: {
        port: 3432,
        // proxy: {
        //     '/hydroiowa/api': {
        //         target: 'https://s-iihr80.iihr.uiowa.edu',
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
        },
    }
}))