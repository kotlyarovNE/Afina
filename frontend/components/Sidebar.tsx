import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { 
  MessageCircle, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Files,
  Upload,
  X
} from 'lucide-react';
import { Chat } from '../types/chat';
import FileManager from './FileManager';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  chats: Chat[];
  currentChatId: string | null;
  onCreateChat: (name: string) => Promise<Chat>;
  onDeleteChat: (chatId: string) => Promise<void>;
  onUpdateChat: (chat: Chat) => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  chats,
  currentChatId,
  onCreateChat,
  onDeleteChat,
  onUpdateChat,
}) => {
  const [showNewChatInput, setShowNewChatInput] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [showFileManager, setShowFileManager] = useState(false);
  const router = useRouter();

  const handleCreateChat = async () => {
    if (newChatName.trim()) {
      await onCreateChat(newChatName.trim());
      setNewChatName('');
      setShowNewChatInput(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateChat();
    } else if (e.key === 'Escape') {
      setShowNewChatInput(false);
      setNewChatName('');
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('ru-RU', { 
        weekday: 'short' 
      });
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed left-0 top-0 z-40">
        <button
          onClick={onToggle}
          className="m-4 p-2 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border border-gray-200"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="fixed left-0 top-0 w-80 h-full bg-white border-r border-gray-200 z-30 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-6 h-6 text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">Afina Chat</h1>
          </div>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* File Manager Section */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowFileManager(true)}
            className="w-full flex items-center space-x-3 p-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors group"
          >
            <Files className="w-5 h-5 text-primary-600 group-hover:text-primary-700" />
            <span className="font-medium text-primary-700 group-hover:text-primary-800">
              Управление файлами
            </span>
          </button>
        </div>

        {/* New Chat Section */}
        <div className="p-4 border-b border-gray-200">
          {showNewChatInput ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Название чата..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateChat}
                  className="flex-1 px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 transition-colors"
                >
                  Создать
                </button>
                <button
                  onClick={() => {
                    setShowNewChatInput(false);
                    setNewChatName('');
                  }}
                  className="flex-1 px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewChatInput(true)}
              className="w-full flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <Plus className="w-5 h-5 text-gray-600 group-hover:text-gray-700" />
              <span className="font-medium text-gray-700 group-hover:text-gray-800">
                Новый чат
              </span>
            </button>
          )}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {chats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Нет созданных чатов</p>
                <p className="text-sm">Создайте первый чат</p>
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                    currentChatId === chat.id
                      ? 'bg-primary-100 border border-primary-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  onClick={() => router.push(`/chat/${chat.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium truncate ${
                        currentChatId === chat.id ? 'text-primary-900' : 'text-gray-900'
                      }`}>
                        {chat.name}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {chat.messages.length > 0 
                          ? chat.messages[chat.messages.length - 1].content
                          : 'Новый чат'
                        }
                      </p>
                      <div className="flex items-center mt-1 space-x-2">
                        <span className="text-xs text-gray-400">
                          {formatDate(chat.updatedAt)}
                        </span>
                        {chat.files.length > 0 && (
                          <span className="text-xs text-primary-600 bg-primary-100 px-1 rounded">
                            {chat.files.length} файл(ов)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  {chat.isAgentTyping && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* File Manager Modal */}
      {showFileManager && (
        <FileManager
          chats={chats}
          onClose={() => setShowFileManager(false)}
          onUpdateChat={onUpdateChat}
        />
      )}
    </>
  );
};

export default Sidebar;
