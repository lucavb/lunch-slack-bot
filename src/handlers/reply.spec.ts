import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './reply';
import { clearCache } from '../utils/env';

type MockEvent = Pick<APIGatewayProxyEvent, 'httpMethod' | 'body' | 'queryStringParameters'>;

function createMockEvent(
    httpMethod: string,
    body: string | null = null,
    queryStringParameters: Record<string, string> | null = null,
) {
    return {
        httpMethod,
        body,
        queryStringParameters,
    } as const satisfies MockEvent;
}

describe('Reply Handler', () => {
    let mockStorageService: NonNullable<NonNullable<Parameters<typeof handler>[3]>['storageService']>;
    let mockSecretsManagerClient: NonNullable<NonNullable<Parameters<typeof handler>[3]>['secretsManagerClientImpl']>;

    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();

        mockStorageService = { hasLunchBeenConfirmedThisWeek: vi.fn(), recordLunchConfirmation: vi.fn() };
        mockSecretsManagerClient = { getSecretValue: vi.fn() };

        vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockResolvedValue(false);
        vi.spyOn(mockStorageService, 'recordLunchConfirmation').mockResolvedValue(undefined);
        vi.spyOn(mockSecretsManagerClient, 'getSecretValue').mockResolvedValue({
            webhook_url: 'https://hooks.slack.com/services/test/webhook/url',
        });
    });

    describe('CORS handling', () => {
        it('should handle OPTIONS requests correctly', async () => {
            const event = createMockEvent('OPTIONS', null, null);
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(200);
            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty(
                'Access-Control-Allow-Headers',
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            );
            expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        });

        it('should include CORS headers in all responses', async () => {
            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty(
                'Access-Control-Allow-Headers',
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            );
            expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        });
    });

    describe('HTTP method validation', () => {
        it('should reject non-POST/GET requests', async () => {
            const event = createMockEvent('PUT');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(405);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Method not allowed',
                allowedMethods: ['GET', 'POST', 'OPTIONS'],
            });
        });

        it('should handle GET requests with query parameters', async () => {
            const event = createMockEvent('GET', null, { action: 'confirm-lunch', location: 'Berlin' });
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.message).toContain('Thanks for confirming');
            expect(responseBody.location).toBe('Berlin');
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Berlin');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Berlin');
        });
    });

    describe('Request body validation', () => {
        it('should handle empty body with default action', async () => {
            const event = createMockEvent('POST', null);
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.message).toContain('Thanks for confirming');
            expect(responseBody.location).toBe('Munich');
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Munich');
        });

        it('should handle valid JSON body with action', async () => {
            const event = createMockEvent('POST', '{"action": "confirm-lunch", "location": "Berlin"}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.message).toContain('Thanks for confirming');
            expect(responseBody.location).toBe('Berlin');
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Berlin');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Berlin');
        });

        it('should handle invalid JSON body', async () => {
            const event = createMockEvent('POST', '{"invalid": json}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Invalid JSON in request body',
                details: expect.any(String),
            });
        });

        it('should reject unsupported actions', async () => {
            const event = createMockEvent('POST', '{"action": "unsupported-action"}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Invalid request parameters',
                details: expect.any(Array),
                allowedActions: ['confirm-lunch'],
            });
        });
    });

    describe('Lunch confirmation logic', () => {
        it('should record lunch confirmation when not already confirmed', async () => {
            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody).toEqual({
                message:
                    'Thanks for confirming! Lunch confirmed for this week. No more weather reminders will be sent.',
                action: 'confirm-lunch',
                location: 'Munich',
                confirmed: true,
                config: {
                    awsRegion: 'eu-central-1',
                    badWeatherConditions: ['rain', 'drizzle', 'thunderstorm', 'snow'],
                    dynamodbTableName: 'test-table',
                    goodWeatherConditions: ['clear', 'clouds'],
                    locationLat: 48.1351,
                    locationLon: 11.582,
                    locationName: 'Munich',
                    minTemperature: 12,
                    replyApiUrl: 'https://api.test.com',
                    slackWebhookUrl: '[REDACTED]',
                    weatherCheckHour: 12,
                },
            });

            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Munich');
        });

        it('should return already confirmed message when lunch already confirmed', async () => {
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockResolvedValue(true);

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody).toEqual({
                message: 'Lunch already confirmed this week! No more weather reminders will be sent.',
                location: 'Munich',
                alreadyConfirmed: true,
                config: {
                    awsRegion: 'eu-central-1',
                    dynamodbTableName: 'test-table',
                    slackWebhookUrl: '[REDACTED]',
                    replyApiUrl: 'https://api.test.com',
                    badWeatherConditions: ['rain', 'drizzle', 'thunderstorm', 'snow'],
                    goodWeatherConditions: ['clear', 'clouds'],
                    locationLat: 48.1351,
                    locationLon: 11.582,
                    locationName: 'Munich',
                    minTemperature: 12,
                    weatherCheckHour: 12,
                },
            });

            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
            expect(mockStorageService.recordLunchConfirmation).not.toHaveBeenCalled();
        });

        it('should use custom location from request body', async () => {
            const event = createMockEvent('POST', '{"action": "confirm-lunch", "location": "Berlin"}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.location).toBe('Berlin');
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Berlin');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Berlin');
        });
    });

    describe('Error handling', () => {
        it('should handle storage service errors', async () => {
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockRejectedValue(
                new Error('DynamoDB error'),
            );

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Internal server error',
                message: 'DynamoDB error',
            });

            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
        });

        it('should handle unknown errors', async () => {
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockRejectedValue('Unknown error');

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event, undefined, undefined, {
                storageService: mockStorageService,
                secretsManagerClientImpl: mockSecretsManagerClient,
            });

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Internal server error',
                message: 'Unknown error',
            });

            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
        });
    });
});
