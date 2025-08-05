import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { createReplyHandler, ReplyHandlerDependencies } from './reply';
import { clearCache } from '../utils/env';

type MockEvent = Pick<APIGatewayProxyEvent, 'httpMethod' | 'body' | 'queryStringParameters' | 'headers'>;

function createMockEvent(
    httpMethod: string,
    body: string | null = null,
    queryStringParameters: Record<string, string> | null = null,
    headers: Record<string, string> = {},
) {
    return {
        httpMethod,
        body,
        queryStringParameters,
        headers,
    } as const satisfies MockEvent;
}

describe('Reply Handler', () => {
    const createTestHandler = () => {
        const mockStorageService = {
            hasLunchBeenConfirmedForWeek: vi.fn(),
            recordLunchConfirmation: vi.fn(),
            setWeatherWarningOptInStatus: vi.fn(),
        } as const satisfies ReplyHandlerDependencies['storageService'];
        const mockSecretsManagerClient = {
            getSecretValue: vi.fn(),
        } as const satisfies ReplyHandlerDependencies['secretsManagerClient'];

        vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedForWeek').mockResolvedValue(false);
        vi.spyOn(mockStorageService, 'recordLunchConfirmation').mockResolvedValue(undefined);
        vi.spyOn(mockStorageService, 'setWeatherWarningOptInStatus').mockResolvedValue(undefined);
        vi.spyOn(mockSecretsManagerClient, 'getSecretValue').mockResolvedValue({
            webhook_url: 'https://hooks.slack.com/services/test/webhook/url',
        });

        const handler = createReplyHandler({
            storageService: mockStorageService,
            secretsManagerClient: mockSecretsManagerClient,
        });

        return {
            handler,
            mockStorageService,
            mockSecretsManagerClient,
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    describe('User agent filtering', () => {
        it('should block Slack link expanding bot requests', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent(
                'GET',
                null,
                { action: 'confirm-lunch' },
                { 'User-Agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)' },
            );
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual({ message: 'Bot request blocked' });
            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
        });

        it('should block requests with case-insensitive user agent header', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "confirm-lunch"}', null, {
                'user-agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
            });
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual({ message: 'Bot request blocked' });
        });

        it('should allow normal requests without Slack bot user agent', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent(
                'GET',
                null,
                { action: 'confirm-lunch' },
                { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            );
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
            expect(JSON.parse(result.body)).not.toEqual({ message: 'Bot request blocked' });
        });

        it('should allow requests without headers', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('GET', null, { action: 'confirm-lunch' });
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
        });
    });

    describe('CORS handling', () => {
        it('should handle OPTIONS requests correctly', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('OPTIONS');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
        });

        it('should include CORS headers in all responses', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
        });

        it('should handle unsupported HTTP methods', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('PUT', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(405);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Method not allowed',
                allowedMethods: ['GET', 'POST', 'OPTIONS'],
            });
        });
    });

    describe('Request validation', () => {
        it('should handle invalid JSON gracefully', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', 'invalid-json');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid JSON in request body');
        });

        it('should use default action when none provided', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', '{}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
        });

        it('should handle invalid action gracefully', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "invalid-action"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid request parameters');
        });

        it('should handle GET requests with query parameters', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('GET', null, { action: 'confirm-lunch' });
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
        });
    });

    describe('Lunch confirmation', () => {
        it('should confirm lunch when not already confirmed', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalled();

            const body = JSON.parse(result.body);
            expect(body.message).toContain('Thanks for confirming');
            expect(body.confirmed).toBe(true);
        });

        it('should handle already confirmed lunch', async () => {
            const { handler, mockStorageService } = createTestHandler();
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedForWeek').mockResolvedValue(true);

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
            expect(mockStorageService.recordLunchConfirmation).not.toHaveBeenCalled();

            const body = JSON.parse(result.body);
            expect(body.message).toContain('already confirmed');
            expect(body.alreadyConfirmed).toBe(true);
        });

        it('should use custom location when provided', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "confirm-lunch", "location": "Berlin"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalled();
        });
    });

    describe('Weather warning preferences', () => {
        it('should opt in to weather warnings', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "opt-in-warnings"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.setWeatherWarningOptInStatus).toHaveBeenCalledWith('Munich', true);

            const body = JSON.parse(result.body);
            expect(body.message).toContain('opted in to weather warnings');
            expect(body.optedIn).toBe(true);
        });

        it('should opt out of weather warnings', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "opt-out-warnings"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.setWeatherWarningOptInStatus).toHaveBeenCalledWith('Munich', false);

            const body = JSON.parse(result.body);
            expect(body.message).toContain('opted out of weather warnings');
            expect(body.optedIn).toBe(false);
        });

        it('should use custom location for weather warning preferences', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "opt-in-warnings", "location": "Frankfurt"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.setWeatherWarningOptInStatus).toHaveBeenCalledWith('Frankfurt', true);
        });
    });

    describe('Error handling', () => {
        it('should handle storage service errors gracefully', async () => {
            const { handler, mockStorageService } = createTestHandler();
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedForWeek').mockRejectedValue(new Error('Database error'));

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Internal server error');
        });

        it('should redact sensitive information from responses', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            const body = JSON.parse(result.body);
            expect(body.config.slackWebhookUrl).toBe('[REDACTED]');
        });
    });
});
