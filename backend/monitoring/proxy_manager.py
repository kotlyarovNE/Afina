#!/usr/bin/env python3
"""
MIT Proxy Manager для мониторинга HTTP/HTTPS трафика
Поддерживает Linux и Windows
"""

import subprocess
import sys
import time
import signal
import os
import platform
from pathlib import Path
from typing import Optional, Dict, Any
import threading
import webbrowser


class ProxyStatus:
    def __init__(self):
        self.is_running = False
        self.pid = None
        self.web_port = 8081
        self.proxy_port = 8080
        self.web_url = f"http://localhost:{self.web_port}"
        self.proxy_url = f"http://localhost:{self.proxy_port}"


class MITMProxyManager:
    def __init__(self, web_port: int = 8081, proxy_port: int = 8080):
        self.web_port = web_port
        self.proxy_port = proxy_port
        self.process: Optional[subprocess.Popen] = None
        self.status = ProxyStatus()
        self.status.web_port = web_port
        self.status.proxy_port = proxy_port
        
    def _check_mitmproxy_installed(self) -> bool:
        """Проверяет, установлен ли mitmproxy"""
        try:
            result = subprocess.run(['mitmdump', '--version'], 
                                  capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
    
    def install_mitmproxy(self) -> bool:
        """Устанавливает mitmproxy через pip"""
        try:
            print("📦 Установка mitmproxy...")
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'mitmproxy'])
            print("✅ mitmproxy установлен успешно")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Ошибка установки mitmproxy: {e}")
            return False
    
    def start(self, open_browser: bool = True) -> bool:
        """Запускает MIT Proxy с web интерфейсом"""
        if self.is_running():
            print("⚠️ MIT Proxy уже запущен")
            return True
            
        # Проверяем установку
        if not self._check_mitmproxy_installed():
            print("🔧 mitmproxy не найден, устанавливаем...")
            if not self.install_mitmproxy():
                return False
        
        try:
            # Команда для запуска mitmweb (web интерфейс)
            cmd = [
                'mitmweb',
                '--web-port', str(self.web_port),
                '--listen-port', str(self.proxy_port),
                '--set', 'web_open_browser=false',  # Мы сами откроем браузер
                '--set', 'confdir=~/.mitmproxy'
            ]
            
            print(f"🚀 Запуск MIT Proxy...")
            print(f"📍 Web UI: http://localhost:{self.web_port}")
            print(f"📍 Proxy: http://localhost:{self.proxy_port}")
            
            # Запускаем в фоне
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Ждем запуска (проверяем несколько раз)
            for i in range(10):
                if self.process.poll() is not None:
                    # Процесс завершился с ошибкой
                    stdout, stderr = self.process.communicate()
                    print(f"❌ MIT Proxy завершился с ошибкой:")
                    print(f"STDOUT: {stdout}")
                    print(f"STDERR: {stderr}")
                    return False
                    
                time.sleep(1)
                print(f"⏳ Ожидание запуска... ({i+1}/10)")
            
            self.status.is_running = True
            self.status.pid = self.process.pid
            
            # Открываем браузер с задержкой
            if open_browser:
                threading.Timer(3.0, lambda: webbrowser.open(f"http://localhost:{self.web_port}")).start()
            
            print("✅ MIT Proxy запущен успешно")
            self._print_usage_instructions()
            
            return True
            
        except Exception as e:
            print(f"❌ Ошибка запуска MIT Proxy: {e}")
            return False
    
    def stop(self) -> bool:
        """Останавливает MIT Proxy"""
        if not self.is_running():
            print("⚠️ MIT Proxy не запущен")
            return True
            
        try:
            if self.process:
                # Мягкое завершение
                self.process.terminate()
                
                # Ждем завершения
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # Принудительное завершение
                    self.process.kill()
                    self.process.wait()
                
                self.process = None
            
            self.status.is_running = False
            self.status.pid = None
            
            print("✅ MIT Proxy остановлен")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка остановки MIT Proxy: {e}")
            return False
    
    def is_running(self) -> bool:
        """Проверяет, запущен ли прокси"""
        if not self.process:
            return False
        return self.process.poll() is None
    
    def get_status(self) -> ProxyStatus:
        """Возвращает текущий статус прокси"""
        self.status.is_running = self.is_running()
        if self.process:
            self.status.pid = self.process.pid
        return self.status
    
    def _print_usage_instructions(self):
        """Выводит инструкции по использованию"""
        print("\n" + "="*50)
        print("📋 КАК ИСПОЛЬЗОВАТЬ MIT PROXY")
        print("="*50)
        print(f"🌐 Web интерфейс: http://localhost:{self.web_port}")
        print(f"🔗 Прокси адрес: localhost:{self.proxy_port}")
        print()
        print("🔧 НАСТРОЙКА БРАУЗЕРА/ПРИЛОЖЕНИЯ:")
        print("1. Настройте HTTP/HTTPS прокси:")
        print(f"   - Host: localhost")
        print(f"   - Port: {self.proxy_port}")
        print()
        print("🔧 НАСТРОЙКА СИСТЕМНОГО ПРОКСИ:")
        
        system = platform.system()
        if system == "Darwin":  # macOS
            print("   macOS: System Preferences → Network → Advanced → Proxies")
        elif system == "Windows":
            print("   Windows: Settings → Network & Internet → Proxy")
        elif system == "Linux":
            print("   Linux: System Settings → Network → Network Proxy")
        
        print()
        print("🔧 ДЛЯ PYTHON REQUESTS:")
        print("   export HTTP_PROXY=http://localhost:8080")
        print("   export HTTPS_PROXY=http://localhost:8080")
        print()
        print("🔧 ДЛЯ CURL:")
        print(f"   curl --proxy localhost:{self.proxy_port} https://api.openai.com")
        print()
        print("📜 В web интерфейсе вы увидите все HTTP/HTTPS запросы")
        print("="*50)


# Singleton instance
_manager_instance = None

def get_manager() -> MITMProxyManager:
    """Возвращает singleton instance менеджера"""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = MITMProxyManager()
    return _manager_instance


if __name__ == "__main__":
    """Скрипт для прямого запуска из командной строки"""
    import argparse
    
    parser = argparse.ArgumentParser(description="MIT Proxy Manager")
    parser.add_argument('action', choices=['start', 'stop', 'status'], 
                       help='Действие для выполнения')
    parser.add_argument('--web-port', type=int, default=8081,
                       help='Порт для web интерфейса')
    parser.add_argument('--proxy-port', type=int, default=8080,
                       help='Порт для прокси')
    parser.add_argument('--no-browser', action='store_true',
                       help='Не открывать браузер автоматически')
    
    args = parser.parse_args()
    
    manager = MITMProxyManager(args.web_port, args.proxy_port)
    
    if args.action == 'start':
        success = manager.start(open_browser=not args.no_browser)
        if success:
            try:
                print("\n💡 Нажмите Ctrl+C для остановки...")
                while manager.is_running():
                    time.sleep(1)
            except KeyboardInterrupt:
                manager.stop()
        sys.exit(0 if success else 1)
        
    elif args.action == 'stop':
        success = manager.stop()
        sys.exit(0 if success else 1)
        
    elif args.action == 'status':
        status = manager.get_status()
        print(f"Status: {'Running' if status.is_running else 'Stopped'}")
        if status.is_running:
            print(f"PID: {status.pid}")
            print(f"Web UI: {status.web_url}")
            print(f"Proxy: {status.proxy_url}")