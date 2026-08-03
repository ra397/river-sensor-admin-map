import { defineConfig } from 'vite';

export default defineConfig({
    base: '/map/',
    server: {
        proxy: {
            '/api2': {
                target: 'http://localhost:8088',
                changeOrigin: true,
            },
        },
    },
});