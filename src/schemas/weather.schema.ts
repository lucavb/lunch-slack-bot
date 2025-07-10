import { z } from 'zod';

export const WEATHER_CONDITIONS = ['clear', 'clouds', 'rain', 'drizzle', 'snow', 'thunderstorm'] as const;

export const VALID_WEATHER_CONDITIONS = WEATHER_CONDITIONS;

export const WEATHER_CONDITION_EMOJIS = {
    clear: '☀️',
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

export const weatherConditionResultSchema = z.object({
    condition: weatherConditionSchema,
    temperature: z.number(),
    description: z.string(),
    isGood: z.boolean(),
    timestamp: z.number(),
});

export type WeatherCondition = z.infer<typeof weatherConditionSchema>;
export type PositiveReaction = z.infer<typeof positiveReactionSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;
export type WeatherConditionResult = z.infer<typeof weatherConditionResultSchema>;

export function validateWeatherCondition(condition: unknown): WeatherCondition {
    return weatherConditionSchema.parse(condition);
}

export function validatePositiveReaction(reaction: unknown): PositiveReaction {
    return positiveReactionSchema.parse(reaction);
}

export function validateBotConfig(config: unknown): BotConfig {
    return botConfigSchema.parse(config);
}

export function validateWeatherConditionResult(result: unknown): WeatherConditionResult {
    return weatherConditionResultSchema.parse(result);
}

export function isValidWeatherCondition(condition: unknown): condition is WeatherCondition {
    return weatherConditionSchema.safeParse(condition).success;
}

export function isValidPositiveReaction(reaction: unknown): reaction is PositiveReaction {
    return positiveReactionSchema.safeParse(reaction).success;
}

export const isWeatherCondition = (condition: string): condition is WeatherCondition => {
    return weatherConditionSchema.safeParse(condition.toLowerCase()).success;
};

export const isGoodWeatherCondition = (condition: string, goodConditions: readonly WeatherCondition[]): boolean => {
    if (!isWeatherCondition(condition)) {
        return false;
    }
    return goodConditions.includes(condition.toLowerCase() as WeatherCondition);
};

export const isBadWeatherCondition = (condition: string, badConditions: readonly WeatherCondition[]): boolean => {
    if (!isWeatherCondition(condition)) {
        return false;
    }
    return badConditions.includes(condition.toLowerCase() as WeatherCondition);
};
