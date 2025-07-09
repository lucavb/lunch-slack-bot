import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './reply';

// Mock the dependencies
vi.mock('../utils/env', () => ({
    getConfig: vi.fn(() => ({
        dynamodbTableName: 'test-table',
        awsRegion: 'eu-central-1',
    })),
    getCoordinates: vi.fn(() => ({
        lat: 48.1351,
        lon: 11.582,
        locationName: 'Munich',
    })),
    eventOverridesSchema: {
        optional: () => ({
            safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
        }),
    },
}));

vi.mock('../implementations/dynamodb-storage', () => ({
    DynamoDBStorageService: vi.fn(() => mockStorageService),
}));

// Create mock storage service
const mockStorageService = {
    hasLunchBeenConfirmedThisWeek: vi.fn(),
    recordLunchConfirmation: vi.fn(),
};

describe('Reply Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockEvent = (
        httpMethod: string = 'POST',
        body: string | null = null,
        queryStringParameters: Record<string, string> | null = null,
    ): Pick<APIGatewayProxyEvent, 'queryStringParameters' | 'httpMethod' | 'body'> => ({
        httpMethod,
        body,
        queryStringParameters,
    });

    describe('CORS handling', () => {
        it('should handle OPTIONS requests correctly', async () => {
            const event = createMockEvent('OPTIONS', null, null);
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Headers', 'Content-Type');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        });

        it('should include CORS headers in all responses', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockResolvedValue(false);
            mockStorageService.recordLunchConfirmation.mockResolvedValue(undefined);

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}', null);
            const result = await handler(event);

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Headers', 'Content-Type');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        });
    });

    describe('HTTP method validation', () => {
        it('should reject non-POST/GET requests', async () => {
            const event = createMockEvent('PUT');
            const result = await handler(event);

            expect(result.statusCode).toBe(405);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Method not allowed',
                message: 'Only POST and GET requests are supported',
            });
        });

        it('should handle GET requests with query parameters', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockResolvedValue(false);
            mockStorageService.recordLunchConfirmation.mockResolvedValue(undefined);

            const event = createMockEvent('GET', null, { action: 'confirm-lunch', location: 'Berlin' });
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Berlin');
        });
    });

    describe('Request body validation', () => {
        it('should handle empty body with default action', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockResolvedValue(false);
            mockStorageService.recordLunchConfirmation.mockResolvedValue(undefined);

            const event = createMockEvent('POST', null);
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Munich');
        });

        it('should handle valid JSON body with action', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockResolvedValue(false);
            mockStorageService.recordLunchConfirmation.mockResolvedValue(undefined);

            const event = createMockEvent('POST', '{"action": "confirm-lunch", "location": "Berlin"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Berlin');
        });

        it('should handle invalid JSON body', async () => {
            const event = createMockEvent('POST', '{"invalid": json}');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Invalid JSON',
                message: 'Request body must be valid JSON',
            });
        });

        it('should reject unsupported actions', async () => {
            const event = createMockEvent('POST', '{"action": "unsupported-action"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Invalid request',
                details: expect.any(Array),
            });
        });
    });

    describe('Lunch confirmation logic', () => {
        it('should record lunch confirmation when not already confirmed', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockResolvedValue(false);
            mockStorageService.recordLunchConfirmation.mockResolvedValue(undefined);

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Munich');

            const responseBody = JSON.parse(result.body);
            expect(responseBody).toEqual({
                action: 'confirm-lunch',
                message: 'Lunch confirmation recorded successfully',
                location: 'Munich',
                confirmed: true,
                timestamp: expect.any(String),
            });
        });

        it('should return already confirmed message when lunch already confirmed', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockResolvedValue(true);

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
            expect(mockStorageService.recordLunchConfirmation).not.toHaveBeenCalled();

            const responseBody = JSON.parse(result.body);
            expect(responseBody).toEqual({
                action: 'confirm-lunch',
                message: 'Lunch already confirmed this week',
                location: 'Munich',
                alreadyConfirmed: true,
            });
        });

        it('should use custom location from request body', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockResolvedValue(false);
            mockStorageService.recordLunchConfirmation.mockResolvedValue(undefined);

            const event = createMockEvent('POST', '{"action": "confirm-lunch", "location": "Berlin"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Berlin');
            expect(mockStorageService.recordLunchConfirmation).toHaveBeenCalledWith('Berlin');

            const responseBody = JSON.parse(result.body);
            expect(responseBody.location).toBe('Berlin');
        });
    });

    describe('Error handling', () => {
        it('should handle storage service errors', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockRejectedValue(new Error('DynamoDB error'));

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Internal server error',
                message: 'DynamoDB error',
            });
        });

        it('should handle unknown errors', async () => {
            mockStorageService.hasLunchBeenConfirmedThisWeek.mockRejectedValue('Unknown error');

            const event = createMockEvent('POST', '{"action": "confirm-lunch"}');
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Internal server error',
                message: 'Unknown error',
            });
        });
    });
});
