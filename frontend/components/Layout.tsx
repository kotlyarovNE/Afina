import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import { Chat } from '../types/chat';
import { 
  getChatMetadata, 
  createNewChat as createChat, 
  deleteChat as removeChatStorage, 
  updateChat as updateChatStorage,
  migrateOldData 
} from '../utils/storage';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const router = useRouter();

  // Загрузка чатов при монтировании
  useEffect(() => {
    initializeChats();
  }, []);

  // Обновление текущего чата при изменении URL
  useEffect(() => {
    if (router.query.id && typeof router.query.id === 'string') {
      setCurrentChatId(router.query.id);
    } else {
      setCurrentChatId(null);
    }
  }, [router.query.id]);

  const initializeChats = async () => {
    try {
      // Сначала проверяем и мигрируем старые данные
      await migrateOldData();
      
      // Затем загружаем чаты
      await loadChats();
    } catch (error) {
      console.error('Ошибка инициализации чатов:', error);
    }
  };

  const loadChats = async () => {
    try {
      const metadata = await getChatMetadata();
      const chatList = Object.values(metadata).sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setChats(chatList);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    }
  };

  const createNewChat = async (name: string) => {
    try {
      const newChat = await createChat(name);
      await loadChats(); // Перезагружаем список чатов
      
      // Переход на новый чат
      router.push(`/chat/${newChat.id}`);
      return newChat;
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      throw error;
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      await removeChatStorage(chatId);
      await loadChats(); // Перезагружаем список чатов
      
      // Если удаляем текущий чат, переходим на главную
      if (currentChatId === chatId) {
        router.push('/');
      }
    } catch (error) {
      console.error('Ошибка удаления чата:', error);
    }
  };

  const updateChat = async (updatedChat: Chat) => {
    try {
      await updateChatStorage(updatedChat);
      await loadChats(); // Перезагружаем список чатов
      
      // Уведомляем другие компоненты об изменении
      window.dispatchEvent(new CustomEvent('chatUpdated', { 
        detail: { chatId: updatedChat.id } 
      }));
    } catch (error) {
      console.error('Ошибка обновления чата:', error);
    }
  };

  return (
    <div className="flex h-screen min-h-0 bg-gray-50">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        chats={chats}
        currentChatId={currentChatId}
        onCreateChat={createNewChat}
        onDeleteChat={deleteChat}
        onUpdateChat={updateChat}
      />
      
      <main 
        className={`flex-1 min-h-0 overflow-hidden transition-all duration-300 ${
          isSidebarOpen ? 'ml-80' : 'ml-16'
        }`}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
