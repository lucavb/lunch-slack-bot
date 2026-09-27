import { Handler } from 'aws-lambda';
import { z } from 'zod';
import { format, startOfWeek } from 'date-fns';
import { eventOverridesSchema, getConfig, getCoordinates } from '../utils/env';
import { FetchHttpClient } from '../implementations/fetch-http-client';
import { OpenMeteoApi } from '../implementations/openmeteo-api';
import { WeatherConfig, WeatherDecision } from '../services/weather-decision';
import { WebhookSlackServiceImpl } from '../implementations/webhook-slack';
import { DynamoDBStorageService } from '../implementations/dynamodb-storage';
import { generateConfirmationUrl } from '../utils/constants';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SecretsManagerClientImpl } from '../implementations/secrets-manager-client';

const lambdaEventSchema = z.looseObject({ overrides: eventOverridesSchema.optional() });

export interface WeatherCheckHandlerDependencies {
    storageService?: Pick<
        DynamoDBStorageService,
        | 'hasLunchBeenConfirmedForWeek'
        | 'hasMessageBeenSentToday'
        | 'canSendMessageThisWeek'
        | 'getWeeklyMessageStats'
        | 'isOptedInToWeatherWarnings'
        | 'recordMessageSent'
        | 'cleanupOldRecords'
    >;
    weatherDecision?: Pick<WeatherDecision, 'decideForLunch'>;
    slackService?: Pick<WebhookSlackServiceImpl, 'sendWeatherReminder' | 'sendWeatherWarning'>;
    secretsManagerClient: Pick<SecretsManagerClientImpl, 'getSecretValue'>;
}

export const createWeatherCheckHandler = (dependencies: WeatherCheckHandlerDependencies) =>
    (async (event: unknown) => {
        console.log('Weather check handler started', { event });

        try {
            const parseResult = lambdaEventSchema.safeParse(event);

            if (!parseResult.success) {
                console.error('Invalid event structure:', parseResult.error.issues);
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: 'Invalid event structure',
                        details: parseResult.error.issues,
                    }),
                };
            }

            const eventOverrides = parseResult.data.overrides;
            console.log('Event overrides:', eventOverrides);

            const config = await getConfig(eventOverrides, {
                secretsManagerClientImpl: dependencies.secretsManagerClient,
            });
            const coordinates = await getCoordinates(eventOverrides);
            console.log('Using configuration:', {
                ...config,
                slackWebhookUrl: '[REDACTED]',
            });
            console.log('Using coordinates:', coordinates);

            const storageService =
                dependencies.storageService ??
                new DynamoDBStorageService({
                    client: new DynamoDBClient({ region: config.awsRegion }),
                    tableName: config.dynamodbTableName,
                });

            const weatherDecision =
                dependencies.weatherDecision ??
                (() => {
                    const httpClient = new FetchHttpClient();
                    const weatherApi = new OpenMeteoApi(httpClient);
                    const weatherConfig = {
                        badWeatherConditions: config.badWeatherConditions,
                        goodWeatherConditions: config.goodWeatherConditions,
                        minTemperature: config.minTemperature,
                        weatherCheckHour: config.weatherCheckHour,
                    } as const satisfies WeatherConfig;
                    return new WeatherDecision(weatherApi, weatherConfig);
                })();

            const slackService =
                dependencies.slackService ??
                (() => {
                    const httpClient = new FetchHttpClient();
                    return new WebhookSlackServiceImpl(config.slackWebhookUrl, httpClient);
                })();

            const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const lunchConfirmedThisWeek = await storageService.hasLunchBeenConfirmedForWeek(
                coordinates.locationName,
                weekStart,
            );

            if (lunchConfirmedThisWeek) {
                console.log('Lunch already confirmed this week, skipping weather check');
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        message: 'Lunch already confirmed this week, no weather messages needed',
                        location: coordinates.locationName,
                        lunchConfirmed: true,
                        config: {
                            ...config,
                            slackWebhookUrl: '[REDACTED]',
                        },
                    }),
                };
            }

            const alreadySentToday = await storageService.hasMessageBeenSentToday(
                'weather_reminder',
                coordinates.locationName,
            );

            if (alreadySentToday) {
                console.log('Message already sent today, skipping');
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        message: 'Message already sent today',
                        location: coordinates.locationName,
                        config: {
                            ...config,
                            slackWebhookUrl: '[REDACTED]',
                        },
                    }),
                };
            }

            const canSendThisWeek = await storageService.canSendMessageThisWeek(
                coordinates.locationName,
                'weather_reminder',
            );
            const weeklyStats = await storageService.getWeeklyMessageStats(
                coordinates.locationName,
                'weather_reminder',
            );

            if (!canSendThisWeek) {
                console.log(`Weekly message limit reached (${weeklyStats.messageCount}/2), skipping`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        message: 'Weekly message limit reached',
                        location: coordinates.locationName,
                        weeklyStats,
                        config: {
                            ...config,
                            slackWebhookUrl: '[REDACTED]',
                        },
                    }),
                };
            }

            const lunchWeather = await weatherDecision.decideForLunch(coordinates);
            console.log('LunchWeather:', lunchWeather);

            let messageSent = false;
            let messageType = '';

            if (lunchWeather.outcome === 'no-forecast') {
                console.log(`No forecast available for ${coordinates.locationName}, sending nothing`);
            } else if (lunchWeather.outcome === 'good') {
                const confirmationUrl = generateConfirmationUrl(
                    config.replyApiUrl,
                    coordinates.locationName,
                    weekStart,
                );

                await slackService.sendWeatherReminder(
                    lunchWeather.temperature,
                    lunchWeather.description,
                    coordinates.locationName,
                    confirmationUrl,
                    config.slackChannel,
                );

                await storageService.recordMessageSent(
                    'weather_reminder',
                    coordinates.locationName,
                    lunchWeather.temperature,
                    lunchWeather.condition,
                );

                messageSent = true;
                messageType = 'weather_reminder';
                console.log('Sent weather reminder successfully with confirmation link');
            } else {
                if (!config.enableWeatherWarnings) {
                    console.log('Weather warnings are disabled, skipping');
                } else {
                    const isOptedInForWarnings = await storageService.isOptedInToWeatherWarnings(
                        coordinates.locationName,
                    );

                    if (!isOptedInForWarnings) {
                        console.log('Location has not opted in to receive weather warnings, skipping');
                    } else {
                        const canSendWarning = await storageService.canSendMessageThisWeek(
                            coordinates.locationName,
                            'weather_warning',
                        );
                        const alreadySentWarningToday = await storageService.hasMessageBeenSentToday(
                            'weather_warning',
                            coordinates.locationName,
                        );

                        if (canSendWarning && !alreadySentWarningToday) {
                            await slackService.sendWeatherWarning(
                                lunchWeather.temperature,
                                lunchWeather.description,
                                coordinates.locationName,
                                config.replyApiUrl,
                            );

                            await storageService.recordMessageSent(
                                'weather_warning',
                                coordinates.locationName,
                                lunchWeather.temperature,
                                lunchWeather.condition,
                            );

                            messageSent = true;
                            messageType = 'weather_warning';
                            console.log('Sent weather warning successfully');
                        } else {
                            console.log('Weather warning skipped due to weekly limit or already sent today');
                        }
                    }
                }
            }

            await storageService.cleanupOldRecords(30);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message:
                        lunchWeather.outcome === 'no-forecast'
                            ? 'No forecast available'
                            : 'Weather check completed successfully',
                    location: coordinates.locationName,
                    weather:
                        lunchWeather.outcome === 'no-forecast'
                            ? null
                            : {
                                  temperature: lunchWeather.temperature,
                                  condition: lunchWeather.condition,
                                  description: lunchWeather.description,
                                  isGood: lunchWeather.outcome === 'good',
                              },
                    messagesSent: {
                        sent: messageSent,
                        type: messageType,
                    },
                    lunchConfirmed: false,
                    weeklyStats,
                    config: {
                        ...config,
                        slackWebhookUrl: '[REDACTED]',
                    },
                }),
            };
        } catch (error) {
            console.error('Error in weather check handler:', error);

            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Internal server error',
                    message: error instanceof Error ? error.message : 'Unknown error',
                }),
            };
        }
    }) satisfies Handler;

const createProductionDependencies = (): WeatherCheckHandlerDependencies => {
    const client = new SecretsManagerClient({
        region: process.env['AWS_DEFAULT_REGION'] || 'eu-central-1',
    });

    return { secretsManagerClient: new SecretsManagerClientImpl(client) };
};

export const handler = createWeatherCheckHandler(createProductionDependencies());
