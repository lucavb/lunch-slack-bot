export interface WebhookSlackService {
    /**
     * Send a message to the configured webhook URL
     */
    sendMessage(text: string, blocks?: unknown[]): Promise<void>;

    /**
     * Send a weather reminder message
     */
    sendWeatherReminder(temperature: number, description: string, locationName: string): Promise<void>;

    /**
     * Send a warning message about bad weather
     */
    sendWeatherWarning(temperature: number, description: string, locationName: string): Promise<void>;
}
