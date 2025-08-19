import localforage from 'localforage';
import { Chat, ChatData, ChatMetadata, Message, ChatFile } from '../types/chat';

// Ключи для хранения
const CHAT_METADATA_KEY = 'afina_chat_metadata';

// Генерация уникального ID чата на основе времени
export const generateChatId = (): string => {
  const timestamp = Date.now();
  return `chat_${timestamp}`;
};

// Получение метаданных всех чатов
export const getChatMetadata = async (): Promise<ChatMetadata> => {
  try {
    const metadata = await localforage.getItem<ChatMetadata>(CHAT_METADATA_KEY);
    return metadata || {};
  } catch (error) {
    console.error('Ошибка получения метаданных чатов:', error);
    return {};
  }
};

// Сохранение метаданных чатов
export const saveChatMetadata = async (metadata: ChatMetadata): Promise<void> => {
  try {
    await localforage.setItem(CHAT_METADATA_KEY, metadata);
  } catch (error) {
    console.error('Ошибка сохранения метаданных чатов:', error);
  }
};

// Получение данных конкретного чата
export const getChatData = async (chatId: string): Promise<ChatData> => {
  try {
    const data = await localforage.getItem<ChatData>(chatId);
    return data || { messages: [], files: [], typing: false };
  } catch (error) {
    console.error(`Ошибка получения данных чата ${chatId}:`, error);
    return { messages: [], files: [], typing: false };
  }
};

// Сохранение данных конкретного чата
export const saveChatData = async (chatId: string, data: ChatData): Promise<void> => {
  try {
    await localforage.setItem(chatId, data);
  } catch (error) {
    console.error(`Ошибка сохранения данных чата ${chatId}:`, error);
  }
};

// Создание нового чата
export const createNewChat = async (name: string): Promise<Chat> => {
  const chatId = generateChatId();
  const now = new Date();
  
  const chat: Chat = {
    id: chatId,
    name: name || 'Новый чат',
    createdAt: now,
    updatedAt: now,
  };

  const chatData: ChatData = {
    messages: [],
    files: [],
    typing: false,
  };

  // Сохраняем метаданные
  const metadata = await getChatMetadata();
  metadata[chatId] = chat;
  await saveChatMetadata(metadata);

  // Сохраняем данные чата
  await saveChatData(chatId, chatData);

  return chat;
};

// Обновление чата
export const updateChat = async (chat: Chat): Promise<void> => {
  const metadata = await getChatMetadata();
  metadata[chat.id] = { ...chat, updatedAt: new Date() };
  await saveChatMetadata(metadata);
};

// Удаление чата
export const deleteChat = async (chatId: string): Promise<void> => {
  try {
    // Удаляем метаданные
    const metadata = await getChatMetadata();
    delete metadata[chatId];
    await saveChatMetadata(metadata);

    // Удаляем данные чата
    await localforage.removeItem(chatId);
  } catch (error) {
    console.error(`Ошибка удаления чата ${chatId}:`, error);
  }
};

// Добавление сообщения в чат
export const addMessageToChat = async (chatId: string, message: Message): Promise<void> => {
  const chatData = await getChatData(chatId);
  chatData.messages.push(message);
  await saveChatData(chatId, chatData);

  // Обновляем время последнего обновления в метаданных
  const metadata = await getChatMetadata();
  if (metadata[chatId]) {
    metadata[chatId].updatedAt = new Date();
    await saveChatMetadata(metadata);
  }
};

// Обновление последнего сообщения в чате (для потокового ответа)
export const updateLastMessage = async (chatId: string, content: string): Promise<void> => {
  const chatData = await getChatData(chatId);
  if (chatData.messages.length > 0) {
    const lastMessage = chatData.messages[chatData.messages.length - 1];
    if (lastMessage.sender === 'agent') {
      lastMessage.content = content;
      await saveChatData(chatId, chatData);
    }
  }
};

// Установка состояния печати
export const setTypingState = async (chatId: string, isTyping: boolean): Promise<void> => {
  const chatData = await getChatData(chatId);
  chatData.typing = isTyping;
  await saveChatData(chatId, chatData);
};

// Получение состояния печати
export const getTypingState = async (chatId: string): Promise<boolean> => {
  const chatData = await getChatData(chatId);
  return chatData.typing;
};

// Добавление файла к чату
export const addFileToChat = async (chatId: string, fileName: string): Promise<void> => {
  const chatData = await getChatData(chatId);
  if (!chatData.files.includes(fileName)) {
    chatData.files.push(fileName);
    await saveChatData(chatId, chatData);
  }
};

// Удаление файла из чата
export const removeFileFromChat = async (chatId: string, fileName: string): Promise<void> => {
  const chatData = await getChatData(chatId);
  chatData.files = chatData.files.filter(f => f !== fileName);
  await saveChatData(chatId, chatData);
};

// Получение всех загруженных файлов с сервера
export const getUploadedFiles = async (): Promise<ChatFile[]> => {
  try {
    const response = await fetch('http://localhost:8000/api/files');
    if (!response.ok) {
      throw new Error('Ошибка получения файлов с сервера');
    }
    
    const data = await response.json();
    return data.files.map((file: any) => ({
      id: file.name, // Используем имя файла как ID
      name: file.name,
      size: file.size,
      type: '', // Тип определим по расширению если нужно
      uploadedAt: new Date(file.uploaded_at * 1000), // Конвертируем timestamp
    }));
  } catch (error) {
    console.error('Ошибка получения загруженных файлов:', error);
    return [];
  }
};

// Загрузка файла на сервер
export const uploadFile = async (file: File): Promise<ChatFile> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('http://localhost:8000/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Ошибка загрузки файла на сервер');
  }
  
  const data = await response.json();
  
  return {
    id: data.filename,
    name: data.filename,
    size: data.size,
    type: file.type,
    uploadedAt: new Date(),
  };
};

// Удаление загруженного файла с сервера
export const removeUploadedFile = async (fileName: string): Promise<void> => {
  try {
    const response = await fetch(`http://localhost:8000/api/files/${fileName}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Ошибка удаления файла с сервера');
    }
    
    // Также удаляем файл из всех чатов
    const metadata = await getChatMetadata();
    for (const chatId of Object.keys(metadata)) {
      await removeFileFromChat(chatId, fileName);
    }
  } catch (error) {
    console.error('Ошибка удаления файла:', error);
    throw error;
  }
};

// Получение файлов для конкретного чата
export const getChatFiles = async (chatId: string): Promise<ChatFile[]> => {
  const chatData = await getChatData(chatId);
  const allFiles = await getUploadedFiles();
  
  return allFiles.filter(file => chatData.files.includes(file.name));
};

// Миграция старых данных (если они есть)
export const migrateOldData = async (): Promise<void> => {
  try {
    const oldChats = await localforage.getItem<any[]>('afina_chats');
    if (oldChats && Array.isArray(oldChats)) {
      console.log('Миграция старых данных...');
      
      const metadata: ChatMetadata = {};
      
      for (const oldChat of oldChats) {
        const chatId = oldChat.id || generateChatId();
        
        // Создаем новую структуру метаданных
        metadata[chatId] = {
          id: chatId,
          name: oldChat.name || 'Чат',
          createdAt: oldChat.createdAt ? new Date(oldChat.createdAt) : new Date(),
          updatedAt: oldChat.updatedAt ? new Date(oldChat.updatedAt) : new Date(),
        };
        
        // Создаем новую структуру данных чата
        const chatData: ChatData = {
          messages: oldChat.messages || [],
          files: (oldChat.files || []).map((f: any) => f.name).filter(Boolean),
          typing: false,
        };
        
        await saveChatData(chatId, chatData);
      }
      
      await saveChatMetadata(metadata);
      
      // Удаляем старые данные
      await localforage.removeItem('afina_chats');
      
      console.log('Миграция завершена');
    }
  } catch (error) {
    console.error('Ошибка миграции данных:', error);
  }
};
