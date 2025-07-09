import { Handler } from 'aws-lambda';
import { getCoordinates, getConfig, EventOverrides } from '../utils/env';
import { FetchHttpClient } from '../implementations/fetch-http-client';
import { OpenMeteoApi } from '../implementations/openmeteo-api';
import { WeatherService, WeatherConfig } from '../services/weather.service';
import { WebhookSlackServiceImpl } from '../implementations/webhook-slack';
import { DynamoDBStorageService } from '../implementations/dynamodb-storage';

export const handler: Handler = async (event, context) => {
    console.log('Weather check handler started', { event, context });

    try {
        // Extract parameter overrides from event
        const eventOverrides: EventOverrides = event?.overrides || {};
        console.log('Event overrides:', eventOverrides);

        // Get configuration with event overrides
        const config = getConfig(eventOverrides);
        const coordinates = getCoordinates(eventOverrides);
        console.log('Using configuration:', {
            ...config,
            slackWebhookUrl: '[REDACTED]', // Don't log webhook URL for security
        });
        console.log('Using coordinates:', coordinates);

        // Initialize services with dependency injection
        const httpClient = new FetchHttpClient();
        const weatherApi = new OpenMeteoApi(httpClient);

        // Create weather configuration from config
        const weatherConfig = {
            badWeatherConditions: config.badWeatherConditions,
            goodWeatherConditions: config.goodWeatherConditions,
            minTemperature: config.minTemperature,
            weatherCheckHour: config.weatherCheckHour,
        } as const satisfies WeatherConfig;

        const weatherService = new WeatherService(weatherApi, weatherConfig);
        const slackService = new WebhookSlackServiceImpl(config.slackWebhookUrl, httpClient);
        const storageService = new DynamoDBStorageService(config.dynamodbTableName, config.awsRegion);

        // Check if we already sent a message today
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
                        slackWebhookUrl: '[REDACTED]', // Don't return webhook URL for security
                    },
                }),
            };
        }

        // Check weekly message limits
        const canSendThisWeek = await storageService.canSendMessageThisWeek(
            coordinates.locationName,
            'weather_reminder',
        );
        const weeklyStats = await storageService.getWeeklyMessageStats(coordinates.locationName, 'weather_reminder');

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
                        slackWebhookUrl: '[REDACTED]', // Don't return webhook URL for security
                    },
                }),
            };
        }

        // Get weather condition
        const weatherCondition = await weatherService.isWeatherGood(coordinates);
        console.log('Weather condition:', weatherCondition);

        let messageSent = false;
        let messageType = '';

        if (weatherCondition.isGood) {
            // Send lunch reminder for good weather
            await slackService.sendWeatherReminder(
                weatherCondition.temperature,
                weatherCondition.description,
                coordinates.locationName,
            );

            // Record that we sent the reminder
            await storageService.recordMessageSent(
                'weather_reminder',
                coordinates.locationName,
                weatherCondition.temperature,
                weatherCondition.condition,
            );

            messageSent = true;
            messageType = 'weather_reminder';
            console.log('Sent weather reminder successfully');
        } else {
            // For bad weather, we still want to respect weekly limits but use different logic
            const canSendWarning = await storageService.canSendMessageThisWeek(
                coordinates.locationName,
                'weather_warning',
            );
            const alreadySentWarningToday = await storageService.hasMessageBeenSentToday(
                'weather_warning',
                coordinates.locationName,
            );

            if (canSendWarning && !alreadySentWarningToday) {
                // Send warning for bad weather
                await slackService.sendWeatherWarning(
                    weatherCondition.temperature,
                    weatherCondition.description,
                    coordinates.locationName,
                );

                // Record that we sent the warning
                await storageService.recordMessageSent(
                    'weather_warning',
                    coordinates.locationName,
                    weatherCondition.temperature,
                    weatherCondition.condition,
                );

                messageSent = true;
                messageType = 'weather_warning';
                console.log('Sent weather warning successfully');
            } else {
                console.log('Weather warning skipped due to weekly limit or already sent today');
            }
        }

        // Clean up old records (older than 30 days)
        await storageService.cleanupOldRecords(30);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Weather check completed successfully',
                location: coordinates.locationName,
                weather: {
                    temperature: weatherCondition.temperature,
                    condition: weatherCondition.condition,
                    description: weatherCondition.description,
                    isGood: weatherCondition.isGood,
                },
                messagesSent: {
                    sent: messageSent,
                    type: messageType,
                },
                weeklyStats,
                config: {
                    ...config,
                    slackWebhookUrl: '[REDACTED]', // Don't return webhook URL for security
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
};
