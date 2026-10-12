import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { format, startOfWeek } from 'date-fns';
import { createReplyHandler, ReplyHandlerDependencies } from './reply';
import { clearCache } from '../utils/env';
import { createActionToken, verifyActionToken } from '../utils/action-token';
import { ACTION_TOKEN_TTL_DAYS } from '../utils/constants';

type MockEvent = Pick<APIGatewayProxyEvent, 'httpMethod' | 'body' | 'queryStringParameters' | 'headers'>;

const WEBHOOK_URL = 'https://hooks.slack.com/services/test/webhook/url';
const LOCATION = 'Munich';

const currentWeekStart = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

const makeToken = (action: string, overrides?: { location?: string; date?: string; ttlDays?: number }): string =>
    createActionToken(
        WEBHOOK_URL,
        action,
        overrides?.location ?? LOCATION,
        overrides?.date ?? currentWeekStart(),
        overrides?.ttlDays ?? ACTION_TOKEN_TTL_DAYS,
    );

const makeBody = (action: string, extra: Record<string, unknown> = {}): string =>
    JSON.stringify({
        action,
        date: currentWeekStart(),
        token: makeToken(action),
        ...extra,
    });

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
            webhook_url: WEBHOOK_URL,
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
            const token = makeToken('confirm-lunch');
            const event = createMockEvent(
                'GET',
                null,
                { action: 'confirm-lunch', date: currentWeekStart(), token },
                { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            );
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

        it('should include CORS headers on successful responses', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', makeBody('confirm-lunch'));
            const result = await handler(event);

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
        });

        it('should handle unsupported HTTP methods', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('PUT', makeBody('confirm-lunch'));
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

        it('should reject requests without an explicit action', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', '{}');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid request parameters');
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
        });

        it('should handle invalid action gracefully and no longer advertise reset-week', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', JSON.stringify({ action: 'invalid-action', token: 'x' }));
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid request parameters');
            expect(body.allowedActions).toContain('confirm-lunch');
            expect(body.allowedActions).toContain('opt-in-warnings');
            expect(body.allowedActions).toContain('opt-out-warnings');
            expect(body.allowedActions).not.toContain('reset-week');
        });

        it('should handle GET requests with query parameters', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const token = makeToken('confirm-lunch');
            const event = createMockEvent('GET', null, {
                action: 'confirm-lunch',
                date: currentWeekStart(),
                token,
            });
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
        });
    });

    describe('Token verification', () => {
        it('should reject requests with a missing token at the schema layer', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('confirm-lunch', { token: undefined }));
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid request parameters');
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
        });

        it('should reject requests with a structurally invalid token', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('confirm-lunch', { token: 'garbage-token' }));
            const result = await handler(event);

            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body)).toEqual({ error: 'Forbidden' });
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
        });

        it('should reject tokens bound to a different action', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('confirm-lunch', { token: makeToken('opt-in-warnings') }));
            const result = await handler(event);

            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body)).toEqual({ error: 'Forbidden' });
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
        });

        it('should reject tokens bound to a different location', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent(
                'POST',
                makeBody('confirm-lunch', { token: makeToken('confirm-lunch', { location: 'Berlin' }) }),
            );
            const result = await handler(event);

            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body)).toEqual({ error: 'Forbidden' });
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
        });

        it('should reject tokens bound to a past date', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent(
                'POST',
                makeBody('confirm-lunch', { token: makeToken('confirm-lunch', { date: '2026-01-05' }) }),
            );
            const result = await handler(event);

            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body)).toEqual({ error: 'Forbidden' });
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
        });

        it('should reject expired tokens', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent(
                'POST',
                makeBody('confirm-lunch', { token: makeToken('confirm-lunch', { ttlDays: -1 }) }),
            );
            const result = await handler(event);

            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body)).toEqual({ error: 'Forbidden' });
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
        });

        it('should accept a token generated by the server-issued link builder', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const token = makeToken('confirm-lunch');

            expect(verifyActionToken(WEBHOOK_URL, 'confirm-lunch', LOCATION, currentWeekStart(), token)).toBe(true);

            const event = createMockEvent('POST', makeBody('confirm-lunch', { token }));
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
        });
    });

    describe('Location allowlist', () => {
        it('should reject caller-supplied locations other than the configured location', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('opt-in-warnings', { location: 'Berlin' }));
            const result = await handler(event);

            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body)).toEqual({ error: 'Forbidden' });
            expect(mockStorageService.setWeatherWarningOptInStatus).not.toHaveBeenCalled();
        });

        it('should reject non-configured locations via GET as well', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('GET', null, {
                action: 'confirm-lunch',
                location: 'Hamburg',
                date: currentWeekStart(),
                token: makeToken('confirm-lunch'),
            });
            const result = await handler(event);

            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body)).toEqual({ error: 'Forbidden' });
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
        });
    });

    describe('Lunch confirmation', () => {
        it('should confirm lunch for the current week when not already confirmed', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('confirm-lunch'));
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalledWith(LOCATION, currentWeekStart());
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith(LOCATION, currentWeekStart());

            const body = JSON.parse(result.body);
            expect(body.message).toContain('Thanks for confirming');
            expect(body.confirmed).toBe(true);
            expect(body.weekStart).toBe(currentWeekStart());
        });

        it('should handle already confirmed lunch', async () => {
            const { handler, mockStorageService } = createTestHandler();
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedForWeek').mockResolvedValue(true);

            const event = createMockEvent('POST', makeBody('confirm-lunch'));
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).toHaveBeenCalled();
            expect(mockStorageService.recordLunchConfirmation).not.toHaveBeenCalled();

            const body = JSON.parse(result.body);
            expect(body.message).toContain('already confirmed');
            expect(body.alreadyConfirmed).toBe(true);
        });

        it('should ignore caller-supplied dates and record the server-derived week start', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('confirm-lunch'));
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith(LOCATION, currentWeekStart());
        });
    });

    describe('Server-side date rejection', () => {
        it('should reject dates that are not the current week start for all actions', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('confirm-lunch', { date: '2026-01-05' }));
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid date: confirmations may only target the current week');
            expect(body.expected).toBe(currentWeekStart());
            expect(mockStorageService.hasLunchBeenConfirmedForWeek).not.toHaveBeenCalled();
            expect(mockStorageService.recordLunchConfirmation).not.toHaveBeenCalled();
        });

        it('should reject future dates even with a matching token', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('opt-in-warnings', { date: '2030-01-07' }));
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid date: confirmations may only target the current week');
            expect(mockStorageService.setWeatherWarningOptInStatus).not.toHaveBeenCalled();
        });
    });

    describe('Weather warning preferences', () => {
        it('should opt in to weather warnings', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('opt-in-warnings'));
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.setWeatherWarningOptInStatus).toHaveBeenCalledWith(LOCATION, true);

            const body = JSON.parse(result.body);
            expect(body.message).toContain('opted in to weather warnings');
            expect(body.optedIn).toBe(true);
        });

        it('should opt out of weather warnings', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent('POST', makeBody('opt-out-warnings'));
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.setWeatherWarningOptInStatus).toHaveBeenCalledWith(LOCATION, false);

            const body = JSON.parse(result.body);
            expect(body.message).toContain('opted out of weather warnings');
            expect(body.optedIn).toBe(false);
        });
    });

    describe('Error handling', () => {
        it('should handle storage service errors gracefully', async () => {
            const { handler, mockStorageService } = createTestHandler();
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedForWeek').mockRejectedValue(new Error('Database error'));

            const event = createMockEvent('POST', makeBody('confirm-lunch'));
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Internal server error');
        });

        it('should redact sensitive information from responses', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', makeBody('confirm-lunch'));
            const result = await handler(event);

            const body = JSON.parse(result.body);
            expect(body.config.slackWebhookUrl).toBe('[REDACTED]');
        });
    });

    describe('Reset-week removal', () => {
        it('should reject the removed reset-week action at the schema layer', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('POST', makeBody('reset-week'));
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid request parameters');
            expect(body.allowedActions).not.toContain('reset-week');
        });

        it('should reject reset-week via GET request as well', async () => {
            const { handler } = createTestHandler();
            const event = createMockEvent('GET', null, {
                action: 'reset-week',
                date: currentWeekStart(),
                token: makeToken('reset-week'),
            });
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid request parameters');
        });
    });
});
