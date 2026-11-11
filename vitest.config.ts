import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
        server: {
            deps: {
                // openxmlsdkts/ltxmlts are published as ESM with extensionless imports, which Node can't
                // resolve on its own: let Vite transform them like it does for the tool bundle.
                inline: ['openxmlsdkts', 'ltxmlts'],
            },
        },
    },
});
