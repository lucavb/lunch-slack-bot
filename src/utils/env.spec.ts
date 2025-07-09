import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
    SLACK_WEBHOOK_URL: z.string().url('SLACK_WEBHOOK_URL must be a valid URL'),
    WEATHER_API_KEY: z.string().min(1, 'WEATHER_API_KEY is required'),
    AWS_REGION: z.string().default('eu-central-1'),
    LOCATION_NAME: z.string().min(1, 'LOCATION_NAME is required'),
    LOCATION_LAT: z
        .string()
        .transform((val) => parseFloat(val))
        .pipe(z.number().min(-90).max(90)),
    LOCATION_LON: z
        .string()
        .transform((val) => parseFloat(val))
        .pipe(z.number().min(-180).max(180)),
    DYNAMODB_TABLE_NAME: z.string().min(1, 'DYNAMODB_TABLE_NAME is required'),
});

// Validation function that can be injected
const validateEnv = (env: Record<string, string | undefined>) => {
    return envSchema.parse(env);
};

describe('Environment Validation', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('validateEnv', () => {
        it('should validate all required environment variables', () => {
            const validEnv = {
                SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
                WEATHER_API_KEY: 'test-weather-key',
                AWS_REGION: 'eu-central-1',
                LOCATION_NAME: 'Munich',
                LOCATION_LAT: '48.1351',
                LOCATION_LON: '11.5820',
                DYNAMODB_TABLE_NAME: 'test-table',
            };

            const result = validateEnv(validEnv);
            expect(result.SLACK_WEBHOOK_URL).toBe('https://hooks.slack.com/services/test');
            expect(result.WEATHER_API_KEY).toBe('test-weather-key');
            expect(result.AWS_REGION).toBe('eu-central-1');
            expect(result.LOCATION_NAME).toBe('Munich');
            expect(result.LOCATION_LAT).toBe(48.1351);
            expect(result.LOCATION_LON).toBe(11.582);
            expect(result.DYNAMODB_TABLE_NAME).toBe('test-table');
        });

        it('should use default AWS region when not provided', () => {
            const validEnv = {
                SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
                WEATHER_API_KEY: 'test-weather-key',
                LOCATION_NAME: 'Munich',
                LOCATION_LAT: '48.1351',
                LOCATION_LON: '11.5820',
                DYNAMODB_TABLE_NAME: 'test-table',
            };

            const result = validateEnv(validEnv);
            expect(result.AWS_REGION).toBe('eu-central-1');
        });

        it('should throw error for invalid webhook URL', () => {
            const invalidEnv = {
                SLACK_WEBHOOK_URL: 'not-a-url',
                WEATHER_API_KEY: 'test-weather-key',
                LOCATION_NAME: 'Munich',
                LOCATION_LAT: '48.1351',
                LOCATION_LON: '11.5820',
                DYNAMODB_TABLE_NAME: 'test-table',
            };

            expect(() => validateEnv(invalidEnv)).toThrow();
        });

        it('should throw error for missing WEATHER_API_KEY', () => {
            const invalidEnv = {
                SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
                LOCATION_NAME: 'Munich',
                LOCATION_LAT: '48.1351',
                LOCATION_LON: '11.5820',
                DYNAMODB_TABLE_NAME: 'test-table',
            };

            expect(() => validateEnv(invalidEnv)).toThrow();
        });

        it('should throw error for invalid latitude', () => {
            const invalidEnv = {
                SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
                WEATHER_API_KEY: 'test-weather-key',
                LOCATION_NAME: 'Munich',
                LOCATION_LAT: '100', // Invalid latitude
                LOCATION_LON: '11.5820',
                DYNAMODB_TABLE_NAME: 'test-table',
            };

            expect(() => validateEnv(invalidEnv)).toThrow();
        });

        it('should throw error for invalid longitude', () => {
            const invalidEnv = {
                SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
                WEATHER_API_KEY: 'test-weather-key',
                LOCATION_NAME: 'Munich',
                LOCATION_LAT: '48.1351',
                LOCATION_LON: '200', // Invalid longitude
                DYNAMODB_TABLE_NAME: 'test-table',
            };

            expect(() => validateEnv(invalidEnv)).toThrow();
        });

        it('should throw error for missing LOCATION_NAME', () => {
            const invalidEnv = {
                SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
                WEATHER_API_KEY: 'test-weather-key',
                LOCATION_LAT: '48.1351',
                LOCATION_LON: '11.5820',
                DYNAMODB_TABLE_NAME: 'test-table',
            };

            expect(() => validateEnv(invalidEnv)).toThrow();
        });

        it('should throw error for missing DYNAMODB_TABLE_NAME', () => {
            const invalidEnv = {
                SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
                WEATHER_API_KEY: 'test-weather-key',
                LOCATION_NAME: 'Munich',
                LOCATION_LAT: '48.1351',
                LOCATION_LON: '11.5820',
            };

            expect(() => validateEnv(invalidEnv)).toThrow();
        });
    });
});
