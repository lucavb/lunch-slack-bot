import { z } from 'zod';
import { NOON_HOUR, BOT_CONFIG } from './constants';

const envSchema = z.object({
    SLACK_WEBHOOK_URL: z.string().url('SLACK_WEBHOOK_URL must be a valid URL'),
    AWS_DEFAULT_REGION: z.string().default('eu-central-1'),
    LOCATION_NAME: z.string().min(1, 'LOCATION_NAME is required'),
    LOCATION_LAT: z
        .string()
        .transform((val) => parseFloat(val))
        .pipe(z.number().min(-90).max(90)),
    LOCATION_LON: z
        .string()
        .transform((val) => parseFloat(val))
        .pipe(z.number().min(-180).max(180)),
    DYNAMODB_TABLE_NAME: z.string().min(1, 'DYNAMODB_TABLE_NAME is required'),
    REPLY_API_URL: z.string().url('REPLY_API_URL must be a valid URL'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;

export const eventOverridesSchema = z
    .object({
        slackWebhookUrl: z.string().url().optional(),
        locationName: z.string().min(1).optional(),
        locationLat: z.number().min(-90).max(90).optional(),
        locationLon: z.number().min(-180).max(180).optional(),
        dynamodbTableName: z.string().min(1).optional(),
        replyApiUrl: z.string().url().optional(),
        minTemperature: z.number().min(-50).max(50).optional(),
        goodWeatherConditions: z.array(z.string()).optional(),
        badWeatherConditions: z.array(z.string()).optional(),
        weatherCheckHour: z.number().min(0).max(23).optional(),
    })
    .optional();

export type EventOverrides = z.infer<typeof eventOverridesSchema>;

export const getConfig = (eventOverrides?: EventOverrides) => {
    const overrides = eventOverridesSchema.parse(eventOverrides);

    return {
        slackWebhookUrl: overrides?.slackWebhookUrl ?? env.SLACK_WEBHOOK_URL,
        awsRegion: env.AWS_DEFAULT_REGION,
        locationName: overrides?.locationName ?? env.LOCATION_NAME,
        locationLat: overrides?.locationLat ?? env.LOCATION_LAT,
        locationLon: overrides?.locationLon ?? env.LOCATION_LON,
        dynamodbTableName: overrides?.dynamodbTableName ?? env.DYNAMODB_TABLE_NAME,
        replyApiUrl: overrides?.replyApiUrl ?? env.REPLY_API_URL,
        minTemperature: overrides?.minTemperature ?? BOT_CONFIG.minTemperature,
        goodWeatherConditions: overrides?.goodWeatherConditions ?? BOT_CONFIG.goodWeatherConditions,
        badWeatherConditions: overrides?.badWeatherConditions ?? BOT_CONFIG.badWeatherConditions,
        weatherCheckHour: overrides?.weatherCheckHour ?? NOON_HOUR,
    };
};
export const getCoordinates = (eventOverrides?: EventOverrides) => {
    const config = getConfig(eventOverrides);
    return {
        lat: config.locationLat,
        lon: config.locationLon,
        locationName: config.locationName,
    };
};
