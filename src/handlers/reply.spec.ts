import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { createReplyHandler, ReplyHandlerDependencies } from './reply';
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
    const createTestHandler = () => {
        const mockStorageService = {
            hasLunchBeenConfirmedThisWeek: vi.fn(),
            recordLunchConfirmation: vi.fn(),
            setWeatherWarningOptInStatus: vi.fn(),
        } as const satisfies ReplyHandlerDependencies['storageService'];
        const mockSecretsManagerClient = {
            getSecretValue: vi.fn(),
        } as const satisfies ReplyHandlerDependencies['secretsManagerClient'];

        vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockResolvedValue(false);
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

    describe('CORS handling', () => {
        it('should handle OPTIONS requests correctly', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('OPTIONS', null, null);
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
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalled();
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
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalled();
        });
    });

    describe('Lunch confirmation', () => {
        it('should confirm lunch when not already confirmed', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Munich');

            const body = JSON.parse(result.body);
            expect(body.message).toContain('Thanks for confirming');
            expect(body.confirmed).toBe(true);
        });

        it('should handle already confirmed lunch', async () => {
            const { handler, mockStorageService } = createTestHandler();
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockResolvedValue(true);

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
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
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Berlin');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Berlin');
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
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockRejectedValue(
                new Error('Database error'),
            );

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
