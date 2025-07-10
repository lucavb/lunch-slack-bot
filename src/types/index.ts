export interface Coordinates {
    lat: number;
    lon: number;
    locationName: string;
}

export interface WeatherForecast {
    location: string;
    coordinates: {
        latitude: number;
        longitude: number;
    };
    temperature: number;
    condition: string;
    description: string;
    timestamp: Date;
    windSpeed?: number;
    humidity?: number;
    isGood: boolean;
}

export interface WeatherApiConfig {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
}

export interface WeatherConditionResult {
    condition: string;
    temperature: number;
    description: string;
    isGood: boolean;
}

export interface WeatherConfig {
    minTemperature: number;
    goodWeatherConditions: readonly string[];
    badWeatherConditions: readonly string[];
    weatherCheckHour: number;
}

export interface SlackMessage {
    text: string;
    blocks?: SlackBlock[];
    attachments?: SlackAttachment[];
    username?: string;
    icon_emoji?: string;
    channel?: string;
}

export interface SlackBlock {
    type: string;
    text?: {
        type: string;
        text: string;
        emoji?: boolean;
    };
    elements?: SlackElement[];
    accessory?: SlackElement;
}

export interface SlackElement {
    type: string;
    text?: string;
    action_id?: string;
    value?: string;
    url?: string;
    style?: 'primary' | 'danger';
}

export interface SlackAttachment {
    color?: string;
    title?: string;
    title_link?: string;
    text?: string;
    fields?: SlackField[];
    actions?: SlackAction[];
    footer?: string;
    ts?: number;
}

export interface SlackField {
    title: string;
    value: string;
    short?: boolean;
}

export interface SlackAction {
    type: string;
    text: string;
    name?: string;
    value?: string;
    url?: string;
    style?: 'primary' | 'danger';
}

export interface MessageRecord {
    id: string;
    messageType: 'weather_reminder' | 'weather_warning' | 'lunch_confirmation';
    location: string;
    timestamp: number;
    temperature?: number;
    weatherCondition?: string;
    ttl?: number;
}

export interface WeeklyMessageStats {
    location: string;
    messageType: string;
    messageCount: number;
    weekStart: string;
    weekEnd: string;
    messages: MessageRecord[];
}

export interface LambdaResponse {
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
}

export interface ConfirmLunchAction {
    action: 'confirm-lunch';
    location?: string;
}

export * from '../schemas/weather.schema';
