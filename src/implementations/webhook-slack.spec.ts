import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookSlackServiceImpl } from './webhook-slack';
import { HttpClient } from '../interfaces/http-client.interface';

describe('WebhookSlackServiceImpl', () => {
    let slackService: WebhookSlackServiceImpl;
    let mockHttpClient: HttpClient;

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };
        slackService = new WebhookSlackServiceImpl('https://hooks.slack.com/test', mockHttpClient);
    });

    describe('sendMessage', () => {
        it('should send message with text only', async () => {
            mockHttpClient.post = vi.fn().mockResolvedValueOnce({});

            await slackService.sendMessage('Test message');

            expect(mockHttpClient.post).toHaveBeenCalledWith('https://hooks.slack.com/test', {
                text: 'Test message',
            });
        });

        it('should send message with text and blocks', async () => {
            mockHttpClient.post = vi.fn().mockResolvedValueOnce({});
            const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Test' } }];

            await slackService.sendMessage('Test message', blocks);

            expect(mockHttpClient.post).toHaveBeenCalledWith('https://hooks.slack.com/test', {
                text: 'Test message',
                blocks,
            });
        });

        it('should throw error on HTTP failure', async () => {
            mockHttpClient.post = vi.fn().mockRejectedValueOnce(new Error('HTTP error'));

            await expect(slackService.sendMessage('Test message')).rejects.toThrow('Failed to send Slack message');
        });
    });

    describe('sendWeatherReminder', () => {
        it('should send weather reminder with correct format', async () => {
            mockHttpClient.post = vi.fn().mockResolvedValueOnce({});

            await slackService.sendWeatherReminder(20, 'sunny', 'Munich');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                'https://hooks.slack.com/test',
                expect.objectContaining({
                    text: expect.stringContaining('Munich'),
                    blocks: expect.arrayContaining([
                        expect.objectContaining({
                            type: 'section',
                            text: expect.objectContaining({
                                type: 'mrkdwn',
                                text: expect.stringContaining('Munich'),
                            }),
                        }),
                    ]),
                }),
            );
        });

        it('should include temperature and description in message', async () => {
            mockHttpClient.post = vi.fn().mockResolvedValueOnce({});

            await slackService.sendWeatherReminder(18, 'partly cloudy', 'Berlin');

            const call = (mockHttpClient.post as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = call[1];

            expect(payload.text).toContain('18°C');
            expect(payload.text).toContain('partly cloudy');
            expect(payload.text).toContain('Berlin');
        });

        it('should include confirmation link when provided', async () => {
            mockHttpClient.post = vi.fn().mockResolvedValueOnce({});
            const confirmationUrl = 'https://api.example.com/reply?action=confirm-lunch&location=Munich';

            await slackService.sendWeatherReminder(18, 'sunny', 'Munich', confirmationUrl);

            const call = (mockHttpClient.post as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = call[1];

            expect(payload.text).toContain('Click here to confirm');
            expect(payload.text).toContain(confirmationUrl);
        });
    });

    describe('sendWeatherWarning', () => {
        it('should send weather warning with correct format', async () => {
            mockHttpClient.post = vi.fn().mockResolvedValueOnce({});

            await slackService.sendWeatherWarning(5, 'rainy', 'Munich');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                'https://hooks.slack.com/test',
                expect.objectContaining({
                    text: expect.stringContaining('Munich'),
                    blocks: expect.arrayContaining([
                        expect.objectContaining({
                            type: 'section',
                            text: expect.objectContaining({
                                type: 'mrkdwn',
                                text: expect.stringContaining("weather isn't great"),
                            }),
                        }),
                    ]),
                }),
            );
        });

        it('should include temperature and description in warning', async () => {
            mockHttpClient.post = vi.fn().mockResolvedValueOnce({});

            await slackService.sendWeatherWarning(2, 'snow', 'Vienna');

            const call = (mockHttpClient.post as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = call[1];

            expect(payload.text).toContain('2°C');
            expect(payload.text).toContain('snow');
            expect(payload.text).toContain('Vienna');
        });

        it('should include context block in warning', async () => {
            mockHttpClient.post = vi.fn().mockResolvedValueOnce({});

            await slackService.sendWeatherWarning(5, 'rainy', 'Munich');

            const call = (mockHttpClient.post as ReturnType<typeof vi.fn>).mock.calls[0];
            const payload = call[1];

            expect(payload.blocks).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'context',
                        elements: expect.arrayContaining([
                            expect.objectContaining({
                                type: 'mrkdwn',
                                text: expect.stringContaining('Automated weather update'),
                            }),
                        ]),
                    }),
                ]),
            );
        });
    });
});
