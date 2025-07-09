import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getConfig } from '../utils/env';
import { getCoordinates } from '../utils/env';
import { DynamoDBStorageService } from '../implementations/dynamodb-storage';

const overridesSchema = z
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

const replySchema = z.object({
    action: z.enum(['confirm-lunch']).default('confirm-lunch'),
    location: z.string().optional(),
    overrides: overridesSchema,
});

export const handler = (async (
    event: Pick<APIGatewayProxyEvent, 'queryStringParameters' | 'httpMethod' | 'body'>,
): Promise<APIGatewayProxyResult> => {
    console.log('Reply handler started', { event });

    // Set CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS preflight successful' }),
        };
    }

    // Allow POST and GET requests
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Method not allowed',
                message: 'Only POST and GET requests are supported',
            }),
        };
    }

    try {
        // Parse request data from either body (POST) or query parameters (GET)
        let requestData;

        if (event.httpMethod === 'GET') {
            requestData = {
                action: event.queryStringParameters?.['action'] || 'confirm-lunch',
                location: event.queryStringParameters?.['location'],
            };
        } else {
            try {
                requestData = event.body ? JSON.parse(event.body) : {};
            } catch {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: 'Invalid JSON',
                        message: 'Request body must be valid JSON',
                    }),
                };
            }
        }

        // Validate the request
        const parseResult = replySchema.safeParse(requestData);
        if (!parseResult.success) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Invalid request',
                    details: parseResult.error.issues,
                }),
            };
        }

        const { action, location: requestLocation, overrides } = parseResult.data;

        const config = getConfig(overrides || {});
        const coordinates = getCoordinates(overrides || {});
        const location = requestLocation || coordinates.locationName;

        console.log('Processing reply action:', action, 'for location:', location);

        const storageService = new DynamoDBStorageService(config.dynamodbTableName, config.awsRegion);
        switch (action) {
            case 'confirm-lunch':
                return await handleLunchConfirmation(storageService, location, corsHeaders);
            default:
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: 'Unsupported action',
                        message: `Action '${action}' is not supported`,
                    }),
                };
        }
    } catch (error) {
        console.error('Error in reply handler:', error);

        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
}) satisfies APIGatewayProxyHandler;

async function handleLunchConfirmation(
    storageService: DynamoDBStorageService,
    location: string,
    corsHeaders: Record<string, string>,
): Promise<APIGatewayProxyResult> {
    const alreadyConfirmed = await storageService.hasLunchBeenConfirmedThisWeek(location);

    if (alreadyConfirmed) {
        console.log('Lunch already confirmed this week for location:', location);
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                action: 'confirm-lunch',
                message: 'Lunch already confirmed this week',
                location,
                alreadyConfirmed: true,
            }),
        };
    }

    await storageService.recordLunchConfirmation(location);

    console.log('Successfully recorded lunch confirmation for location:', location);

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            action: 'confirm-lunch',
            message: 'Lunch confirmation recorded successfully',
            location,
            confirmed: true,
            timestamp: new Date().toISOString(),
        }),
    };
}
