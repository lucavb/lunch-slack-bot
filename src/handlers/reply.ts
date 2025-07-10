import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import { getConfig, getCoordinates } from '../utils/env';
import { DynamoDBStorageService } from '../implementations/dynamodb-storage';
import { SecretsManagerClientImpl } from '../implementations/secrets-manager-client';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const replyRequestSchema = z.object({
    action: z.enum(['confirm-lunch']).default('confirm-lunch'),
    location: z.string().optional(),
});

export const handler = (async (
    event: Pick<APIGatewayProxyEvent, 'httpMethod' | 'body' | 'queryStringParameters'>,
    _?: unknown,
    __?: unknown,
    dependencies: {
        storageService?: Pick<DynamoDBStorageService, 'hasLunchBeenConfirmedThisWeek' | 'recordLunchConfirmation'>;
        secretsManagerClientImpl?: Pick<SecretsManagerClientImpl, 'getSecretValue'>;
    } = {},
) => {
    console.log('Reply handler started', { event });

    try {
        const corsHeaders = {
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Origin': '*',
        } as const;

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
                    allowedActions: ['confirm-lunch'],
                }),
            };
        }

        const { action, location: customLocation } = parseResult.data;

        const config = await getConfig(undefined, { secretsManagerClientImpl: dependencies.secretsManagerClientImpl });
        const coordinates = await getCoordinates();

        const locationName = customLocation || coordinates.locationName;

        console.log(`Processing reply action: ${action} for location: ${locationName}`);

        const storageService =
            dependencies.storageService ??
            new DynamoDBStorageService({
                client: new DynamoDBClient({ region: config.awsRegion }),
                tableName: config.dynamodbTableName,
            });

        if (action === 'confirm-lunch') {
            const alreadyConfirmed = await storageService.hasLunchBeenConfirmedThisWeek(locationName);

            if (alreadyConfirmed) {
                console.log(`Lunch already confirmed this week for location: ${locationName}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        message: 'Lunch already confirmed this week! No more weather reminders will be sent.',
                        location: locationName,
                        alreadyConfirmed: true,
                        config: {
                            ...config,
                            slackWebhookUrl: '[REDACTED]',
                        },
                    }),
                };
            }

            await storageService.recordLunchConfirmation(locationName);
            console.log(`Successfully recorded lunch confirmation for location: ${locationName}`);

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    message:
                        'Thanks for confirming! Lunch confirmed for this week. No more weather reminders will be sent.',
                    action,
                    location: locationName,
                    confirmed: true,
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
                allowedActions: ['confirm-lunch'],
            }),
        };
    } catch (error) {
        console.error('Error in reply handler:', error);

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
}) satisfies APIGatewayProxyHandler;
