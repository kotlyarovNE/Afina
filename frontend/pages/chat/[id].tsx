import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import ChatInterface from '../../components/ChatInterface';
import { Chat, Message, ChatFile } from '../../types/chat';
import localforage from 'localforage';

const ChatPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [chat, setChat] = useState<Chat | null>(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [typingStates, setTypingStates] = useState<{ [key: string]: boolean }>({});

  // Загрузка чата
  useEffect(() => {
    if (id && typeof id === 'string') {
      loadChat(id);
      checkTypingState(id);
    }
  }, [id]);

  // Проверка состояния печати в фоне
  useEffect(() => {
    const interval = setInterval(() => {
      if (id && typeof id === 'string') {
        checkTypingState(id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [id]);

  const loadChat = async (chatId: string) => {
    try {
      const chats = await localforage.getItem<Chat[]>('afina_chats');
      if (chats) {
        const foundChat = chats.find(c => c.id === chatId);
        if (foundChat) {
          setChat(foundChat);
        } else {
          router.push('/');
        }
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Ошибка загрузки чата:', error);
      router.push('/');
    }
  };

  const checkTypingState = async (chatId: string) => {
    try {
      const isTyping = await localforage.getItem<boolean>(`${chatId}_typing`);
      setIsAgentTyping(!!isTyping);
    } catch (error) {
      console.error('Ошибка проверки состояния печати:', error);
    }
  };

  const updateChat = async (updatedChat: Chat) => {
    try {
      const chats = await localforage.getItem<Chat[]>('afina_chats');
      if (chats) {
        const newChats = chats.map(c => c.id === updatedChat.id ? updatedChat : c);
        await localforage.setItem('afina_chats', newChats);
        setChat(updatedChat);
      }
    } catch (error) {
      console.error('Ошибка обновления чата:', error);
    }
  };

  const sendMessage = useCallback(async (message: string, chatId: string, files: ChatFile[]) => {
    try {
      // Устанавливаем состояние печати
      await localforage.setItem(`${chatId}_typing`, true);
      setIsAgentTyping(true);

      // Отправляем запрос на сервер
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('message', message);
      formData.append('files', JSON.stringify(files));

      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Ошибка отправки сообщения');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Нет потока ответа');
      }

      // Создаем сообщение агента
      const agentMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: '',
        sender: 'agent',
        timestamp: new Date(),
      };

      // Обновляем чат с новым сообщением
      const currentChat = await localforage.getItem<Chat[]>('afina_chats');
      if (currentChat) {
        const chatIndex = currentChat.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
          currentChat[chatIndex].messages.push(agentMessage);
          await localforage.setItem('afina_chats', currentChat);
          setChat(currentChat[chatIndex]);
        }
      }

      // Читаем поток ответа
      let fullContent = '';
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  
                  // Обновляем сообщение в реальном времени
                  const chats = await localforage.getItem<Chat[]>('afina_chats');
                  if (chats) {
                    const chatIndex = chats.findIndex(c => c.id === chatId);
                    if (chatIndex !== -1) {
                      const messageIndex = chats[chatIndex].messages.findIndex(m => m.id === agentMessage.id);
                      if (messageIndex !== -1) {
                        chats[chatIndex].messages[messageIndex].content = fullContent;
                        chats[chatIndex].updatedAt = new Date();
                        await localforage.setItem('afina_chats', chats);
                        setChat(chats[chatIndex]);
                      }
                    }
                  }
                }

                if (data.done) {
                  break;
                }
              } catch (e) {
                console.error('Ошибка парсинга данных:', e);
              }
            }
          }
        }
      } finally {
        // Убираем состояние печати
        await localforage.removeItem(`${chatId}_typing`);
        setIsAgentTyping(false);
      }

    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      
      // Убираем состояние печати в случае ошибки
      await localforage.removeItem(`${chatId}_typing`);
      setIsAgentTyping(false);

      // Добавляем сообщение об ошибке
      if (chat) {
        const errorMessage: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: 'Извините, произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте еще раз.',
          sender: 'agent',
          timestamp: new Date(),
        };

        const updatedChat = {
          ...chat,
          messages: [...chat.messages, errorMessage],
          updatedAt: new Date(),
        };

        await updateChat(updatedChat);
      }
    }
  }, [chat]);

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка чата...</p>
        </div>
      </div>
    );
  }

  return (
    <ChatInterface
      chat={chat}
      onUpdateChat={updateChat}
      onSendMessage={sendMessage}
      isAgentTyping={isAgentTyping}
    />
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {},
  };
};

export default ChatPage;
