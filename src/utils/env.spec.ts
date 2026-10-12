import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, getConfig, getCoordinates } from './env';

const mockGetSecretValue = vi.hoisted(() => vi.fn());
vi.mock('../implementations/secrets-manager-client', () => ({
    SecretsManagerClientImpl: vi.fn().mockImplementation(function () {
        return { getSecretValue: mockGetSecretValue };
    }),
}));

vi.mock('@aws-sdk/client-secrets-manager', () => ({
    SecretsManagerClient: vi.fn(),
}));

describe('Environment Utils', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = {
            ...originalEnv,
            SLACK_WEBHOOK_SECRET_ARN: 'arn:aws:secretsmanager:eu-central-1:123456789012:secret:test-secret',
            AWS_DEFAULT_REGION: 'eu-central-1',
            LOCATION_NAME: 'Munich',
            LOCATION_LAT: '48.1351',
            LOCATION_LON: '11.5820',
            DYNAMODB_TABLE_NAME: 'test-table',
            REPLY_API_URL: 'https://test.execute-api.eu-central-1.amazonaws.com/prod/reply',
            SLACK_CHANNEL: '#general',
        };

        vi.clearAllMocks();
        clearCache();

        mockGetSecretValue.mockResolvedValue({
            webhook_url: 'https://hooks.slack.com/services/test/webhook/url',
        });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('getConfig', () => {
        it('should return config with webhook URL from Secrets Manager', async () => {
            const config = await getConfig();

            expect(config).toEqual({
                slackWebhookUrl: 'https://hooks.slack.com/services/test/webhook/url',
                awsRegion: 'eu-central-1',
                locationName: 'Munich',
                locationLat: 48.1351,
                locationLon: 11.582,
                dynamodbTableName: 'test-table',
                replyApiUrl: 'https://test.execute-api.eu-central-1.amazonaws.com/prod/reply',
                minTemperature: 14,
                enableWeatherWarnings: false,
                goodWeatherConditions: ['clear', 'partly-cloudy'],
                badWeatherConditions: ['rain', 'drizzle', 'thunderstorm', 'snow'],
                weatherCheckHour: 12,
                slackChannel: '#general',
            });
        });

        it('should use event overrides when provided', async () => {
            const overrides = {
                slackWebhookUrl: 'https://hooks.slack.com/services/override/webhook',
                locationName: 'Berlin',
                locationLat: 52.52,
                locationLon: 13.405,
                minTemperature: 15,
                goodWeatherConditions: ['clear'],
                badWeatherConditions: ['rain'],
                weatherCheckHour: 14,
                slackChannel: '#berlin-lunch',
            };

            const config = await getConfig(overrides);

            expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/services/override/webhook');
            expect(config.locationName).toBe('Berlin');
            expect(config.locationLat).toBe(52.52);
            expect(config.locationLon).toBe(13.405);
            expect(config.minTemperature).toBe(15);
            expect(config.goodWeatherConditions).toEqual(['clear']);
            expect(config.badWeatherConditions).toEqual(['rain']);
            expect(config.weatherCheckHour).toBe(14);
            expect(config.slackChannel).toBe('#berlin-lunch');
        });

        it('should cache webhook URL from Secrets Manager', async () => {
            await getConfig();
            await getConfig();

            expect(mockGetSecretValue).toHaveBeenCalledTimes(1);
        });
    });

    describe('ENABLE_WEATHER_WARNINGS', () => {
        it('should parse the string "false" as false (regression: was coerced to true by z.coerce.boolean)', async () => {
            process.env['ENABLE_WEATHER_WARNINGS'] = 'false';

            const config = await getConfig();

            expect(config.enableWeatherWarnings).toBe(false);
        });

        it('should parse the string "true" as true', async () => {
            process.env['ENABLE_WEATHER_WARNINGS'] = 'true';

            const config = await getConfig();

            expect(config.enableWeatherWarnings).toBe(true);
        });

        it('should default to false when the variable is unset', async () => {
            delete process.env['ENABLE_WEATHER_WARNINGS'];
            clearCache();

            const config = await getConfig();

            expect(config.enableWeatherWarnings).toBe(false);
        });

        it('should parse non-canonical strings case-insensitively (zod 4.6.5 stringbool accepts "1", "yes", "TRUE")', async () => {
            // Observed behavior of zod@4.6.5 z.stringbool(): parsing is case-insensitive
            // ('TRUE' -> true), and the truthy set is true/1/yes/on/y/enabled, falsy set is
            // false/0/no/off/n/disabled. Anything else (e.g. '') is rejected with a ZodError.
            process.env['ENABLE_WEATHER_WARNINGS'] = 'TRUE';

            const config = await getConfig();

            expect(config.enableWeatherWarnings).toBe(true);
        });
    });

    describe('getCoordinates', () => {
        it('should return coordinates from config', async () => {
            const coordinates = await getCoordinates();

            expect(coordinates).toEqual({
                lat: 48.1351,
                lon: 11.582,
                locationName: 'Munich',
            });
        });

        it('should use event overrides for coordinates', async () => {
            const overrides = {
                locationName: 'Berlin',
                locationLat: 52.52,
                locationLon: 13.405,
            };

            const coordinates = await getCoordinates(overrides);

            expect(coordinates).toEqual({
                lat: 52.52,
                lon: 13.405,
                locationName: 'Berlin',
            });
        });
    });

    describe('Error handling', () => {
        it('should throw error if webhook_url not found in secret', async () => {
            clearCache();
            mockGetSecretValue.mockResolvedValue({
                some_other_key: 'value',
            });

            await expect(getConfig()).rejects.toThrow('webhook_url not found in secret');
        });

        it('should throw error if Secrets Manager call fails', async () => {
            clearCache();
            mockGetSecretValue.mockRejectedValue(new Error('Secrets Manager error'));

            await expect(getConfig()).rejects.toThrow('Secrets Manager error');
        });
    });
});
