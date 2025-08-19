import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import { Chat } from '../types/chat';
import localforage from 'localforage';

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
    loadChats();
  }, []);

  // Обновление текущего чата при изменении URL
  useEffect(() => {
    if (router.query.id && typeof router.query.id === 'string') {
      setCurrentChatId(router.query.id);
    } else {
      setCurrentChatId(null);
    }
  }, [router.query.id]);

  const loadChats = async () => {
    try {
      const savedChats = await localforage.getItem<Chat[]>('afina_chats');
      if (savedChats) {
        setChats(savedChats);
      }
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    }
  };

  const saveChats = async (newChats: Chat[]) => {
    try {
      await localforage.setItem('afina_chats', newChats);
      setChats(newChats);
    } catch (error) {
      console.error('Ошибка сохранения чатов:', error);
    }
  };

  const createNewChat = async (name: string) => {
    const newChat: Chat = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name || 'Новый чат',
      messages: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newChats = [newChat, ...chats];
    await saveChats(newChats);
    
    // Переход на новый чат
    router.push(`/chat/${newChat.id}`);
    return newChat;
  };

  const deleteChat = async (chatId: string) => {
    const newChats = chats.filter(chat => chat.id !== chatId);
    await saveChats(newChats);
    
    // Если удаляем текущий чат, переходим на главную
    if (currentChatId === chatId) {
      router.push('/');
    }
  };

  const updateChat = async (updatedChat: Chat) => {
    const newChats = chats.map(chat => 
      chat.id === updatedChat.id ? updatedChat : chat
    );
    await saveChats(newChats);
  };

  return (
    <div className="flex h-screen bg-gray-50">
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
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? 'ml-80' : 'ml-0'
        }`}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
