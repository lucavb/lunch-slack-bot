import { BotConfig } from '../types/index';
import { validateBotConfig } from '../schemas/weather.schema';

const botConfigData = {
    minTemperature: 14,
    goodWeatherConditions: ['clear', 'partly-cloudy'] as const,
    badWeatherConditions: ['rain', 'drizzle', 'thunderstorm', 'snow'] as const,
    positiveReactions: ['thumbsup', '+1', 'white_check_mark', 'heavy_check_mark', 'tada', 'raised_hands'] as const,
    minReactionsForAcceptance: 2,
    lookbackDays: 7,
} as const;

export const BOT_CONFIG: BotConfig = validateBotConfig(botConfigData);

export const OPEN_METEO_API_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export const LUNCH_MESSAGE_TEMPLATE = (
    location: string,
    temperature: number,
    description: string,
    confirmationUrl?: string,
    slackChannel?: string,
) => {
    const greeting = slackChannel ? `🌤️ Hey ${slackChannel}!` : '🌤️ Hey team!';
    const baseMessage = `${greeting} The weather looks great for lunch outside today!

📍 ${location}
🌡️ ${temperature}°C at noon  
☀️ ${description}`;

    if (confirmationUrl) {
        return `${baseMessage}

Anyone up for a lunch meetup in the park? React with ✅ to communicate with colleagues, and <${confirmationUrl}|click here after your lunch meeting> to confirm it for this week!`;
    }

    return `${baseMessage}

Anyone up for a lunch meetup in the park? React with ✅ if you're interested!`;
};

export const generateConfirmationUrl = (baseUrl: string, location: string, date?: string): string => {
    const url = new URL(baseUrl);
    url.searchParams.set('action', 'confirm-lunch');
    url.searchParams.set('location', location);
    if (date) {
        url.searchParams.set('date', date);
    }
    return url.toString();
};

export const NOON_HOUR = 12; // 12 PM / noon
export const SCHEDULER_HOUR = 10; // 10 AM for weather check
export const DYNAMO_TTL_DAYS = 30;
export const MAX_MESSAGES_PER_WEEK = 2;
export const DEFAULT_WEATHER_WARNINGS_ENABLED = false; // Weather warnings are opt-in by default

export const ERROR_MESSAGES = {
    WEATHER_API_ERROR: 'Failed to fetch weather data',
    SLACK_API_ERROR: 'Failed to interact with Slack API',
    DYNAMO_ERROR: 'Failed to interact with DynamoDB',
    MISSING_ENV_VAR: 'Missing required environment variable',
    INVALID_WEATHER_RESPONSE: 'Invalid weather API response',
    INVALID_SLACK_PAYLOAD: 'Invalid Slack payload',
};
