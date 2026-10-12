import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import { format, startOfWeek } from 'date-fns';
import { getConfig, getCoordinates } from '../utils/env';
import { verifyActionToken } from '../utils/action-token';
import { DynamoDBStorageService } from '../implementations/dynamodb-storage';
import { SecretsManagerClientImpl } from '../implementations/secrets-manager-client';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const replyRequestSchema = z.object({
    action: z.enum(['confirm-lunch', 'opt-in-warnings', 'opt-out-warnings']),
    location: z.string().optional(),
    date: z.string().optional(),
    token: z.string(),
});

export interface ReplyHandlerDependencies {
    storageService?: Pick<
        DynamoDBStorageService,
        'setWeatherWarningOptInStatus' | 'hasLunchBeenConfirmedForWeek' | 'recordLunchConfirmation'
    >;
    secretsManagerClient: Pick<SecretsManagerClientImpl, 'getSecretValue'>;
}

export const createReplyHandler = (dependencies: ReplyHandlerDependencies) =>
    (async (event: Pick<APIGatewayProxyEvent, 'httpMethod' | 'body' | 'queryStringParameters' | 'headers'>) => {
        console.log('Reply handler started', { event });

        try {
            const corsHeaders = {
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                'Access-Control-Allow-Origin': '*',
            } as const;

            const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'] || '';

            if (userAgent.includes('Slackbot-LinkExpanding')) {
                console.log('Blocking Slack link expanding bot request', { userAgent });
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Bot request blocked' }),
                };
            }

            if (event.httpMethod === 'OPTIONS') {
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'CORS preflight successful' }),
                };
            }

            if (!['POST', 'GET'].includes(event.httpMethod)) {
                return {
                    body: JSON.stringify({ error: 'Method not allowed', allowedMethods: ['GET', 'POST', 'OPTIONS'] }),
                    headers: corsHeaders,
                    statusCode: 405,
                };
            }

            let requestData = {};

            if (event.httpMethod === 'POST' && event.body) {
                try {
                    requestData = JSON.parse(event.body);
                } catch (error) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            error: 'Invalid JSON in request body',
                            details: error instanceof Error ? error.message : 'Unknown parsing error',
                        }),
                    };
                }
            } else if (event.httpMethod === 'GET' && event.queryStringParameters) {
                requestData = event.queryStringParameters;
            }

            const parseResult = replyRequestSchema.safeParse(requestData);
            if (!parseResult.success) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: 'Invalid request parameters',
                        details: parseResult.error.issues,
                        allowedActions: ['confirm-lunch', 'opt-in-warnings', 'opt-out-warnings'],
                    }),
                };
            }

            const { action, location: customLocation, date, token } = parseResult.data;

            const config = await getConfig(undefined, { secretsManagerClientImpl: dependencies.secretsManagerClient });
            const coordinates = await getCoordinates();

            // Only the single configured location may be targeted; no caller-selected
            // resource keys.
            const locationName = coordinates.locationName;
            if (customLocation !== undefined && customLocation !== locationName) {
                console.log(`Rejecting reply action for non-configured location: ${customLocation}`);
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Forbidden' }),
                };
            }

            // Confirmations may only target the current week, which is derived server-side.
            const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
            if (date !== undefined && date !== weekStart) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: 'Invalid date: confirmations may only target the current week',
                        expected: weekStart,
                    }),
                };
            }

            // Every state-changing action requires a valid server-issued HMAC token bound
            // to the exact action, location and current week start.
            if (!verifyActionToken(config.slackWebhookUrl, action, locationName, weekStart, token)) {
                console.log(`Rejecting reply action with invalid token for action: ${action}`);
                return {
                    statusCode: 403,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Forbidden' }),
                };
            }

            console.log(`Processing reply action: ${action} for location: ${locationName}`);

            const storageService =
                dependencies.storageService ??
                new DynamoDBStorageService({
                    client: new DynamoDBClient({ region: config.awsRegion }),
                    tableName: config.dynamodbTableName,
                });

            if (action === 'confirm-lunch') {
                const alreadyConfirmed = await storageService.hasLunchBeenConfirmedForWeek(locationName, weekStart);

                if (alreadyConfirmed) {
                    console.log(`Lunch already confirmed for week ${weekStart} for location: ${locationName}`);
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            message: 'Lunch already confirmed for this week! No more weather reminders will be sent.',
                            location: locationName,
                            weekStart,
                            alreadyConfirmed: true,
                            config: {
                                ...config,
                                slackWebhookUrl: '[REDACTED]',
                            },
                        }),
                    };
                }

                await storageService.recordLunchConfirmation(locationName, weekStart);
                console.log(
                    `Successfully recorded lunch confirmation for location: ${locationName} for week ${weekStart}`,
                );

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        message:
                            'Thanks for confirming! Lunch confirmed for this week. No more weather reminders will be sent.',
                        action,
                        location: locationName,
                        weekStart,
                        confirmed: true,
                        config: {
                            ...config,
                            slackWebhookUrl: '[REDACTED]',
                        },
                    }),
                };
            }

            if (action === 'opt-in-warnings') {
                await storageService.setWeatherWarningOptInStatus(locationName, true);
                console.log(`Successfully opted in to weather warnings for location: ${locationName}`);

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        message:
                            'Successfully opted in to weather warnings. You will now receive notifications when the weather is not suitable for outdoor lunch.',
                        action,
                        location: locationName,
                        optedIn: true,
                        config: {
                            ...config,
                            slackWebhookUrl: '[REDACTED]',
                        },
                    }),
                };
            }

            if (action === 'opt-out-warnings') {
                await storageService.setWeatherWarningOptInStatus(locationName, false);
                console.log(`Successfully opted out of weather warnings for location: ${locationName}`);

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        message:
                            'Successfully opted out of weather warnings. You will no longer receive notifications about bad weather.',
                        action,
                        location: locationName,
                        optedIn: false,
                        config: {
                            ...config,
                            slackWebhookUrl: '[REDACTED]',
                        },
                    }),
                };
            }

            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Unknown action',
                    providedAction: action,
                    allowedActions: ['confirm-lunch', 'opt-in-warnings', 'opt-out-warnings'],
                }),
            };
        } catch (error) {
            console.error('Error in reply handler:', error);

            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers':
                        'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                },
                body: JSON.stringify({
                    error: 'Internal server error',
                    message: error instanceof Error ? error.message : 'Unknown error',
                }),
            };
        }
    }) satisfies APIGatewayProxyHandler;

const createProductionDependencies = (): ReplyHandlerDependencies => {
    const client = new SecretsManagerClient({
        region: process.env['AWS_DEFAULT_REGION'] || 'eu-central-1',
    });

    return { secretsManagerClient: new SecretsManagerClientImpl(client) };
};

export const handler = createReplyHandler(createProductionDependencies());
