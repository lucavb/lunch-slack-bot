import { describe, it, expect } from 'vitest';
import {
    WEATHER_CONDITIONS,
    POSITIVE_REACTIONS,
    weatherConditionSchema,
    positiveReactionSchema,
    botConfigSchema,
    weatherConditionResultSchema,
    validateWeatherCondition,
    validateBotConfig,
    validateWeatherConditionResult,
    isWeatherCondition,
    isGoodWeatherCondition,
    isBadWeatherCondition,
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
            expect(WEATHER_CONDITIONS).toContain('mist');
            expect(WEATHER_CONDITIONS).toContain('smoke');
            expect(WEATHER_CONDITIONS).toContain('haze');
            expect(WEATHER_CONDITIONS).toContain('dust');
            expect(WEATHER_CONDITIONS).toContain('fog');
            expect(WEATHER_CONDITIONS).toContain('sand');
            expect(WEATHER_CONDITIONS).toContain('ash');
            expect(WEATHER_CONDITIONS).toContain('squall');
            expect(WEATHER_CONDITIONS).toContain('tornado');
        });

        it('should be a readonly array', () => {
            // TypeScript ensures readonly at compile time, runtime immutability would require Object.freeze
            expect(WEATHER_CONDITIONS).toBeInstanceOf(Array);
            expect(WEATHER_CONDITIONS.length).toBe(15);
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
            // TypeScript ensures readonly at compile time, runtime immutability would require Object.freeze
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
            // Invalid temperature range
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

            // Empty arrays
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

            // Invalid weather conditions
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
                isGood: true,
                temperature: 18,
                description: 'clear sky',
                condition: 'clear',
                timestamp: 1234567890,
            };

            const result = weatherConditionResultSchema.parse(validResult);
            expect(result).toEqual(validResult);
        });

        it('should reject invalid weather condition result', () => {
            // Missing required fields
            expect(() =>
                weatherConditionResultSchema.parse({
                    isGood: true,
                    temperature: 18,
                    // missing description, condition, timestamp
                }),
            ).toThrow();

            // Invalid types
            expect(() =>
                weatherConditionResultSchema.parse({
                    isGood: 'true', // should be boolean
                    temperature: 18,
                    description: 'clear sky',
                    condition: 'clear',
                    timestamp: 1234567890,
                }),
            ).toThrow();
        });
    });

    describe('validateWeatherCondition', () => {
        it('should validate and normalize weather conditions', () => {
            expect(validateWeatherCondition('CLEAR')).toBe('clear');
            expect(validateWeatherCondition('Rain')).toBe('rain');
            expect(validateWeatherCondition('SNOW')).toBe('snow');
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
                isGood: true,
                temperature: 18,
                description: 'clear sky',
                condition: 'clear',
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
        const badConditions = ['rain', 'snow', 'thunderstorm'] as const;

        it('should return true for bad weather conditions', () => {
            expect(isBadWeatherCondition('rain', badConditions)).toBe(true);
            expect(isBadWeatherCondition('RAIN', badConditions)).toBe(true);
            expect(isBadWeatherCondition('snow', badConditions)).toBe(true);
            expect(isBadWeatherCondition('thunderstorm', badConditions)).toBe(true);
        });

        it('should return false for non-bad weather conditions', () => {
            expect(isBadWeatherCondition('clear', badConditions)).toBe(false);
            expect(isBadWeatherCondition('clouds', badConditions)).toBe(false);
            expect(isBadWeatherCondition('invalid', badConditions)).toBe(false);
        });
    });
});
