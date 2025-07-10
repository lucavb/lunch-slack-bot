import { describe, expect, it } from 'vitest';
import {
    botConfigSchema,
    isBadWeatherCondition,
    isGoodWeatherCondition,
    isWeatherCondition,
    POSITIVE_REACTIONS,
    positiveReactionSchema,
    validateBotConfig,
    validateWeatherCondition,
    validateWeatherConditionResult,
    WEATHER_CONDITIONS,
    weatherConditionResultSchema,
    weatherConditionSchema,
} from './weather.schema';

describe('Weather Schema', () => {
    describe('WEATHER_CONDITIONS', () => {
        it('should contain all expected weather conditions', () => {
            expect(WEATHER_CONDITIONS).toContain('clear');
            expect(WEATHER_CONDITIONS).toContain('clouds');
            expect(WEATHER_CONDITIONS).toContain('rain');
            expect(WEATHER_CONDITIONS).toContain('drizzle');
            expect(WEATHER_CONDITIONS).toContain('thunderstorm');
            expect(WEATHER_CONDITIONS).toContain('snow');
        });

        it('should be a readonly array', () => {
            expect(WEATHER_CONDITIONS).toBeInstanceOf(Array);
            expect(WEATHER_CONDITIONS.length).toBe(6);
        });
    });

    describe('POSITIVE_REACTIONS', () => {
        it('should contain all expected positive reactions', () => {
            expect(POSITIVE_REACTIONS).toContain('thumbsup');
            expect(POSITIVE_REACTIONS).toContain('+1');
            expect(POSITIVE_REACTIONS).toContain('white_check_mark');
            expect(POSITIVE_REACTIONS).toContain('heavy_check_mark');
            expect(POSITIVE_REACTIONS).toContain('tada');
            expect(POSITIVE_REACTIONS).toContain('raised_hands');
        });

        it('should be a readonly array', () => {
            expect(POSITIVE_REACTIONS).toBeInstanceOf(Array);
            expect(POSITIVE_REACTIONS.length).toBe(6);
        });
    });

    describe('weatherConditionSchema', () => {
        it('should validate valid weather conditions', () => {
            expect(weatherConditionSchema.parse('clear')).toBe('clear');
            expect(weatherConditionSchema.parse('rain')).toBe('rain');
            expect(weatherConditionSchema.parse('snow')).toBe('snow');
        });

        it('should reject invalid weather conditions', () => {
            expect(() => weatherConditionSchema.parse('invalid')).toThrow();
            expect(() => weatherConditionSchema.parse('sunny')).toThrow();
            expect(() => weatherConditionSchema.parse('')).toThrow();
        });
    });

    describe('positiveReactionSchema', () => {
        it('should validate valid positive reactions', () => {
            expect(positiveReactionSchema.parse('thumbsup')).toBe('thumbsup');
            expect(positiveReactionSchema.parse('+1')).toBe('+1');
            expect(positiveReactionSchema.parse('tada')).toBe('tada');
        });

        it('should reject invalid positive reactions', () => {
            expect(() => positiveReactionSchema.parse('invalid')).toThrow();
            expect(() => positiveReactionSchema.parse('thumbsdown')).toThrow();
            expect(() => positiveReactionSchema.parse('')).toThrow();
        });
    });

    describe('botConfigSchema', () => {
        it('should validate valid bot configuration', () => {
            const validConfig = {
                minTemperature: 12,
                goodWeatherConditions: ['clear', 'clouds'],
                badWeatherConditions: ['rain', 'snow'],
                positiveReactions: ['thumbsup', '+1'],
                minReactionsForAcceptance: 2,
                lookbackDays: 7,
            };

            const result = botConfigSchema.parse(validConfig);
            expect(result).toEqual(validConfig);
        });

        it('should reject invalid bot configuration', () => {
            expect(() =>
                botConfigSchema.parse({
                    minTemperature: -100,
                    goodWeatherConditions: ['clear'],
                    badWeatherConditions: ['rain'],
                    positiveReactions: ['thumbsup'],
                    minReactionsForAcceptance: 2,
                    lookbackDays: 7,
                }),
            ).toThrow();

            expect(() =>
                botConfigSchema.parse({
                    minTemperature: 12,
                    goodWeatherConditions: [],
                    badWeatherConditions: ['rain'],
                    positiveReactions: ['thumbsup'],
                    minReactionsForAcceptance: 2,
                    lookbackDays: 7,
                }),
            ).toThrow();

            expect(() =>
                botConfigSchema.parse({
                    minTemperature: 12,
                    goodWeatherConditions: ['invalid'],
                    badWeatherConditions: ['rain'],
                    positiveReactions: ['thumbsup'],
                    minReactionsForAcceptance: 2,
                    lookbackDays: 7,
                }),
            ).toThrow();
        });
    });

    describe('weatherConditionResultSchema', () => {
        it('should validate valid weather condition result', () => {
            const validResult = {
                condition: 'clear',
                temperature: 18,
                description: 'clear sky',
                isGood: true,
                timestamp: 1234567890,
            };

            const result = weatherConditionResultSchema.parse(validResult);
            expect(result).toEqual(validResult);
        });

        it('should reject invalid weather condition result', () => {
            expect(() =>
                weatherConditionResultSchema.parse({
                    isGood: true,
                    temperature: 18,
                }),
            ).toThrow();

            expect(() =>
                weatherConditionResultSchema.parse({
                    condition: 'clear',
                    temperature: 18,
                    description: 'clear sky',
                    isGood: 'true',
                    timestamp: 1234567890,
                }),
            ).toThrow();
        });
    });

    describe('validateWeatherCondition', () => {
        it('should validate weather conditions', () => {
            expect(validateWeatherCondition('clear')).toBe('clear');
            expect(validateWeatherCondition('rain')).toBe('rain');
            expect(validateWeatherCondition('snow')).toBe('snow');
        });

        it('should throw for invalid weather conditions', () => {
            expect(() => validateWeatherCondition('invalid')).toThrow();
            expect(() => validateWeatherCondition('sunny')).toThrow();
            expect(() => validateWeatherCondition('')).toThrow();
        });
    });

    describe('validateBotConfig', () => {
        it('should validate proper bot configuration', () => {
            const config = {
                minTemperature: 12,
                goodWeatherConditions: ['clear', 'clouds'],
                badWeatherConditions: ['rain', 'snow'],
                positiveReactions: ['thumbsup', '+1'],
                minReactionsForAcceptance: 2,
                lookbackDays: 7,
            };

            const result = validateBotConfig(config);
            expect(result).toEqual(config);
        });

        it('should throw for invalid bot configuration', () => {
            expect(() => validateBotConfig({})).toThrow();
            expect(() => validateBotConfig(null)).toThrow();
            expect(() => validateBotConfig('invalid')).toThrow();
        });
    });

    describe('validateWeatherConditionResult', () => {
        it('should validate proper weather condition result', () => {
            const result = {
                condition: 'clear',
                temperature: 18,
                description: 'clear sky',
                isGood: true,
                timestamp: 1234567890,
            };

            const validated = validateWeatherConditionResult(result);
            expect(validated).toEqual(result);
        });

        it('should throw for invalid weather condition result', () => {
            expect(() => validateWeatherConditionResult({})).toThrow();
            expect(() => validateWeatherConditionResult(null)).toThrow();
            expect(() => validateWeatherConditionResult('invalid')).toThrow();
        });
    });

    describe('isWeatherCondition', () => {
        it('should return true for valid weather conditions', () => {
            expect(isWeatherCondition('clear')).toBe(true);
            expect(isWeatherCondition('RAIN')).toBe(true);
            expect(isWeatherCondition('Snow')).toBe(true);
        });

        it('should return false for invalid weather conditions', () => {
            expect(isWeatherCondition('invalid')).toBe(false);
            expect(isWeatherCondition('sunny')).toBe(false);
            expect(isWeatherCondition('')).toBe(false);
        });
    });

    describe('isGoodWeatherCondition', () => {
        const goodConditions = ['clear', 'clouds'] as const;

        it('should return true for good weather conditions', () => {
            expect(isGoodWeatherCondition('clear', goodConditions)).toBe(true);
            expect(isGoodWeatherCondition('CLEAR', goodConditions)).toBe(true);
            expect(isGoodWeatherCondition('clouds', goodConditions)).toBe(true);
        });

        it('should return false for non-good weather conditions', () => {
            expect(isGoodWeatherCondition('rain', goodConditions)).toBe(false);
            expect(isGoodWeatherCondition('snow', goodConditions)).toBe(false);
            expect(isGoodWeatherCondition('invalid', goodConditions)).toBe(false);
        });
    });

    describe('isBadWeatherCondition', () => {
        const badConditions = ['rain', 'snow'] as const;

        it('should return true for bad weather conditions', () => {
            expect(isBadWeatherCondition('rain', badConditions)).toBe(true);
            expect(isBadWeatherCondition('RAIN', badConditions)).toBe(true);
            expect(isBadWeatherCondition('snow', badConditions)).toBe(true);
        });

        it('should return false for non-bad weather conditions', () => {
            expect(isBadWeatherCondition('clear', badConditions)).toBe(false);
            expect(isBadWeatherCondition('clouds', badConditions)).toBe(false);
            expect(isBadWeatherCondition('invalid', badConditions)).toBe(false);
        });
    });
});
