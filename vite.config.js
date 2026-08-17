import { defineConfig } from 'vite';

export default defineConfig({
    base: '/map/',
    server: {
        proxy: {
            '/api2': {
                target: 'https://localhost:443',
                changeOrigin: true,
                secure: false,
            },
        },
    },
});