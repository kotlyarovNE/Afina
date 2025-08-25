import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import ChatInterface from '../../components/ChatInterface';
import { Chat, Message } from '../../types/chat';
import { 
  getChatMetadata, 
  getChatData, 
  addMessageToChat, 
  updateLastMessage, 
  setTypingState, 
  getTypingState 
} from '../../utils/storage';
import localforage from 'localforage';

const ChatPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [chat, setChat] = useState<Chat | null>(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  // Загрузка чата
  useEffect(() => {
    if (id && typeof id === 'string') {
      loadChat(id);
      checkTypingState(id);
      // Очищаем состояние печати при загрузке страницы (на случай зависания)
      clearTypingStateOnPageLoad(id);
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
      const metadata = await getChatMetadata();
      const foundChat = metadata[chatId];
      
      if (foundChat) {
        setChat(foundChat);
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
      const isTyping = await getTypingState(chatId);
      setIsAgentTyping(isTyping);
    } catch (error) {
      console.error('Ошибка проверки состояния печати:', error);
    }
  };

  const clearTypingStateOnPageLoad = async (chatId: string) => {
    try {
      // При загрузке страницы проверяем, не зависло ли состояние печати
      // Если прошло больше 30 секунд с последнего обновления, очищаем состояние
      const lastTypingTime = await localforage.getItem<number>(`${chatId}_typing_timestamp`);
      const now = Date.now();
      
      if (lastTypingTime && (now - lastTypingTime) > 30000) {
        // Прошло больше 30 секунд, очищаем состояние
        await setTypingState(chatId, false);
        await localforage.removeItem(`${chatId}_typing_timestamp`);
        console.log('Очищено зависшее состояние печати для чата:', chatId);
      }
    } catch (error) {
      console.error('Ошибка очистки состояния печати:', error);
    }
  };

  const sendMessage = useCallback(async (message: string, chatId: string, files: string[]) => {
    try {
      // Сначала добавляем сообщение пользователя в хранилище
      const userMessage: Message = {
        id: `${chatId.replace('chat_', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: message,
        sender: 'user',
        timestamp: new Date(),
      };

      await addMessageToChat(chatId, userMessage);

      // Устанавливаем состояние печати
      await setTypingState(chatId, true);
      await localforage.setItem(`${chatId}_typing_timestamp`, Date.now());
      setIsAgentTyping(true);

      // Создаем сообщение агента
      const agentMessage: Message = {
        id: `${chatId.replace('chat_', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: '',
        sender: 'agent',
        timestamp: new Date(),
      };

      // Добавляем сообщение агента в хранилище
      await addMessageToChat(chatId, agentMessage);

      // ИСПОЛЬЗУЕМ НАТИВНЫЙ EventSource для НАСТОЯЩЕГО SSE без буферизации браузера!
      const params = new URLSearchParams({
        chat_id: chatId,
        message: message,
        files: JSON.stringify(files)
      });
      
      const eventSource = new EventSource(`http://localhost:8000/api/chat?${params.toString()}`);
      let fullContent = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.content) {
            fullContent += data.content;
            
            // МГНОВЕННО уведомляем UI о новых данных (без await!)
            window.dispatchEvent(new CustomEvent('chatStreamUpdate', { 
              detail: { chatId, content: fullContent } 
            }));
            
            // Асинхронно обновляем localStorage (не блокируем UI)
            updateLastMessage(chatId, fullContent).catch(console.error);
            localforage.setItem(`${chatId}_typing_timestamp`, Date.now()).catch(console.error);
          }

          if (data.done) {
            eventSource.close();
            
            // Убираем состояние печати
            setTypingState(chatId, false).catch(console.error);
            localforage.removeItem(`${chatId}_typing_timestamp`).catch(console.error);
            setIsAgentTyping(false);
          }
        } catch (e) {
          console.error('Ошибка парсинга SSE данных:', e);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Ошибка SSE соединения:', error);
        eventSource.close();
        
        // Убираем состояние печати в случае ошибки
        setTypingState(chatId, false).catch(console.error);
        localforage.removeItem(`${chatId}_typing_timestamp`).catch(console.error);
        setIsAgentTyping(false);

        // Добавляем сообщение об ошибке
        const errorMessage: Message = {
          id: `${chatId.replace('chat_', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: 'Извините, произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте еще раз.',
          sender: 'agent',
          timestamp: new Date(),
        };

        addMessageToChat(chatId, errorMessage).catch(console.error);
      };

    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      
      // Убираем состояние печати в случае ошибки
      await setTypingState(chatId, false);
      await localforage.removeItem(`${chatId}_typing_timestamp`);
      setIsAgentTyping(false);

      // Добавляем сообщение об ошибке
      const errorMessage: Message = {
        id: `${chatId.replace('chat_', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: 'Извините, произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте еще раз.',
        sender: 'agent',
        timestamp: new Date(),
      };

      await addMessageToChat(chatId, errorMessage);
    }
  }, []);

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
