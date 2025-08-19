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
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatData {
  messages: Message[];
  files: string[]; // Массив имен файлов
  typing: boolean;
}

export interface ChatMetadata {
  [chatId: string]: Chat;
}

export interface TypingState {
  [chatId: string]: boolean;
}
