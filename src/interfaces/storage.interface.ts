export interface MessageRecord {
    id: string;
    date: string; // YYYY-MM-DD format
    timestamp: number;
    messageType: 'weather_reminder' | 'weather_warning';
    location: string;
    temperature?: number;
    weatherCondition?: string;
}

export interface WeeklyMessageStats {
    weekStart: string; // ISO date string for Monday of the week
    messageCount: number;
    lastMessageDate: string;
    canSendMessage: boolean;
}

export interface StorageService {
    /**
     * Check if a message was already sent today
     */
    hasMessageBeenSentToday(messageType: string, location: string): Promise<boolean>;

    /**
     * Get weekly message statistics for a location
     */
    getWeeklyMessageStats(location: string, messageType: string): Promise<WeeklyMessageStats>;

    /**
     * Check if we can send a message this week (under weekly limit)
     */
    canSendMessageThisWeek(location: string, messageType: string): Promise<boolean>;

    /**
     * Record that a message was sent
     */
    recordMessageSent(
        messageType: string,
        location: string,
        temperature?: number,
        weatherCondition?: string,
    ): Promise<void>;

    /**
     * Get message history for a location
     */
    getMessageHistory(location: string, days?: number): Promise<MessageRecord[]>;

    /**
     * Clean up old records (older than specified days)
     */
    cleanupOldRecords(daysToKeep: number): Promise<void>;
}
