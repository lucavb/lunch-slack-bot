import { z } from 'zod';
import { WEATHER_CONDITIONS } from '../services/weather-decision';

export const WEATHER_CONDITION_EMOJIS = {
    clear: '☀️',
    'partly-cloudy': '⛅',
    clouds: '☁️',
    rain: '🌧️',
    drizzle: '🌦️',
    snow: '❄️',
    thunderstorm: '⛈️',
} as const;

export const POSITIVE_REACTIONS = [
    'thumbsup',
    '+1',
    'white_check_mark',
    'heavy_check_mark',
    'tada',
    'raised_hands',
] as const;

export const VALID_POSITIVE_REACTIONS = POSITIVE_REACTIONS;

export const weatherConditionSchema = z.enum(WEATHER_CONDITIONS);

export const positiveReactionSchema = z.enum(POSITIVE_REACTIONS);

export const botConfigSchema = z.object({
    minTemperature: z.number().min(-50).max(50),
    goodWeatherConditions: z.array(weatherConditionSchema).min(1),
    badWeatherConditions: z.array(weatherConditionSchema).min(1),
    positiveReactions: z.array(positiveReactionSchema).min(1),
    minReactionsForAcceptance: z.number().min(1),
    lookbackDays: z.number().min(1).max(30),
});

export type PositiveReaction = z.infer<typeof positiveReactionSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;

export function validateBotConfig(config: unknown): BotConfig {
    return botConfigSchema.parse(config);
}
