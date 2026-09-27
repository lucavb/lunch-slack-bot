import { describe, expect, it } from 'vitest';
import {
    botConfigSchema,
    POSITIVE_REACTIONS,
    positiveReactionSchema,
    validateBotConfig,
    weatherConditionSchema,
} from './weather.schema';

describe('Weather Schema', () => {
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
                goodWeatherConditions: ['clear', 'partly-cloudy'],
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

    describe('validateBotConfig', () => {
        it('should validate proper bot configuration', () => {
            const config = {
                minTemperature: 12,
                goodWeatherConditions: ['clear', 'partly-cloudy'],
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
});
