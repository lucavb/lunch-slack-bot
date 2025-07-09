import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
        exclude: ['node_modules', 'dist', 'terraform', '*.config.*'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{js,ts}'],
            exclude: ['src/**/*.{test,spec}.{js,ts}', 'src/**/*.d.ts'],
        },
        env: {
            SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
            WEATHER_API_KEY: 'test-weather-key',
            LOCATION_NAME: 'Munich',
            LOCATION_LAT: '48.1351',
            LOCATION_LON: '11.5820',
            DYNAMODB_TABLE_NAME: 'test-table',
            AWS_REGION: 'eu-central-1',
        },
    },
});
