export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  isTyping?: boolean;
}

export interface ChatFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

export interface Chat {
  id: string;
  name: string;
  messages: Message[];
  files: ChatFile[];
  createdAt: Date;
  updatedAt: Date;
  isAgentTyping?: boolean;
}

export interface TypingState {
  [chatId: string]: boolean;
}
