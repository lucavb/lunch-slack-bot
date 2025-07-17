import { z } from 'zod';
import { BOT_CONFIG, NOON_HOUR } from './constants';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SecretsManagerClientImpl } from '../implementations/secrets-manager-client';

const envSchema = z.object({
    AWS_DEFAULT_REGION: z.string().default('eu-central-1'),
    DYNAMODB_TABLE_NAME: z.string().min(1, 'DYNAMODB_TABLE_NAME is required'),
    LOCATION_LAT: z.coerce.number().pipe(z.number().min(-90).max(90)),
    LOCATION_LON: z.coerce.number().pipe(z.number().min(-180).max(180)),
    LOCATION_NAME: z.string().min(1, 'LOCATION_NAME is required'),
    MIN_TEMPERATURE: z.coerce.number().pipe(z.number().min(-50).max(50)).default(14),
    REPLY_API_URL: z.string().url('REPLY_API_URL must be a valid URL'),
    SLACK_WEBHOOK_SECRET_ARN: z.string().min(1, 'SLACK_WEBHOOK_SECRET_ARN is required'),
    SLACK_CHANNEL: z.string().optional(),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;
let cachedWebhookUrl: string | null = null;
let secretsManagerClient: SecretsManagerClientImpl | null = null;

const getEnv = () => {
    if (!cachedEnv) {
        cachedEnv = envSchema.parse(process.env);
    }
    return cachedEnv;
};

const getSecretsManagerClient = () => {
    if (!secretsManagerClient) {
        const env = getEnv();
        const client = new SecretsManagerClient({ region: env.AWS_DEFAULT_REGION });
        secretsManagerClient = new SecretsManagerClientImpl(client);
    }
    return secretsManagerClient;
};

const getWebhookUrl = async (
    secretsManagerClient?: Pick<SecretsManagerClientImpl, 'getSecretValue'>,
): Promise<string> => {
    if (cachedWebhookUrl) {
        return cachedWebhookUrl;
    }

    const env = getEnv();
    const secretsClient = secretsManagerClient ?? getSecretsManagerClient();

    const secretValue = await secretsClient.getSecretValue(env.SLACK_WEBHOOK_SECRET_ARN);

    if (typeof secretValue['webhook_url'] !== 'string') {
        throw new Error('webhook_url not found in secret');
    }

    cachedWebhookUrl = secretValue['webhook_url'];
    return cachedWebhookUrl;
};

export const eventOverridesSchema = z.object({
    badWeatherConditions: z.array(z.string()).optional(),
    goodWeatherConditions: z.array(z.string()).optional(),
    locationLat: z.number().optional(),
    locationLon: z.number().optional(),
    locationName: z.string().optional(),
    minTemperature: z.number().optional(),
    slackWebhookUrl: z.url().optional(),
    weatherCheckHour: z.number().optional(),
    slackChannel: z.string().optional(),
});

export type EventOverrides = z.infer<typeof eventOverridesSchema>;

export const getConfig = async (
    eventOverrides?: EventOverrides,
    dependencies: { secretsManagerClientImpl?: Pick<SecretsManagerClientImpl, 'getSecretValue'> | undefined } = {},
) => {
    const env = getEnv();
    const slackWebhookUrl =
        eventOverrides?.slackWebhookUrl || (await getWebhookUrl(dependencies.secretsManagerClientImpl));

    return {
        awsRegion: env.AWS_DEFAULT_REGION,
        badWeatherConditions: eventOverrides?.badWeatherConditions || BOT_CONFIG.badWeatherConditions,
        dynamodbTableName: env.DYNAMODB_TABLE_NAME,
        goodWeatherConditions: eventOverrides?.goodWeatherConditions || BOT_CONFIG.goodWeatherConditions,
        locationLat: eventOverrides?.locationLat || env.LOCATION_LAT,
        locationLon: eventOverrides?.locationLon || env.LOCATION_LON,
        locationName: eventOverrides?.locationName || env.LOCATION_NAME,
        minTemperature: eventOverrides?.minTemperature || env.MIN_TEMPERATURE,
        replyApiUrl: env.REPLY_API_URL,
        slackWebhookUrl,
        weatherCheckHour: eventOverrides?.weatherCheckHour || NOON_HOUR,
        slackChannel: eventOverrides?.slackChannel || env.SLACK_CHANNEL,
    };
};

export const getCoordinates = async (eventOverrides?: EventOverrides) => {
    const config = await getConfig(eventOverrides);
    return {
        lat: config.locationLat,
        lon: config.locationLon,
        locationName: config.locationName,
    };
};

export const clearCache = () => {
    cachedEnv = null;
    cachedWebhookUrl = null;
    secretsManagerClient = null;
};
