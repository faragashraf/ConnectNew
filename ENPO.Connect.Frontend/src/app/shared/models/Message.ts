export interface Message {
    chatId?: string,
    timeStamp: Date;
    isMe: boolean
    from: string
    to?: string
    content: string
    isRead:boolean
    senderName:string
}