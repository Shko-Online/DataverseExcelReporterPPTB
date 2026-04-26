import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fixHtmlForPPTB from './vite-plugin-fix-html-for-pptb';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), fixHtmlForPPTB()],
    base: './',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                // Use IIFE format for compatibility with iframe srcdoc loading
                // ES modules can have issues when loaded via file:// URLs in iframes
                format: 'iife',
                // Bundle everything into a single file to avoid module loading issues
                inlineDynamicImports: true,
                // Disable chunking since we're bundling everything
                manualChunks: undefined,
            },
        },
    },
});
