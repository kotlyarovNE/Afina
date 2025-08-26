import React, { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Send, Files, X, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Message, Chat, ChatFile } from '../types/chat';
import { getChatData, getChatFiles, removeFileFromChat as removeFileFromChatStorage } from '../utils/storage';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollMessagesToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, []);

  // Загрузка данных чата
  useEffect(() => {
    loadChatData();
  }, [chat.id]);

  // Слушаем события обновления чата
  useEffect(() => {
    const handleChatUpdate = (event: CustomEvent) => {
      if (event.detail.chatId === chat.id) {
        loadChatData();
      }
    };

    const handleStreamUpdate = (event: CustomEvent) => {
      if (event.detail.chatId === chat.id) {
        const newContent = event.detail.content || '';

        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
          flushSync(() => {
            setMessages(prev => {
              if (prev.length === 0) return prev;

              const lastMessage = prev[prev.length - 1];
              if (lastMessage.sender === 'agent') {
                const updatedMessage = {
                  ...lastMessage,
                  content: newContent
                };
                return [...prev.slice(0, -1), updatedMessage];
              }
              return prev;
            });
          });
        }, 1);
      }
    };

    window.addEventListener('chatUpdated', handleChatUpdate as EventListener);
    window.addEventListener('chatStreamUpdate', handleStreamUpdate as EventListener);

    return () => {
      window.removeEventListener('chatUpdated', handleChatUpdate as EventListener);
      window.removeEventListener('chatStreamUpdate', handleStreamUpdate as EventListener);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [chat.id]);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isAtBottom) {
      setTimeout(() => {
        scrollMessagesToBottom();
      }, 50);
    }
  }, [messages.length, scrollMessagesToBottom]);

  // Резервная проверка завершения печати
  useEffect(() => {
    if (!isAgentTyping) return;

    const interval = setInterval(async () => {
      const chatData = await getChatData(chat.id);
      const files = await getChatFiles(chat.id);

      const lastMessage = chatData.messages[chatData.messages.length - 1];
      if (lastMessage && lastMessage.sender === 'agent') {
        const currentLastMessage = messages[messages.length - 1];

        if (!currentLastMessage || currentLastMessage.id !== lastMessage.id) {
          setMessages(chatData.messages);
          setChatFiles(files);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isAgentTyping, chat.id, messages]);

  // Автоматическое изменение размера textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 150;

      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
      } else {
        textareaRef.current.style.height = `${Math.max(scrollHeight, 44)}px`;
      }
    }
  }, [message]);

  // Финальная синхронизация при остановке агента
  useEffect(() => {
    if (!isAgentTyping) {
      setTimeout(() => {
        loadChatData();
      }, 100);
    }
  }, [isAgentTyping]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isAgentTyping) return;

    const trimmedMessage = message.trim();
    setMessage('');

    const userMessage: Message = {
      id: `${chat.id.replace('chat_', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: trimmedMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Принудительно скроллим вниз после отправки
    setTimeout(() => {
      scrollMessagesToBottom();
    }, 50);

    const fileNames = chatFiles.map(f => f.name);
    await onSendMessage(trimmedMessage, chat.id, fileNames);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const toggleFiles = () => {
    setShowFiles(!showFiles);
  };

  const handleRemoveFileFromChat = async (fileName: string) => {
    try {
      await removeFileFromChatStorage(chat.id, fileName);
      // Локально обновим список прикреплённых файлов без перезагрузки
      setChatFiles(prev => prev.filter(f => f.name !== fileName));
      window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId: chat.id } }));
    } catch (error) {
      console.error('Ошибка удаления файла из чата:', error);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900">{chat.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                AI-помощник для анализа документов
              </p>
            </div>
            
            {/* Files Toggle */}
            <div className="flex items-center space-x-3">
              {chatFiles.length > 0 && (
                <div className="flex items-center text-sm text-gray-600">
                  <Paperclip className="w-4 h-4 mr-1" />
                  <span>{chatFiles.length} файл(ов)</span>
                </div>
              )}
              
              <button
                onClick={toggleFiles}
                className={`flex items-center px-3 py-2 rounded-lg transition-all ${
                  showFiles 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Files className="w-4 h-4 mr-2" />
                Файлы
              </button>
            </div>
          </div>
        </div>

        {/* Files Panel */}
        {showFiles && (
          <div className="px-6 pb-4 border-t border-gray-100 bg-gray-50">
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Прикрепленные файлы
              </h3>
              {chatFiles.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Нет прикрепленных файлов
                </p>
              ) : (
                <div className="space-y-2">
                  {chatFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Paperclip className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {Math.round(file.size / 1024)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFileFromChat(file.name)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 flex flex-col min-h-0">
        <div 
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-none no-scrollbar px-6 py-4 space-y-6"
        >
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-xl font-bold">AI</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Привет! Я Afina
                </h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Ваш AI-помощник для анализа документов и качественных ответов на любые вопросы.
                </p>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>💬 Задавайте вопросы</p>
                  <p>📄 Загружайте документы</p>
                  <p>🧮 Работаю с LaTeX и кодом</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start items-start'} message-animation`}
                >
                  {/* Avatar for Agent */}
                  {msg.sender === 'agent' && (
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                      <span className="text-white text-xs font-semibold">AI</span>
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={`max-w-[80%] ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl px-4 py-3 shadow-lg'
                      : 'bg-white border border-gray-200 rounded-2xl shadow-sm'
                  }`}>
                    {msg.sender === 'agent' ? (
                      <div className="p-4">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          className="prose prose-sm max-w-none"
                          components={{
                            p: ({ children }) => (
                              <p className="mb-3 last:mb-0 text-gray-800 leading-relaxed">{children}</p>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-2xl font-bold mb-4 text-gray-900 border-b border-gray-200 pb-2">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-xl font-bold mb-3 text-gray-900">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-lg font-semibold mb-2 text-gray-900">{children}</h3>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-3 ml-4 space-y-1 list-disc list-outside text-gray-800">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-3 ml-4 space-y-1 list-decimal list-outside text-gray-800">{children}</ol>
                            ),
                            li: ({ children }) => (
                              <li className="leading-relaxed">{children}</li>
                            ),
                            code: ({ children, className }) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const language = match ? match[1] : '';
                              const isInline = !className;
                              
                              return isInline ? (
                                <code className="bg-gray-100 text-red-600 px-2 py-1 rounded-md text-sm font-mono border">
                                  {children}
                                </code>
                              ) : (
                                <div className="my-4 rounded-lg overflow-hidden border border-gray-200">
                                  <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-300">
                                      {language ? language.toUpperCase() : 'CODE'}
                                    </span>
                                    <button 
                                      onClick={async (event) => {
                                        try {
                                          await navigator.clipboard.writeText(String(children));
                                          const button = event.target as HTMLButtonElement;
                                          const originalText = button.textContent;
                                          button.textContent = 'Скопировано!';
                                          button.className = button.className.replace('text-gray-400', 'text-green-400');
                                          setTimeout(() => {
                                            button.textContent = originalText;
                                            button.className = button.className.replace('text-green-400', 'text-gray-400');
                                          }, 2000);
                                        } catch (err) {
                                          console.error('Ошибка копирования:', err);
                                        }
                                      }}
                                      className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded border border-gray-600 hover:border-gray-500 transition-colors"
                                    >
                                      Копировать
                                    </button>
                                  </div>
                                  <pre className="bg-gray-50 p-4 overflow-x-auto">
                                    <code className="text-sm font-mono text-gray-800 leading-relaxed">
                                      {children}
                                    </code>
                                  </pre>
                                </div>
                              );
                            },
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-3 bg-blue-50 text-gray-700 italic rounded-r-lg">
                                {children}
                              </blockquote>
                            ),
                            table: ({ children }) => (
                              <div className="my-4 overflow-x-auto">
                                <table className="min-w-full border border-gray-300 rounded-lg overflow-hidden">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-gray-50">{children}</thead>
                            ),
                            th: ({ children }) => (
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-300">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-4 py-3 text-sm text-gray-800 border-b border-gray-200">
                                {children}
                              </td>
                            ),
                            a: ({ children, href }) => (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                {children}
                              </a>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-gray-900">{children}</strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic text-gray-800">{children}</em>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    
                    {/* Timestamp */}
                    <div className={`text-xs ${
                      msg.sender === 'user' 
                        ? 'text-blue-100 mt-2' 
                        : 'text-gray-500 px-4 pb-2'
                    }`}>
                      {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Typing Indicator */}
              {isAgentTyping && (
                <div className="flex justify-start items-start message-animation">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3 mt-1 flex-shrink-0 animate-pulse">
                    <span className="text-white text-xs font-semibold">AI</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <div className="p-4 flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-gray-600 font-medium">Afina анализирует и печатает ответ...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="px-6 py-4">
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
                className={`w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none no-scrollbar focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isAgentTyping ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
                }`}
                rows={1}
              />
            </div>
            
            <button
              type="submit"
              disabled={!message.trim() || isAgentTyping}
              className={`p-3 rounded-full transition-all ${
                message.trim() && !isAgentTyping
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg transform hover:scale-105'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;