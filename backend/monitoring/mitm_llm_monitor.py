#!/usr/bin/env python3
"""
Скрипт для мониторинга LLM API запросов через mitmproxy
Запуск: python backend/monitoring/mitm_llm_monitor.py
Веб-интерфейс: http://localhost:8081
"""

import json
import re
from datetime import datetime
from mitmproxy import http, ctx
from mitmproxy.tools.dump import DumpMaster
from mitmproxy.options import Options
from mitmproxy.tools.web.master import WebMaster


class LLMMonitor:
    def __init__(self):
        self.request_counter = 0
        self.llm_providers = {
            'openai': 'api.openai.com',
            'anthropic': 'api.anthropic.com',
            'google': 'generativelanguage.googleapis.com',
            'cohere': 'api.cohere.ai',
            'huggingface': 'api-inference.huggingface.co'
        }
        
    def is_llm_request(self, flow: http.HTTPFlow) -> tuple[bool, str]:
        """Проверяет, является ли запрос LLM API вызовом"""
        host = flow.request.pretty_host.lower()
        
        for provider, domain in self.llm_providers.items():
            if domain in host:
                return True, provider
        
        return False, ""
    
    def extract_request_data(self, flow: http.HTTPFlow) -> dict:
        """Извлекает данные из запроса"""
        try:
            request_data = {}
            
            # Базовая информация
            request_data['timestamp'] = datetime.now().isoformat()
            request_data['method'] = flow.request.method
            request_data['url'] = flow.request.pretty_url
            request_data['headers'] = dict(flow.request.headers)
            
            # Тело запроса (если JSON)
            if flow.request.content:
                try:
                    content = flow.request.content.decode('utf-8')
                    if flow.request.headers.get('content-type', '').startswith('application/json'):
                        request_data['body'] = json.loads(content)
                    else:
                        request_data['body'] = content
                except:
                    request_data['body'] = "<binary data>"
            
            return request_data
        except Exception as e:
            return {'error': f'Failed to parse request: {str(e)}'}
    
    def extract_response_data(self, flow: http.HTTPFlow) -> dict:
        """Извлекает данные из ответа"""
        try:
            response_data = {}
            
            # Базовая информация
            response_data['status_code'] = flow.response.status_code
            response_data['headers'] = dict(flow.response.headers)
            
            # Тело ответа
            if flow.response.content:
                try:
                    content = flow.response.content.decode('utf-8')
                    if flow.response.headers.get('content-type', '').startswith('application/json'):
                        response_data['body'] = json.loads(content)
                    else:
                        response_data['body'] = content
                except:
                    response_data['body'] = "<binary data>"
            
            return response_data
        except Exception as e:
            return {'error': f'Failed to parse response: {str(e)}'}
    
    def format_for_console(self, provider: str, request_data: dict, response_data: dict = None) -> str:
        """Форматирует данные для вывода в консоль"""
        self.request_counter += 1
        
        output = f"\n{'='*80}\n"
        output += f"🤖 LLM REQUEST #{self.request_counter} - {provider.upper()}\n"
        output += f"{'='*80}\n"
        output += f"📅 Time: {request_data.get('timestamp', 'unknown')}\n"
        output += f"🌐 URL: {request_data.get('url', 'unknown')}\n"
        output += f"📝 Method: {request_data.get('method', 'unknown')}\n"
        
        # Заголовки (только важные)
        important_headers = ['authorization', 'content-type', 'user-agent']
        headers = request_data.get('headers', {})
        filtered_headers = {k: v for k, v in headers.items() if k.lower() in important_headers}
        if filtered_headers:
            output += f"📋 Headers: {json.dumps(filtered_headers, indent=2)}\n"
        
        # Тело запроса
        body = request_data.get('body', {})
        if isinstance(body, dict):
            # Для OpenAI API показываем важные поля
            if 'messages' in body:
                output += f"💬 Messages ({len(body['messages'])}):\n"
                for i, msg in enumerate(body['messages'][-3:]):  # Последние 3 сообщения
                    role = msg.get('role', 'unknown')
                    content = msg.get('content', '')
                    content_preview = content[:200] + '...' if len(content) > 200 else content
                    output += f"   {i+1}. {role}: {content_preview}\n"
            
            if 'model' in body:
                output += f"🧠 Model: {body['model']}\n"
            if 'temperature' in body:
                output += f"🌡️  Temperature: {body['temperature']}\n"
            if 'max_tokens' in body:
                output += f"📏 Max tokens: {body['max_tokens']}\n"
        
        # Ответ (если есть)
        if response_data:
            output += f"\n{'─'*40} RESPONSE {'─'*40}\n"
            output += f"📊 Status: {response_data.get('status_code', 'unknown')}\n"
            
            resp_body = response_data.get('body', {})
            if isinstance(resp_body, dict):
                # Для OpenAI показываем ответ и токены
                if 'choices' in resp_body and resp_body['choices']:
                    choice = resp_body['choices'][0]
                    if 'message' in choice:
                        content = choice['message'].get('content', '')
                        content_preview = content[:300] + '...' if len(content) > 300 else content
                        output += f"💭 Response: {content_preview}\n"
                
                if 'usage' in resp_body:
                    usage = resp_body['usage']
                    output += f"🔢 Tokens: {usage.get('total_tokens', 0)} "
                    output += f"(prompt: {usage.get('prompt_tokens', 0)}, "
                    output += f"completion: {usage.get('completion_tokens', 0)})\n"
        
        output += f"{'='*80}\n"
        return output

    def request(self, flow: http.HTTPFlow) -> None:
        """Обработчик запросов"""
        is_llm, provider = self.is_llm_request(flow)
        
        if is_llm:
            request_data = self.extract_request_data(flow)
            
            # Сохраняем данные в flow для использования в response
            flow.llm_provider = provider
            flow.llm_request_data = request_data
            
            # Выводим запрос
            print(self.format_for_console(provider, request_data))

    def response(self, flow: http.HTTPFlow) -> None:
        """Обработчик ответов"""
        if hasattr(flow, 'llm_provider'):
            response_data = self.extract_response_data(flow)
            
            # Выводим полную информацию с ответом
            print(self.format_for_console(
                flow.llm_provider, 
                flow.llm_request_data, 
                response_data
            ))


def start_monitoring():
    """Запускает мониторинг с веб-интерфейсом"""
    print("🚀 Запуск LLM API мониторинга...")
    print("📱 Веб-интерфейс: http://localhost:8081")
    print("🔍 Фильтр: Только LLM API запросы (OpenAI, Anthropic, Google, Cohere, HuggingFace)")
    print("⚠️  Убедитесь, что ваш код использует HTTP_PROXY=http://localhost:8080")
    print("=" * 80)
    
    # Настройки mitmproxy
    opts = Options(
        listen_port=8080,        # Порт прокси
        web_port=8081,           # Порт веб-интерфейса
        web_open_browser=False,  # Не открывать браузер автоматически
        confdir="~/.mitmproxy",  # Директория конфигурации
    )
    
    # Создаем мастер с веб-интерфейсом
    master = WebMaster(opts)
    
    # Добавляем наш аддон
    monitor = LLMMonitor()
    master.addons.add(monitor)
    
    try:
        master.run()
    except KeyboardInterrupt:
        print("\n🛑 Мониторинг остановлен")


if __name__ == "__main__":
    start_monitoring()
