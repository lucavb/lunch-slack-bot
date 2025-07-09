import { describe, it, expect } from 'vitest';
import {
    BOT_CONFIG,
    OPEN_METEO_API_BASE_URL,
    LUNCH_MESSAGE_TEMPLATE,
    DYNAMO_TTL_DAYS,
    NOOD_HOUR,
    SCHEDULER_HOUR,
    ERROR_MESSAGES,
    MAX_MESSAGES_PER_WEEK,
} from './constants';

describe('Constants', () => {
    describe('BOT_CONFIG', () => {
        it('should have correct minimum temperature', () => {
            expect(BOT_CONFIG.minTemperature).toBe(12);
        });

        it('should have good weather conditions', () => {
            expect(BOT_CONFIG.goodWeatherConditions).toEqual(['clear', 'clouds']);
        });

        it('should have bad weather conditions', () => {
            expect(BOT_CONFIG.badWeatherConditions).toEqual(['rain', 'drizzle', 'thunderstorm', 'snow']);
        });

        it('should have positive reactions', () => {
            expect(BOT_CONFIG.positiveReactions).toContain('thumbsup');
            expect(BOT_CONFIG.positiveReactions).toContain('+1');
            expect(BOT_CONFIG.positiveReactions).toContain('white_check_mark');
        });

        it('should have minimum reactions for acceptance', () => {
            expect(BOT_CONFIG.minReactionsForAcceptance).toBe(2);
        });

        it('should have lookback days', () => {
            expect(BOT_CONFIG.lookbackDays).toBe(7);
        });
    });

    describe('OPEN_METEO_API_BASE_URL', () => {
        it('should point to Open-Meteo API', () => {
            expect(OPEN_METEO_API_BASE_URL).toBe('https://api.open-meteo.com/v1/forecast');
        });
    });

    describe('LUNCH_MESSAGE_TEMPLATE', () => {
        it('should create formatted message with location, temperature, and description', () => {
            const message = LUNCH_MESSAGE_TEMPLATE('Munich', 18, 'sunny');

            expect(message).toContain('Munich');
            expect(message).toContain('18°C');
            expect(message).toContain('sunny');
            expect(message).toContain('🌤️');
            expect(message).toContain('lunch outside');
        });
    });

    describe('Time constants', () => {
        it('should have correct noon hour', () => {
            expect(NOOD_HOUR).toBe(12);
        });

        it('should have correct scheduler hour', () => {
            expect(SCHEDULER_HOUR).toBe(10);
        });

        it('should have correct DynamoDB TTL days', () => {
            expect(DYNAMO_TTL_DAYS).toBe(30);
        });
    });

    describe('Weekly message limits', () => {
        it('should have correct maximum messages per week', () => {
            expect(MAX_MESSAGES_PER_WEEK).toBe(2);
        });
    });

    describe('ERROR_MESSAGES', () => {
        it('should have all required error messages', () => {
            expect(ERROR_MESSAGES.WEATHER_API_ERROR).toBe('Failed to fetch weather data');
            expect(ERROR_MESSAGES.SLACK_API_ERROR).toBe('Failed to interact with Slack API');
            expect(ERROR_MESSAGES.DYNAMO_ERROR).toBe('Failed to interact with DynamoDB');
            expect(ERROR_MESSAGES.MISSING_ENV_VAR).toBe('Missing required environment variable');
            expect(ERROR_MESSAGES.INVALID_WEATHER_RESPONSE).toBe('Invalid weather API response');
            expect(ERROR_MESSAGES.INVALID_SLACK_PAYLOAD).toBe('Invalid Slack payload');
        });
    });
});
