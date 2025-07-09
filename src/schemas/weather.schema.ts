import { z } from 'zod';

// Define all possible weather conditions as a const array
export const WEATHER_CONDITIONS = [
    'clear',
    'clouds',
    'rain',
    'drizzle',
    'thunderstorm',
    'snow',
    'mist',
    'smoke',
    'haze',
    'dust',
    'fog',
    'sand',
    'ash',
    'squall',
    'tornado',
] as const;

// Define positive reactions as a const array
export const POSITIVE_REACTIONS = [
    'thumbsup',
    '+1',
    'white_check_mark',
    'heavy_check_mark',
    'tada',
    'raised_hands',
] as const;

// Zod schema for weather condition types
export const weatherConditionSchema = z.enum(WEATHER_CONDITIONS);

// Zod schema for positive reactions
export const positiveReactionSchema = z.enum(POSITIVE_REACTIONS);

// Zod schema for bot configuration
export const botConfigSchema = z.object({
    minTemperature: z.number().min(-50).max(50),
    goodWeatherConditions: z.array(weatherConditionSchema).min(1).readonly(),
    badWeatherConditions: z.array(weatherConditionSchema).min(1).readonly(),
    positiveReactions: z.array(positiveReactionSchema).min(1).readonly(),
    minReactionsForAcceptance: z.number().min(1).max(10),
    lookbackDays: z.number().min(1).max(30),
});

// Zod schema for weather condition result
export const weatherConditionResultSchema = z.object({
    isGood: z.boolean(),
    temperature: z.number(),
    description: z.string(),
    condition: z.string(),
    timestamp: z.number(),
});

// Type inference from schemas
export type WeatherConditionType = z.infer<typeof weatherConditionSchema>;
export type PositiveReactionType = z.infer<typeof positiveReactionSchema>;
export type BotConfigType = z.infer<typeof botConfigSchema>;
export type WeatherConditionResult = z.infer<typeof weatherConditionResultSchema>;

// Validation functions
export const validateWeatherCondition = (condition: string): WeatherConditionType => {
    return weatherConditionSchema.parse(condition.toLowerCase());
};

export const validateBotConfig = (config: unknown): BotConfigType => {
    return botConfigSchema.parse(config);
};

export const validateWeatherConditionResult = (result: unknown): WeatherConditionResult => {
    return weatherConditionResultSchema.parse(result);
};

// Type guards
export const isWeatherCondition = (condition: string): condition is WeatherConditionType => {
    return weatherConditionSchema.safeParse(condition.toLowerCase()).success;
};

export const isGoodWeatherCondition = (condition: string, goodConditions: readonly WeatherConditionType[]): boolean => {
    if (!isWeatherCondition(condition)) {
        return false;
    }
    return goodConditions.includes(condition.toLowerCase() as WeatherConditionType);
};

export const isBadWeatherCondition = (condition: string, badConditions: readonly WeatherConditionType[]): boolean => {
    if (!isWeatherCondition(condition)) {
        return false;
    }
    return badConditions.includes(condition.toLowerCase() as WeatherConditionType);
};
