"""
Модуль мониторинга LLM API запросов
"""

from .proxy_setup import enable_llm_monitoring, disable_llm_monitoring, test_monitoring_setup
from functools import wraps
import os


def monitor_llm_calls(func):
    """
    Декоратор для автоматического включения мониторинга LLM вызовов
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        monitoring_enabled = os.getenv('ENABLE_LLM_MONITORING', 'false').lower() == 'true'
        
        if monitoring_enabled:
            enable_llm_monitoring()
            try:
                result = func(*args, **kwargs)
            finally:
                disable_llm_monitoring()
        else:
            result = func(*args, **kwargs)
        
        return result
    
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        monitoring_enabled = os.getenv('ENABLE_LLM_MONITORING', 'false').lower() == 'true'
        
        if monitoring_enabled:
            enable_llm_monitoring()
            try:
                result = await func(*args, **kwargs)
            finally:
                disable_llm_monitoring()
        else:
            result = await func(*args, **kwargs)
        
        return result
    
    # Возвращаем правильную обертку в зависимости от типа функции
    import asyncio
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return wrapper


__all__ = [
    'monitor_llm_calls',
    'enable_llm_monitoring', 
    'disable_llm_monitoring',
    'test_monitoring_setup'
]
