import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Files, X, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Message, Chat, ChatFile } from '../types/chat';
import { getChatData, getChatFiles } from '../utils/storage';

interface ChatInterfaceProps {
  chat: Chat;
  onSendMessage: (message: string, chatId: string, files: string[]) => Promise<void>;
  isAgentTyping: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chat,
  onSendMessage,
  isAgentTyping,
}) => {
  const [message, setMessage] = useState('');
  const [showFiles, setShowFiles] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Загрузка данных чата при изменении chat.id
  useEffect(() => {
    loadChatData();
  }, [chat.id]);

  // Периодическое обновление данных чата для отображения потоковых сообщений
  useEffect(() => {
    if (!isAgentTyping) return;
    
    const interval = setInterval(() => {
      loadChatData();
    }, 200); // Обновляем каждые 200ms во время печати агента

    return () => clearInterval(interval);
  }, [isAgentTyping, chat.id]);

  // Автоматический скролл к последнему сообщению
  useEffect(() => {
    scrollToBottom();
  }, [messages, isAgentTyping]);

  // Автоматическое изменение размера textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // максимальная высота
      
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
        setIsExpanded(true);
      } else {
        textareaRef.current.style.height = `${scrollHeight}px`;
        setIsExpanded(scrollHeight > 44);
      }
    }
  }, [message]);

  const loadChatData = async () => {
    try {
      const chatData = await getChatData(chat.id);
      const files = await getChatFiles(chat.id);
      
      setMessages(chatData.messages);
      setChatFiles(files);
    } catch (error) {
      console.error('Ошибка загрузки данных чата:', error);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isAgentTyping) return;

    const trimmedMessage = message.trim();
    setMessage('');

    // Добавляем сообщение пользователя локально
    const userMessage: Message = {
      id: `${chat.id.replace('chat_', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: trimmedMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Отправляем сообщение с именами файлов
    const fileNames = chatFiles.map(f => f.name);
    await onSendMessage(trimmedMessage, chat.id, fileNames);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const removeFileFromChat = async (fileName: string) => {
    try {
      const { removeFileFromChat: removeFile } = await import('../utils/storage');
      await removeFile(chat.id, fileName);
      await loadChatData(); // Перезагружаем данные чата
    } catch (error) {
      console.error('Ошибка удаления файла из чата:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{chat.name}</h1>
          <p className="text-sm text-gray-500">
            {messages.length} сообщений
            {chatFiles.length > 0 && ` • ${chatFiles.length} файл(ов)`}
          </p>
        </div>
        
        {/* Files Button */}
        {chatFiles.length > 0 && (
          <button
            onClick={() => setShowFiles(!showFiles)}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Files className="w-5 h-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {chatFiles.length}
            </span>
          </button>
        )}
      </div>

      {/* Files Panel */}
      {showFiles && chatFiles.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Файлы в чате</h3>
            <button
              onClick={() => setShowFiles(false)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="space-y-2">
            {chatFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-center space-x-2">
                  <Paperclip className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFileFromChat(file.name)}
                  className="p-1 hover:bg-red-100 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">A</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Привет! Я Afina
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Я готова помочь вам с анализом документов и ответить на ваши вопросы. 
              Начните разговор или загрузите файлы для анализа.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.sender === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {msg.sender === 'agent' ? (
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        code: ({ children, className }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="bg-gray-200 px-1 py-0.5 rounded text-sm font-mono">
                              {children}
                            </code>
                          ) : (
                            <pre className="bg-gray-200 p-3 rounded-lg overflow-x-auto mt-2">
                              <code className="text-sm font-mono">{children}</code>
                            </pre>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                
                <div
                  className={`text-xs mt-2 ${
                    msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Typing Indicator */}
        {isAgentTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-3 max-w-[70%]">
              <div className="flex items-center space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-600 ml-2">Afina печатает...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isAgentTyping 
                  ? "Дождитесь ответа агента..." 
                  : "Напишите сообщение... (Enter - отправить, Shift+Enter - новая строка)"
              }
              disabled={isAgentTyping}
              className={`w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent chat-input ${
                isAgentTyping ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
              rows={1}
            />
          </div>
          
          <button
            type="submit"
            disabled={!message.trim() || isAgentTyping}
            className={`p-3 rounded-full transition-all ${
              message.trim() && !isAgentTyping
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        
        {isExpanded && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Enter - отправить • Shift+Enter - новая строка
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
