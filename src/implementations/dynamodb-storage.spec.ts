import { beforeEach, describe, expect, it, vi } from 'vitest';
import { marshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStorageService } from './dynamodb-storage';

describe('DynamoDBStorageService', () => {
    let storageService: DynamoDBStorageService;
    let mockClient: { send: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient = { send: vi.fn() };
        storageService = new DynamoDBStorageService({ tableName: 'test-table', client: mockClient });
    });

    describe('hasMessageBeenSentToday', () => {
        it('should return true if message exists for today', async () => {
            mockClient.send.mockResolvedValueOnce({
                Items: [marshall({ id: 'Munich#weather_reminder#2024-01-01' })],
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
                marshall({
                    id: 'Munich#weather_reminder#2024-01-01',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    ttl: 1672531200,
                }),
                marshall({
                    id: 'Munich#weather_warning#2024-01-02',
                    date: '2024-01-02',
                    timestamp: 1641081600000,
                    messageType: 'weather_warning',
                    location: 'Munich',
                    ttl: 1672617600,
                }),
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
                marshall({
                    id: 'Munich#weather_reminder#2024-01-01',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                    ttl: 1672531200,
                }),
                marshall({
                    id: 'Munich#weather_reminder#2024-01-02',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-02',
                    timestamp: 1641081600000,
                    ttl: 1672617600,
                }),
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
                marshall({
                    id: 'Munich#weather_reminder#2024-01-01',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                    ttl: 1672531200,
                }),
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
                marshall({
                    id: 'Munich#weather_reminder#2024-01-01',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                    ttl: 1672531200,
                }),
            ];

            mockClient.send.mockResolvedValueOnce({
                Items: mockItems,
            });

            const result = await storageService.canSendMessageThisWeek('Munich', 'weather_reminder');
            expect(result).toBe(true);
        });

        it('should return false when weekly limit reached', async () => {
            const mockItems = [
                marshall({
                    id: 'Munich#weather_reminder#2024-01-01',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                    ttl: 1672531200,
                }),
                marshall({
                    id: 'Munich#weather_reminder#2024-01-02',
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    date: '2024-01-02',
                    timestamp: 1641081600000,
                    ttl: 1672617600,
                }),
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
                marshall({
                    id: 'Munich#weather_reminder#2023-01-01',
                    date: '2023-01-01',
                    timestamp: 1672531200000,
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    ttl: 1672531200,
                }),
                marshall({
                    id: 'Munich#weather_warning#2023-01-02',
                    date: '2023-01-02',
                    timestamp: 1672617600000,
                    messageType: 'weather_warning',
                    location: 'Munich',
                    ttl: 1672617600,
                }),
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

    describe('resetCurrentWeek', () => {
        it('should delete all records for the current week', async () => {
            const mockWeekRecords = [
                marshall({
                    id: 'Munich#weather_reminder#2024-01-01',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    ttl: 1672531200,
                }),
                marshall({
                    id: 'Munich#lunch_confirmation#2024-01-01',
                    date: '2024-01-01',
                    timestamp: 1641081600000,
                    messageType: 'lunch_confirmation',
                    location: 'Munich',
                    ttl: 1672617600,
                }),
                marshall({
                    id: 'Munich#weather_warning#2024-01-02',
                    date: '2024-01-02',
                    timestamp: 1641168000000,
                    messageType: 'weather_warning',
                    location: 'Munich',
                    ttl: 1672704000,
                }),
            ];

            mockClient.send.mockResolvedValueOnce({ Items: mockWeekRecords }).mockResolvedValue({});

            await storageService.resetCurrentWeek('Munich');

            expect(mockClient.send).toHaveBeenCalledTimes(4); // 1 scan + 3 deletes

            // Verify the scan command was called correctly
            const scanCall = mockClient.send.mock.calls[0][0];
            expect(scanCall.input.TableName).toBe('test-table');
            expect(scanCall.input.FilterExpression).toContain('#location = :location');
            expect(scanCall.input.ExpressionAttributeValues[':location'].S).toBe('Munich');

            // Verify delete commands were called for each record
            for (let i = 1; i < 4; i++) {
                const deleteCall = mockClient.send.mock.calls[i][0];
                expect(deleteCall.input.TableName).toBe('test-table');
                expect(deleteCall.input.Key).toBeDefined();
            }
        });

        it('should handle no records found for current week', async () => {
            mockClient.send.mockResolvedValueOnce({ Items: [] });

            await storageService.resetCurrentWeek('Munich');

            expect(mockClient.send).toHaveBeenCalledTimes(1); // Only scan, no deletes
        });

        it('should handle undefined items in scan result', async () => {
            mockClient.send.mockResolvedValueOnce({ Items: undefined });

            await storageService.resetCurrentWeek('Munich');

            expect(mockClient.send).toHaveBeenCalledTimes(1); // Only scan, no deletes
        });

        it('should throw error on scan failure', async () => {
            mockClient.send.mockRejectedValueOnce(new Error('DynamoDB scan error'));

            await expect(storageService.resetCurrentWeek('Munich')).rejects.toThrow('Failed to reset current week');
        });

        it('should throw error on delete failure', async () => {
            const mockWeekRecords = [
                marshall({
                    id: 'Munich#weather_reminder#2024-01-01',
                    date: '2024-01-01',
                    timestamp: 1640995200000,
                    messageType: 'weather_reminder',
                    location: 'Munich',
                    ttl: 1672531200,
                }),
            ];

            mockClient.send
                .mockResolvedValueOnce({ Items: mockWeekRecords })
                .mockRejectedValueOnce(new Error('DynamoDB delete error'));

            await expect(storageService.resetCurrentWeek('Munich')).rejects.toThrow('Failed to reset current week');
        });

        it('should correctly filter records by location and current week', async () => {
            mockClient.send.mockResolvedValueOnce({ Items: [] });

            await storageService.resetCurrentWeek('Berlin');

            // Verify the scan was called with correct location parameter
            const scanCall = mockClient.send.mock.calls[0][0];
            expect(scanCall.input.ExpressionAttributeValues[':location'].S).toBe('Berlin');
        });
    });
});
