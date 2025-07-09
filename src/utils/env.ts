import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
    SLACK_WEBHOOK_URL: z.string().url('SLACK_WEBHOOK_URL must be a valid URL'),
    AWS_DEFAULT_REGION: z.string().default('eu-central-1'),

    // Location coordinates
    LOCATION_NAME: z.string().min(1, 'LOCATION_NAME is required'),
    LOCATION_LAT: z
        .string()
        .transform((val) => parseFloat(val))
        .pipe(z.number().min(-90).max(90)),
    LOCATION_LON: z
        .string()
        .transform((val) => parseFloat(val))
        .pipe(z.number().min(-180).max(180)),

    // DynamoDB table name
    DYNAMODB_TABLE_NAME: z.string().min(1, 'DYNAMODB_TABLE_NAME is required'),
});

// Parse and validate environment variables
export const env = envSchema.parse(process.env);

// Export the type for use in other files
export type Env = z.infer<typeof envSchema>;

// Schema for event parameter overrides
const eventOverridesSchema = z
    .object({
        slackWebhookUrl: z.string().url().optional(),
        locationName: z.string().min(1).optional(),
        locationLat: z.number().min(-90).max(90).optional(),
        locationLon: z.number().min(-180).max(180).optional(),
        dynamodbTableName: z.string().min(1).optional(),
        // Weather thresholds
        minTemperature: z.number().min(-50).max(50).optional(),
        goodWeatherConditions: z.array(z.string()).optional(),
        badWeatherConditions: z.array(z.string()).optional(),
        // Timing
        weatherCheckHour: z.number().min(0).max(23).optional(), // Hour of day to check weather for (0-23)
    })
    .optional();

export type EventOverrides = z.infer<typeof eventOverridesSchema>;

// Helper to get configuration with event overrides
export const getConfig = (eventOverrides?: EventOverrides) => {
    const overrides = eventOverridesSchema.parse(eventOverrides);

    return {
        slackWebhookUrl: overrides?.slackWebhookUrl ?? env.SLACK_WEBHOOK_URL,
        awsRegion: env.AWS_DEFAULT_REGION, // Always use the region where lambda is deployed
        locationName: overrides?.locationName ?? env.LOCATION_NAME,
        locationLat: overrides?.locationLat ?? env.LOCATION_LAT,
        locationLon: overrides?.locationLon ?? env.LOCATION_LON,
        dynamodbTableName: overrides?.dynamodbTableName ?? env.DYNAMODB_TABLE_NAME,
        // Weather thresholds
        minTemperature: overrides?.minTemperature ?? 12,
        goodWeatherConditions: overrides?.goodWeatherConditions ?? ['clear', 'clouds'],
        badWeatherConditions: overrides?.badWeatherConditions ?? ['rain', 'drizzle', 'thunderstorm', 'snow'],
        // Timing
        weatherCheckHour: overrides?.weatherCheckHour ?? 12, // Default to noon
    };
};

// Helper to get coordinates from config
export const getCoordinates = (eventOverrides?: EventOverrides) => {
    const config = getConfig(eventOverrides);
    return {
        lat: config.locationLat,
        lon: config.locationLon,
        locationName: config.locationName,
    };
};
