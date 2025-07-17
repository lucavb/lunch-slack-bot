import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWeatherCheckHandler, WeatherCheckHandlerDependencies } from './weather-check';
import { clearCache } from '../utils/env';

function createMockEvent(overrides?: unknown) {
    return { overrides } as const;
}

describe('Weather Check Handler', () => {
    const createTestHandler = () => {
        const mockStorageService = {
            hasLunchBeenConfirmedThisWeek: vi.fn(),
            hasMessageBeenSentToday: vi.fn(),
            canSendMessageThisWeek: vi.fn(),
            getWeeklyMessageStats: vi.fn(),
            isOptedInToWeatherWarnings: vi.fn(),
            recordMessageSent: vi.fn(),
            cleanupOldRecords: vi.fn(),
        } as const satisfies WeatherCheckHandlerDependencies['storageService'];

        const mockWeatherService = {
            isWeatherGood: vi.fn(),
        } as const satisfies WeatherCheckHandlerDependencies['weatherService'];

        const mockSlackService = {
            sendWeatherReminder: vi.fn(),
            sendWeatherWarning: vi.fn(),
        } as const satisfies WeatherCheckHandlerDependencies['slackService'];

        const mockSecretsManagerClient = {
            getSecretValue: vi.fn(),
        } as const satisfies WeatherCheckHandlerDependencies['secretsManagerClient'];

        // Set up default mock implementations
        vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockResolvedValue(false);
        vi.spyOn(mockStorageService, 'hasMessageBeenSentToday').mockResolvedValue(false);
        vi.spyOn(mockStorageService, 'canSendMessageThisWeek').mockResolvedValue(true);
        vi.spyOn(mockStorageService, 'getWeeklyMessageStats').mockResolvedValue({
            messageCount: 0,
            maxMessages: 2,
        });
        vi.spyOn(mockStorageService, 'isOptedInToWeatherWarnings').mockResolvedValue(false);
        vi.spyOn(mockStorageService, 'recordMessageSent').mockResolvedValue(undefined);
        vi.spyOn(mockStorageService, 'cleanupOldRecords').mockResolvedValue(undefined);

        vi.spyOn(mockWeatherService, 'isWeatherGood').mockResolvedValue({
            temperature: 22,
            condition: 'clear',
            description: 'Clear sky',
            isGood: true,
            timestamp: Date.now(),
        });

        vi.spyOn(mockSlackService, 'sendWeatherReminder').mockResolvedValue(undefined);
        vi.spyOn(mockSlackService, 'sendWeatherWarning').mockResolvedValue(undefined);

        vi.spyOn(mockSecretsManagerClient, 'getSecretValue').mockResolvedValue({
            webhook_url: 'https://hooks.slack.com/services/test/webhook/url',
        });

        const handler = createWeatherCheckHandler({
            storageService: mockStorageService,
            weatherService: mockWeatherService,
            slackService: mockSlackService,
            secretsManagerClient: mockSecretsManagerClient,
        });

        return {
            handler,
            mockStorageService,
            mockWeatherService,
            mockSlackService,
            mockSecretsManagerClient,
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    describe('Event validation', () => {
        it('should handle valid event with no overrides', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Munich');
        });

        it('should handle valid event with overrides', async () => {
            const { handler, mockStorageService } = createTestHandler();
            const event = createMockEvent({ locationName: 'Berlin' });
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Berlin');
        });

        it('should handle invalid event structure gracefully', async () => {
            const { handler } = createTestHandler();
            const event = { overrides: { slackWebhookUrl: 'not-a-valid-url' } }; // slackWebhookUrl expects a valid URL
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Invalid event structure');
            expect(body.details).toBeDefined();
        });
    });

    describe('Early exit conditions', () => {
        it('should skip weather check when lunch already confirmed this week', async () => {
            const { handler, mockStorageService, mockWeatherService } = createTestHandler();
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockResolvedValue(true);

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.message).toBe('Lunch already confirmed this week, no weather messages needed');
            expect(body.lunchConfirmed).toBe(true);
            expect(mockWeatherService.isWeatherGood).not.toHaveBeenCalled();
        });

        it('should skip when message already sent today', async () => {
            const { handler, mockStorageService, mockWeatherService } = createTestHandler();
            vi.spyOn(mockStorageService, 'hasMessageBeenSentToday').mockResolvedValue(true);

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.message).toBe('Message already sent today');
            expect(mockWeatherService.isWeatherGood).not.toHaveBeenCalled();
        });

        it('should skip when weekly message limit reached', async () => {
            const { handler, mockStorageService, mockWeatherService } = createTestHandler();
            vi.spyOn(mockStorageService, 'canSendMessageThisWeek').mockResolvedValue(false);
            vi.spyOn(mockStorageService, 'getWeeklyMessageStats').mockResolvedValue({
                messageCount: 2,
                maxMessages: 2,
            });

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.message).toBe('Weekly message limit reached');
            expect(body.weeklyStats.messageCount).toBe(2);
            expect(mockWeatherService.isWeatherGood).not.toHaveBeenCalled();
        });
    });

    describe('Weather condition handling', () => {
        it('should send weather reminder when weather is good', async () => {
            const { handler, mockStorageService, mockSlackService } = createTestHandler();

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.message).toBe('Weather check completed successfully');
            expect(body.weather.isGood).toBe(true);
            expect(body.messagesSent.sent).toBe(true);
            expect(body.messagesSent.type).toBe('weather_reminder');

            expect(mockSlackService.sendWeatherReminder).toHaveBeenCalledWith(
                22,
                'Clear sky',
                'Munich',
                expect.stringContaining('confirm-lunch'),
                '#general',
            );
            expect(mockStorageService.recordMessageSent).toHaveBeenCalledWith(
                'weather_reminder',
                'Munich',
                22,
                'clear',
            );
        });

        it('should not send weather warning when location not opted in', async () => {
            const { handler, mockStorageService, mockWeatherService, mockSlackService } = createTestHandler();
            vi.spyOn(mockWeatherService, 'isWeatherGood').mockResolvedValue({
                temperature: 5,
                condition: 'rain',
                description: 'Heavy rain',
                isGood: false,
                timestamp: Date.now(),
            });
            vi.spyOn(mockStorageService, 'isOptedInToWeatherWarnings').mockResolvedValue(false);

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.weather.isGood).toBe(false);
            expect(body.messagesSent.sent).toBe(false);
            expect(body.messagesSent.type).toBe('');

            expect(mockSlackService.sendWeatherWarning).not.toHaveBeenCalled();
            expect(mockStorageService.recordMessageSent).not.toHaveBeenCalled();
        });

        it('should send weather warning when location opted in and weather is bad', async () => {
            const { handler, mockStorageService, mockWeatherService, mockSlackService } = createTestHandler();
            vi.spyOn(mockWeatherService, 'isWeatherGood').mockResolvedValue({
                temperature: 5,
                condition: 'rain',
                description: 'Heavy rain',
                isGood: false,
                timestamp: Date.now(),
            });
            vi.spyOn(mockStorageService, 'isOptedInToWeatherWarnings').mockResolvedValue(true);

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.weather.isGood).toBe(false);
            expect(body.messagesSent.sent).toBe(true);
            expect(body.messagesSent.type).toBe('weather_warning');

            expect(mockSlackService.sendWeatherWarning).toHaveBeenCalledWith(
                5,
                'Heavy rain',
                'Munich',
                expect.any(String),
            );
            expect(mockStorageService.recordMessageSent).toHaveBeenCalledWith('weather_warning', 'Munich', 5, 'rain');
        });

        it('should not send weather warning when already sent today', async () => {
            const { handler, mockStorageService, mockWeatherService, mockSlackService } = createTestHandler();
            vi.spyOn(mockWeatherService, 'isWeatherGood').mockResolvedValue({
                temperature: 5,
                condition: 'rain',
                description: 'Heavy rain',
                isGood: false,
                timestamp: Date.now(),
            });
            vi.spyOn(mockStorageService, 'isOptedInToWeatherWarnings').mockResolvedValue(true);
            vi.spyOn(mockStorageService, 'hasMessageBeenSentToday').mockImplementation((messageType) => {
                return Promise.resolve(messageType === 'weather_warning');
            });

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.messagesSent.sent).toBe(false);
            expect(mockSlackService.sendWeatherWarning).not.toHaveBeenCalled();
        });

        it('should not send weather warning when weekly limit reached', async () => {
            const { handler, mockStorageService, mockWeatherService, mockSlackService } = createTestHandler();
            vi.spyOn(mockWeatherService, 'isWeatherGood').mockResolvedValue({
                temperature: 5,
                condition: 'rain',
                description: 'Heavy rain',
                isGood: false,
                timestamp: Date.now(),
            });
            vi.spyOn(mockStorageService, 'isOptedInToWeatherWarnings').mockResolvedValue(true);
            vi.spyOn(mockStorageService, 'canSendMessageThisWeek').mockImplementation((_location, messageType) => {
                return Promise.resolve(messageType === 'weather_reminder');
            });

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.messagesSent.sent).toBe(false);
            expect(mockSlackService.sendWeatherWarning).not.toHaveBeenCalled();
        });
    });

    describe('Cleanup and maintenance', () => {
        it('should cleanup old records after processing', async () => {
            const { handler, mockStorageService } = createTestHandler();

            const event = createMockEvent();
            await handler(event);

            expect(mockStorageService.cleanupOldRecords).toHaveBeenCalledWith(30);
        });
    });

    describe('Error handling', () => {
        it('should handle weather service errors gracefully', async () => {
            const { handler, mockWeatherService } = createTestHandler();
            vi.spyOn(mockWeatherService, 'isWeatherGood').mockRejectedValue(new Error('Weather API error'));

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Internal server error');
            expect(body.message).toBe('Weather API error');
        });

        it('should handle storage service errors gracefully', async () => {
            const { handler, mockStorageService } = createTestHandler();
            vi.spyOn(mockStorageService, 'hasLunchBeenConfirmedThisWeek').mockRejectedValue(
                new Error('Database error'),
            );

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Internal server error');
        });

        it('should handle slack service errors gracefully', async () => {
            const { handler, mockSlackService } = createTestHandler();
            vi.spyOn(mockSlackService, 'sendWeatherReminder').mockRejectedValue(new Error('Slack API error'));

            const event = createMockEvent();
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.error).toBe('Internal server error');
        });

        it('should redact sensitive information from responses', async () => {
            const { handler } = createTestHandler();

            const event = createMockEvent();
            const result = await handler(event);

            const body = JSON.parse(result.body);
            expect(body.config.slackWebhookUrl).toBe('[REDACTED]');
        });
    });

    describe('Custom location handling', () => {
        it('should use custom location from overrides', async () => {
            const { handler, mockStorageService } = createTestHandler();

            const event = createMockEvent({ locationName: 'Frankfurt' });
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockStorageService.hasLunchBeenConfirmedThisWeek).toHaveBeenCalledWith('Frankfurt');

            const body = JSON.parse(result.body);
            expect(body.location).toBe('Frankfurt');
        });
    });
});
