export interface ChatModel {
    connectionId: string | undefined,
    userId: string | undefined,
    userName: string | undefined,
    department: string | undefined,
    chatInitiated: boolean | undefined,
    unreadCount: number | undefined,
    status: boolean | undefined,
    lastSeen: Date | undefined,
}