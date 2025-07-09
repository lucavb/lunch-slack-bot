import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamoDBStorageService } from './dynamodb-storage';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Mock AWS SDK
vi.mock('@aws-sdk/client-dynamodb', () => {
    const mockSend = vi.fn();
    const mockClient = vi.fn().mockImplementation(() => ({
        send: mockSend,
    }));

    return {
        DynamoDBClient: mockClient,
        PutItemCommand: vi.fn(),
        QueryCommand: vi.fn(),
        ScanCommand: vi.fn(),
        DeleteItemCommand: vi.fn(),
    };
});

vi.mock('@aws-sdk/util-dynamodb', () => ({
    marshall: vi.fn((obj) => obj),
    unmarshall: vi.fn((obj) => obj),
}));

describe('DynamoDBStorageService', () => {
    let storageService: DynamoDBStorageService;
    let mockClient: any;

    beforeEach(() => {
        vi.clearAllMocks();
        storageService = new DynamoDBStorageService('test-table', 'eu-central-1');
        mockClient = (DynamoDBClient as any).mock.results[0].value;
    });

    describe('hasMessageBeenSentToday', () => {
        it('should return true if message exists for today', async () => {
            mockClient.send.mockResolvedValueOnce({
                Items: [{ id: 'Munich#weather_reminder#2024-01-01' }],
            });

            const result = await storageService.hasMessageBeenSentToday('weather_reminder', 'Munich');
            expect(result).toBe(true);
        });

        it('should return false if no message exists for today', async () => {
            mockClient.send.mockResolvedValueOnce({
                Items: [],
            });

            const result = await storageService.hasMessageBeenSentToday('weather_reminder', 'Munich');
            expect(result).toBe(false);
        });

        it('should throw error on DynamoDB failure', async () => {
            mockClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

            await expect(storageService.hasMessageBeenSentToday('weather_reminder', 'Munich')).rejects.toThrow(
                'Failed to check message status',
            );
        });
    });

    describe('recordMessageSent', () => {
        it('should record message with all fields', async () => {
            mockClient.send.mockResolvedValueOnce({});

            await expect(
                storageService.recordMessageSent('weather_reminder', 'Munich', 20, 'sunny'),
            ).resolves.toBeUndefined();

            expect(mockClient.send).toHaveBeenCalledTimes(1);
        });

        it('should record message without optional fields', async () => {
            mockClient.send.mockResolvedValueOnce({});

            await expect(storageService.recordMessageSent('weather_warning', 'Munich')).resolves.toBeUndefined();

            expect(mockClient.send).toHaveBeenCalledTimes(1);
        });

        it('should throw error on DynamoDB failure', async () => {
            mockClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

            await expect(storageService.recordMessageSent('weather_reminder', 'Munich')).rejects.toThrow(
                'Failed to record message',
            );
        });
    });

    describe('getMessageHistory', () => {
        it('should return message history sorted by timestamp', async () => {
            const mockItems = [
                { id: 'Munich#weather_reminder#2024-01-01', timestamp: 1640995200000 },
                { id: 'Munich#weather_warning#2024-01-02', timestamp: 1641081600000 },
            ];

            mockClient.send.mockResolvedValueOnce({
                Items: mockItems,
            });

            const result = await storageService.getMessageHistory('Munich', 30);
            expect(result).toHaveLength(2);
            expect(mockClient.send).toHaveBeenCalledTimes(1);
        });

        it('should return empty array if no items found', async () => {
            mockClient.send.mockResolvedValueOnce({
                Items: undefined,
            });

            const result = await storageService.getMessageHistory('Munich', 30);
            expect(result).toEqual([]);
        });

        it('should throw error on DynamoDB failure', async () => {
            mockClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

            await expect(storageService.getMessageHistory('Munich', 30)).rejects.toThrow(
                'Failed to get message history',
            );
        });
    });

    describe('getWeeklyMessageStats', () => {
        it('should return weekly stats with message count', async () => {
            const mockItems = [
                {
                    id: 'Munich#weather_reminder#2024-01-01',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                },
                {
                    id: 'Munich#weather_reminder#2024-01-02',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-02',
                    timestamp: 1641081600000,
                },
            ];

            mockClient.send.mockResolvedValueOnce({
                Items: mockItems,
            });

            const result = await storageService.getWeeklyMessageStats('Munich', 'weather_reminder');

            expect(result.messageCount).toBe(2);
            expect(result.canSendMessage).toBe(false); // 2 messages = max reached
            expect(result.weekStart).toBeDefined();
            expect(result.lastMessageDate).toBe('2024-01-02');
        });

        it('should return stats showing can send message when under limit', async () => {
            const mockItems = [
                {
                    id: 'Munich#weather_reminder#2024-01-01',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                },
            ];

            mockClient.send.mockResolvedValueOnce({
                Items: mockItems,
            });

            const result = await storageService.getWeeklyMessageStats('Munich', 'weather_reminder');

            expect(result.messageCount).toBe(1);
            expect(result.canSendMessage).toBe(true); // 1 message < 2 max
        });

        it('should throw error on DynamoDB failure', async () => {
            mockClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

            await expect(storageService.getWeeklyMessageStats('Munich', 'weather_reminder')).rejects.toThrow(
                'Failed to get weekly message stats',
            );
        });
    });

    describe('canSendMessageThisWeek', () => {
        it('should return true when under weekly limit', async () => {
            const mockItems = [
                {
                    id: 'Munich#weather_reminder#2024-01-01',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                },
            ];

            mockClient.send.mockResolvedValueOnce({
                Items: mockItems,
            });

            const result = await storageService.canSendMessageThisWeek('Munich', 'weather_reminder');
            expect(result).toBe(true);
        });

        it('should return false when weekly limit reached', async () => {
            const mockItems = [
                {
                    id: 'Munich#weather_reminder#2024-01-01',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                },
                {
                    id: 'Munich#weather_reminder#2024-01-02',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-02',
                    timestamp: 1641081600000,
                },
            ];

            mockClient.send.mockResolvedValueOnce({
                Items: mockItems,
            });

            const result = await storageService.canSendMessageThisWeek('Munich', 'weather_reminder');
            expect(result).toBe(false);
        });
    });

    describe('cleanupOldRecords', () => {
        it('should delete old records', async () => {
            const mockOldItems = [
                { id: 'Munich#weather_reminder#2023-01-01' },
                { id: 'Munich#weather_warning#2023-01-02' },
            ];

            mockClient.send.mockResolvedValueOnce({ Items: mockOldItems }).mockResolvedValue({});

            await storageService.cleanupOldRecords(30);

            expect(mockClient.send).toHaveBeenCalledTimes(3); // 1 scan + 2 deletes
        });

        it('should handle no old records to cleanup', async () => {
            mockClient.send.mockResolvedValueOnce({
                Items: [],
            });

            await storageService.cleanupOldRecords(30);

            expect(mockClient.send).toHaveBeenCalledTimes(1); // Only scan
        });

        it('should throw error on DynamoDB failure', async () => {
            mockClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

            await expect(storageService.cleanupOldRecords(30)).rejects.toThrow('Failed to cleanup old records');
        });
    });
});
