import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        silent: true,
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
        exclude: ['node_modules', 'dist', 'terraform', '*.config.*'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{js,ts}'],
            exclude: ['src/**/*.{test,spec}.{js,ts}', 'src/**/*.d.ts'],
        },
        env: {
            AWS_DEFAULT_REGION: 'eu-central-1',
            DYNAMODB_TABLE_NAME: 'test-table',
            LOCATION_LAT: '48.1351',
            LOCATION_LON: '11.5820',
            LOCATION_NAME: 'Munich',
            REPLY_API_URL: 'https://api.test.com',
            SLACK_WEBHOOK_SECRET_ARN: 'arn:aws:secretsmanager:eu-central-1:123456789012:secret:test-secret',
        },
    },
});
