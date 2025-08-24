#!/usr/bin/env python3
"""
Утилита для настройки прокси для мониторинга LLM запросов
"""

import os
import requests
from typing import Optional


class ProxyManager:
    def __init__(self, proxy_host: str = "localhost", proxy_port: int = 8080):
        self.proxy_url = f"http://{proxy_host}:{proxy_port}"
        self.original_env = {}
        
    def enable_proxy(self):
        """Включает проксирование для всех HTTP/HTTPS запросов"""
        print(f"🔗 Включение прокси: {self.proxy_url}")
        
        # Сохраняем оригинальные значения
        self.original_env = {
            'HTTP_PROXY': os.environ.get('HTTP_PROXY'),
            'HTTPS_PROXY': os.environ.get('HTTPS_PROXY'),
            'http_proxy': os.environ.get('http_proxy'),
            'https_proxy': os.environ.get('https_proxy'),
        }
        
        # Устанавливаем прокси
        os.environ['HTTP_PROXY'] = self.proxy_url
        os.environ['HTTPS_PROXY'] = self.proxy_url
        os.environ['http_proxy'] = self.proxy_url
        os.environ['https_proxy'] = self.proxy_url
        
        # Настройка для requests
        self.setup_requests_proxy()
        
        print("✅ Прокси включен")
        
    def disable_proxy(self):
        """Отключает проксирование"""
        print("🔗 Отключение прокси...")
        
        # Восстанавливаем оригинальные значения
        for key, value in self.original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
                
        print("✅ Прокси отключен")
    
    def setup_requests_proxy(self):
        """Настраивает прокси для библиотеки requests"""
        # Monkey patch для requests
        original_request = requests.Session.request
        
        def proxied_request(self, method, url, **kwargs):
            if 'proxies' not in kwargs:
                kwargs['proxies'] = {
                    'http': self.proxy_url,
                    'https': self.proxy_url
                }
            return original_request(self, method, url, **kwargs)
        
        requests.Session.request = proxied_request
    
    def test_proxy(self) -> bool:
        """Тестирует доступность прокси"""
        try:
            response = requests.get(
                "http://httpbin.org/ip", 
                proxies={'http': self.proxy_url, 'https': self.proxy_url},
                timeout=5
            )
            print(f"✅ Прокси работает. IP: {response.json().get('origin')}")
            return True
        except Exception as e:
            print(f"❌ Прокси недоступен: {e}")
            return False


# Глобальный экземпляр менеджера прокси
proxy_manager = ProxyManager()


def enable_llm_monitoring():
    """Включает мониторинг LLM запросов"""
    proxy_manager.enable_proxy()


def disable_llm_monitoring():
    """Отключает мониторинг LLM запросов"""
    proxy_manager.disable_proxy()


def test_monitoring_setup():
    """Тестирует настройку мониторинга"""
    return proxy_manager.test_proxy()


if __name__ == "__main__":
    print("🔧 Тестирование настройки прокси...")
    
    # Включаем прокси
    enable_llm_monitoring()
    
    # Тестируем
    if test_monitoring_setup():
        print("🎉 Настройка прокси успешна!")
    else:
        print("❌ Проблемы с настройкой прокси")
    
    # Отключаем прокси
    disable_llm_monitoring()
