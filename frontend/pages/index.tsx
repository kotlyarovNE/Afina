import React from 'react';
import { MessageCircle, Sparkles, Upload, Zap } from 'lucide-react';

const HomePage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center max-w-2xl px-6">
        {/* Logo and Title */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Добро пожаловать в 
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Afina</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Ваш интеллектуальный помощник для анализа документов и общения
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <MessageCircle className="w-8 h-8 text-blue-600 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Умные чаты</h3>
            <p className="text-gray-600 text-sm">
              Создавайте отдельные чаты для разных проектов и задач
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <Upload className="w-8 h-8 text-green-600 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Загрузка файлов</h3>
            <p className="text-gray-600 text-sm">
              Загружайте документы для анализа и обработки
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <Zap className="w-8 h-8 text-purple-600 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Быстрые ответы</h3>
            <p className="text-gray-600 text-sm">
              Получайте мгновенные ответы и анализ ваших документов
            </p>
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Начните работу</h2>
          <div className="space-y-4 text-left">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <p className="text-gray-700">
                <strong>Создайте новый чат</strong> - нажмите кнопку "Новый чат" в боковой панели
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <p className="text-gray-700">
                <strong>Загрузите файлы</strong> - используйте раздел "Управление файлами" для добавления документов
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <p className="text-gray-700">
                <strong>Начните общение</strong> - задавайте вопросы и получайте интеллектуальные ответы
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-sm text-gray-500">
          <p>Создано с ❤️ для эффективной работы с документами</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
