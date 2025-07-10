import { DeleteItemCommand, DynamoDBClient, PutItemCommand, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { MessageRecord, StorageService, WeeklyMessageStats } from '../interfaces/storage.interface';
import { MAX_MESSAGES_PER_WEEK, DYNAMO_TTL_DAYS } from '../utils/constants';
import { endOfWeek, format, startOfWeek, subDays } from 'date-fns';

export class DynamoDBStorageService implements StorageService {
    private readonly client: Pick<DynamoDBClient, 'send'>;
    private readonly tableName: string;

    constructor({ client, tableName }: { client: Pick<DynamoDBClient, 'send'>; tableName: string }) {
        this.client = client;
        this.tableName = tableName;
    }

    async hasMessageBeenSentToday(messageType: string, location: string): Promise<boolean> {
        const today = format(new Date(), 'yyyy-MM-dd');
        const id = `${location}#${messageType}#${today}`;

        try {
            const command = new QueryCommand({
                ExpressionAttributeValues: marshall({ ':id': id }),
                KeyConditionExpression: 'id = :id',
                Limit: 1,
                TableName: this.tableName,
            });

            const result = await this.client.send(command);
            return (result.Items?.length ?? 0) > 0;
        } catch (error) {
            console.error('Error checking if message was sent today:', error);
            throw new Error(`Failed to check message status: ${error}`);
        }
    }

    private getWeekStart(date: Date): string {
        // startOfWeek with Monday as first day of week
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        return format(weekStart, 'yyyy-MM-dd');
    }

    async getWeeklyMessageStats(location: string, messageType: string): Promise<WeeklyMessageStats> {
        const now = new Date();
        const weekStart = this.getWeekStart(now);
        const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

        try {
            const command = new ScanCommand({
                TableName: this.tableName,
                FilterExpression:
                    '#location = :location AND #messageType = :messageType AND #date >= :weekStart AND #date <= :weekEnd',
                ExpressionAttributeNames: {
                    '#location': 'location',
                    '#messageType': 'messageType',
                    '#date': 'date',
                },
                ExpressionAttributeValues: marshall({
                    ':location': location,
                    ':messageType': messageType,
                    ':weekStart': weekStart,
                    ':weekEnd': weekEnd,
                }),
            });

            const result = await this.client.send(command);
            const messages = result.Items ? result.Items.map((item) => unmarshall(item) as MessageRecord) : [];

            const messageCount = messages.length;
            const lastMessageDate =
                messages.length > 0 ? messages.sort((a, b) => b.timestamp - a.timestamp)[0].date : '';

            return {
                weekStart,
                messageCount,
                lastMessageDate,
                canSendMessage: messageCount < MAX_MESSAGES_PER_WEEK,
            };
        } catch (error) {
            console.error('Error getting weekly message stats:', error);
            throw new Error(`Failed to get weekly message stats: ${error}`);
        }
    }

    async canSendMessageThisWeek(location: string, messageType: string): Promise<boolean> {
        const stats = await this.getWeeklyMessageStats(location, messageType);
        return stats.canSendMessage;
    }

    async recordMessageSent(
        messageType: string,
        location: string,
        temperature?: number,
        weatherCondition?: string,
    ): Promise<void> {
        const today = format(new Date(), 'yyyy-MM-dd');
        const timestamp = Date.now();
        const id = `${location}#${messageType}#${today}`;
        const ttl = Math.floor(Date.now() / 1000) + DYNAMO_TTL_DAYS * 24 * 60 * 60;

        const record: MessageRecord = {
            id,
            date: today,
            timestamp,
            messageType: messageType as 'weather_reminder' | 'weather_warning',
            location,
            ttl,
            ...(temperature !== undefined && { temperature }),
            ...(weatherCondition !== undefined && { weatherCondition }),
        };

        try {
            const command = new PutItemCommand({
                TableName: this.tableName,
                Item: marshall(record),
            });

            await this.client.send(command);
            console.log(`Recorded message sent: ${messageType} for ${location} on ${today}`);
        } catch (error) {
            console.error('Error recording message:', error);
            throw new Error(`Failed to record message: ${error}`);
        }
    }

    async getMessageHistory(location: string, days: number = 30): Promise<MessageRecord[]> {
        const cutoffDate = subDays(new Date(), days);
        const cutoffTimestamp = cutoffDate.getTime();

        try {
            const command = new ScanCommand({
                TableName: this.tableName,
                FilterExpression: '#location = :location AND #timestamp >= :cutoffTimestamp',
                ExpressionAttributeNames: {
                    '#location': 'location',
                    '#timestamp': 'timestamp',
                },
                ExpressionAttributeValues: marshall({
                    ':location': location,
                    ':cutoffTimestamp': cutoffTimestamp,
                }),
            });

            const result = await this.client.send(command);

            if (!result.Items) {
                return [];
            }

            return result.Items.map((item) => unmarshall(item) as MessageRecord).sort(
                (a: MessageRecord, b: MessageRecord) => b.timestamp - a.timestamp,
            ); // Sort by timestamp descending
        } catch (error) {
            console.error('Error getting message history:', error);
            throw new Error(`Failed to get message history: ${error}`);
        }
    }

    async cleanupOldRecords(daysToKeep: number): Promise<void> {
        const cutoffDate = subDays(new Date(), daysToKeep);
        const cutoffTimestamp = cutoffDate.getTime();

        try {
            // First, scan for old records
            const scanCommand = new ScanCommand({
                TableName: this.tableName,
                FilterExpression: '#timestamp < :cutoffTimestamp',
                ExpressionAttributeNames: {
                    '#timestamp': 'timestamp',
                },
                ExpressionAttributeValues: marshall({
                    ':cutoffTimestamp': cutoffTimestamp,
                }),
                ProjectionExpression: 'id',
            });

            const scanResult = await this.client.send(scanCommand);

            if (!scanResult.Items || scanResult.Items.length === 0) {
                console.log('No old records to clean up');
                return;
            }

            // Delete old records
            const deletePromises = scanResult.Items.map(async (item) => {
                const record = unmarshall(item) as MessageRecord;
                const deleteCommand = new DeleteItemCommand({
                    TableName: this.tableName,
                    Key: marshall({ id: record.id }),
                });
                return this.client.send(deleteCommand);
            });

            await Promise.all(deletePromises);
            console.log(`Cleaned up ${scanResult.Items.length} old records`);
        } catch (error) {
            console.error('Error cleaning up old records:', error);
            throw new Error(`Failed to cleanup old records: ${error}`);
        }
    }

    async recordLunchConfirmation(location: string): Promise<void> {
        const now = new Date();
        const weekStart = this.getWeekStart(now);
        const timestamp = now.getTime();
        const id = `${location}#lunch_confirmation#${weekStart}`;
        const ttl = Math.floor(Date.now() / 1000) + DYNAMO_TTL_DAYS * 24 * 60 * 60;

        const record = {
            id,
            date: weekStart,
            timestamp,
            messageType: 'lunch_confirmation',
            location,
            ttl,
        } as const satisfies MessageRecord;

        try {
            const command = new PutItemCommand({
                TableName: this.tableName,
                Item: marshall(record),
            });

            await this.client.send(command);
            console.log(`Recorded lunch confirmation for ${location} for week starting ${weekStart}`);
        } catch (error) {
            console.error('Error recording lunch confirmation:', error);
            throw new Error(`Failed to record lunch confirmation: ${error}`);
        }
    }

    async hasLunchBeenConfirmedThisWeek(location: string): Promise<boolean> {
        const now = new Date();
        const weekStart = this.getWeekStart(now);
        const id = `${location}#lunch_confirmation#${weekStart}`;

        try {
            const command = new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'id = :id',
                ExpressionAttributeValues: marshall({
                    ':id': id,
                }),
                Limit: 1,
            });

            const result = await this.client.send(command);
            const hasConfirmation = (result.Items?.length ?? 0) > 0;

            console.log(`Lunch confirmation check for ${location} week ${weekStart}: ${hasConfirmation}`);
            return hasConfirmation;
        } catch (error) {
            console.error('Error checking lunch confirmation:', error);
            throw new Error(`Failed to check lunch confirmation: ${error}`);
        }
    }
}
