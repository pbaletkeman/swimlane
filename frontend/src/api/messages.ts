import api from './client.ts'
import type { Message, MessageInput } from './types.ts'

/**
 * Message endpoint wrappers (`/messages`): the member's inbox and staff sender.
 */
export const messages = {
  listMine: (): Promise<Message[]> => api.get<Message[]>('/messages/me'),
  markRead: (messageId: number): Promise<Message> =>
    api.put<Message>(`/messages/${messageId}/read`),
  send: (input: MessageInput): Promise<Message> => api.post<Message>('/messages', input),
}

export default messages