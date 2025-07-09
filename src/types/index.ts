// Weather API types
export interface WeatherData {
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        humidity: number;
    };
    weather: Array<{
        id: number;
        main: string;
        description: string;
        icon: string;
    }>;
    dt: number;
    dt_txt: string;
}

export interface WeatherForecastResponse {
    cod: string;
    message: number;
    cnt: number;
    list: WeatherData[];
    city: {
        id: number;
        name: string;
        coord: {
            lat: number;
            lon: number;
        };
        country: string;
        population: number;
        timezone: number;
        sunrise: number;
        sunset: number;
    };
}

export interface WeatherCondition {
    isGood: boolean;
    temperature: number;
    description: string;
    condition: string;
    timestamp: number;
}

// Slack types
export interface SlackMessage {
    type: string;
    ts: string;
    text?: string;
    user?: string;
    bot_id?: string;
    reactions?: Array<{
        name: string;
        count: number;
        users: string[];
    }>;
}

export interface SlackInteractionPayload {
    type: string;
    user: {
        id: string;
        name: string;
    };
    channel: {
        id: string;
        name: string;
    };
    message: {
        ts: string;
        text: string;
    };
    actions: Array<{
        action_id: string;
        block_id: string;
        text: {
            type: string;
            text: string;
        };
        value: string;
        type: string;
        action_ts: string;
    }>;
    response_url: string;
    trigger_id: string;
}

// DynamoDB types
export interface LunchProposal {
    id: string;
    timestamp: number;
    location: string;
    weather: WeatherCondition;
    channelId: string;
    messageTs: string;
    reactions: number;
    ttl: number;
}

export interface DynamoDBItem {
    PK: string;
    SK: string;
    timestamp: number;
    location: string;
    weather: string;
    channelId: string;
    messageTs: string;
    reactions: number;
    ttl: number;
}

// Note: EnvironmentVariables interface removed - using Zod validation in utils/env.ts instead

// Lambda response types
export interface LambdaResponse {
    statusCode: number;
    body: string;
    headers?: {
        [key: string]: string;
    };
}

// Slack button actions
export type ButtonAction = 'lunch_yes' | 'lunch_maybe';

// Re-export types from schema for consistency
export type {
    WeatherConditionType,
    PositiveReactionType as PositiveReaction,
    BotConfigType as BotConfig,
    WeatherConditionResult,
} from '../schemas/weather.schema';

// Coordinates
export interface Coordinates {
    lat: number;
    lon: number;
    locationName: string;
}
