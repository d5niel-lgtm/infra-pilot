"""Health Check Modul für CLI

Dieses Modul bietet Funktionen zur Überprüfung der Systemgesundheit,
einschließlich API-Verbindungen, Datenbankzugriff und Speichernutzung.
"""

from ..client import ApiClient
from ..config import load_config


def get_health_status():
    """
    Führt einen vollständigen Health Check durch.
    
    Überprüft:
    - API-Konnektivität
    - Backend-Status
    - Dienstverfügbarkeit
    
    Returns:
        dict: Status mit Informationen zu verschiedenen Komponenten
    """
    try:
        config = load_config()
        client = ApiClient(
            config.get('api_url', 'http://localhost:8080'),
            config.get('token')
        )
        return client.health_check()
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Health check failed: {str(e)}',
            'component': 'api'
        }


def format_health_output(health_data):
    """
    Formatiert Health Check Daten für die Ausgabe.
    
    Args:
        health_data (dict): Rohe Health Check Daten vom Server
        
    Returns:
        dict: Formatierte Ausgabe
    """
    if 'error' in health_data:
        return {
            'status': 'UNHEALTHY',
            'error': health_data['error'],
            'timestamp': health_data.get('timestamp')
        }
    
    # Standard Health Check Struktur
    return {
        'status': health_data.get('status', 'UNKNOWN').upper(),
        'api': health_data.get('api', 'UNKNOWN'),
        'database': health_data.get('database', 'UNKNOWN'),
        'cache': health_data.get('cache', 'UNKNOWN'),
        'version': health_data.get('version'),
        'timestamp': health_data.get('timestamp'),
        'uptime': health_data.get('uptime')
    }
