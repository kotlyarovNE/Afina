import React, { useState, useRef, useCallback } from 'react';
import { 
  X, 
  Upload, 
  File, 
  Trash2, 
  Link, 
  Check,
  AlertCircle
} from 'lucide-react';
import { Chat, ChatFile } from '../types/chat';
import localforage from 'localforage';

interface FileManagerProps {
  chats: Chat[];
  onClose: () => void;
  onUpdateChat: (chat: Chat) => Promise<void>;
}

const FileManager: React.FC<FileManagerProps> = ({
  chats,
  onClose,
  onUpdateChat,
}) => {
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загрузка всех файлов при монтировании
  React.useEffect(() => {
    loadAllFiles();
  }, [chats]);

  const loadAllFiles = async () => {
    const allFiles: ChatFile[] = [];
    for (const chat of chats) {
      allFiles.push(...chat.files);
    }
    
    // Удаляем дубликаты по ID
    const uniqueFiles = allFiles.filter((file, index, self) => 
      index === self.findIndex(f => f.id === file.id)
    );
    
    setFiles(uniqueFiles);
  };

  const handleFileUpload = async (uploadedFiles: FileList) => {
    if (uploadedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        
        // Создаем новый файл
        const newFile: ChatFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date(),
        };

        // Сохраняем файл в localforage
        await localforage.setItem(`file_${newFile.id}`, file);
        
        setFiles(prev => [...prev, newFile]);
        setUploadProgress(((i + 1) / uploadedFiles.length) * 100);
      }
    } catch (error) {
      console.error('Ошибка загрузки файлов:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    handleFileUpload(droppedFiles);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const deleteFile = async (fileId: string) => {
    try {
      // Удаляем файл из localforage
      await localforage.removeItem(`file_${fileId}`);
      
      // Удаляем файл из всех чатов
      for (const chat of chats) {
        const updatedFiles = chat.files.filter(f => f.id !== fileId);
        if (updatedFiles.length !== chat.files.length) {
          await onUpdateChat({
            ...chat,
            files: updatedFiles,
            updatedAt: new Date(),
          });
        }
      }
      
      // Обновляем локальный список
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Ошибка удаления файла:', error);
    }
  };

  const linkFileToChat = async (fileId: string, chatId: string) => {
    const file = files.find(f => f.id === fileId);
    const chat = chats.find(c => c.id === chatId);
    
    if (!file || !chat) return;

    // Проверяем, не привязан ли уже файл к этому чату
    const isAlreadyLinked = chat.files.some(f => f.id === fileId);
    
    if (isAlreadyLinked) {
      // Отвязываем файл
      const updatedFiles = chat.files.filter(f => f.id !== fileId);
      await onUpdateChat({
        ...chat,
        files: updatedFiles,
        updatedAt: new Date(),
      });
    } else {
      // Привязываем файл
      await onUpdateChat({
        ...chat,
        files: [...chat.files, file],
        updatedAt: new Date(),
      });
    }
  };

  const isFileLinkedToChat = (fileId: string, chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    return chat?.files.some(f => f.id === fileId) || false;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Управление файлами</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-100px)]">
          {/* File Upload Area */}
          <div className="w-1/3 p-6 border-r border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Загрузка файлов</h3>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-300 hover:border-primary-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Перетащите файлы сюда или
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                disabled={isUploading}
              >
                Выберите файлы
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
              />
            </div>

            {isUploading && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Загрузка...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="mt-6 text-sm text-gray-500">
              <p className="flex items-center mb-2">
                <AlertCircle className="w-4 h-4 mr-2" />
                Поддерживаемые форматы
              </p>
              <p>PDF, DOC, DOCX, TXT, MD</p>
              <p>Максимальный размер: 10MB</p>
            </div>
          </div>

          {/* File List */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              Загруженные файлы ({files.length})
            </h3>
            
            {files.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <File className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Нет загруженных файлов</p>
                <p className="text-sm">Загрузите файлы для работы с агентом</p>
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`p-4 border rounded-lg transition-all ${
                      selectedFile === file.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <File className="w-5 h-5 text-gray-500" />
                          <h4 className="font-medium text-gray-900 truncate">
                            {file.name}
                          </h4>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString('ru-RU')}
                        </p>
                        
                        {/* Chat Links */}
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium text-gray-700">
                            Привязан к чатам:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {chats.map((chat) => (
                              <button
                                key={chat.id}
                                onClick={() => linkFileToChat(file.id, chat.id)}
                                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                                  isFileLinkedToChat(file.id, chat.id)
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {isFileLinkedToChat(file.id, chat.id) && (
                                  <Check className="w-3 h-3 inline mr-1" />
                                )}
                                {chat.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => deleteFile(file.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors group"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;
