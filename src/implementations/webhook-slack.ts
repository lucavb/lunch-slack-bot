import { WebhookSlackService } from '../interfaces/webhook-slack.interface';
import { HttpClient } from '../interfaces/http-client.interface';
import { LUNCH_MESSAGE_TEMPLATE } from '../utils/constants';

export class WebhookSlackServiceImpl implements WebhookSlackService {
    constructor(
        private webhookUrl: string,
        private httpClient: HttpClient,
    ) {}

    async sendMessage(text: string, blocks?: unknown[]): Promise<void> {
        try {
            const payload = {
                text,
                ...(blocks && { blocks }),
            };

            await this.httpClient.post(this.webhookUrl, payload);
            console.log('Successfully sent message to Slack webhook');
        } catch (error) {
            console.error('Error sending message to Slack webhook:', error);
            throw new Error(`Failed to send Slack message: ${error}`);
        }
    }

    async sendWeatherReminder(
        temperature: number,
        description: string,
        locationName: string,
        confirmationUrl?: string,
    ): Promise<void> {
        const messageText = LUNCH_MESSAGE_TEMPLATE(locationName, temperature, description, confirmationUrl);

        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: messageText,
                },
            },
        ];

        await this.sendMessage(messageText, blocks);
        console.log(
            `Sent weather reminder for ${locationName}: ${temperature}°C, ${description}${confirmationUrl ? ' with confirmation link' : ''}`,
        );
    }

    async sendWeatherWarning(temperature: number, description: string, locationName: string): Promise<void> {
        const messageText = `🌧️ **Weather Update for ${locationName}**

Unfortunately, the weather isn't great for an outdoor lunch today:
• Temperature: ${temperature}°C
• Conditions: ${description}

Maybe consider indoor lunch options or wait for better weather! 🏢☕`;

        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: messageText,
                },
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: '🤖 Automated weather update • Check back tomorrow!',
                    },
                ],
            },
        ];

        await this.sendMessage(messageText, blocks);
        console.log(`Sent weather warning for ${locationName}: ${temperature}°C, ${description}`);
    }
}
