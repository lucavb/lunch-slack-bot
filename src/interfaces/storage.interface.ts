export interface MessageRecord {
    id: string;
    date: string; // YYYY-MM-DD format
    timestamp: number;
    messageType: 'weather_reminder' | 'weather_warning' | 'lunch_confirmation';
    location: string;
    temperature?: number;
    weatherCondition?: string;
    ttl?: number;
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

    /**
     * Record that the team has confirmed they met for lunch this week
     */
    recordLunchConfirmation(location: string): Promise<void>;

    /**
     * Check if the team has confirmed they met for lunch this week
     */
    hasLunchBeenConfirmedThisWeek(location: string): Promise<boolean>;
}
