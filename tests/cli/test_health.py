"""Tests für das Health Check Modul"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from ipilot.commands.health import get_health_status, format_health_output
from ipilot.client import ApiClient


class TestHealthStatus:
    """Test Health Status Funktionen"""
    
    @patch('ipilot.commands.health.ApiClient')
    @patch('ipilot.commands.health.load_config')
    def test_get_health_status_success(self, mock_load_config, mock_api_client_class):
        """Test erfolgreiches Health Check"""
        # Setup
        mock_load_config.return_value = {
            'api_url': 'http://localhost:8080',
            'token': 'test-token'
        }
        
        mock_client = Mock(spec=ApiClient)
        mock_client.health_check.return_value = {
            'status': 'healthy',
            'api': 'up',
            'database': 'up',
            'cache': 'up',
            'version': '1.0.0',
            'uptime': '5d 12h'
        }
        mock_api_client_class.return_value = mock_client
        
        # Execute
        result = get_health_status()
        
        # Assert
        assert result['status'] == 'healthy'
        assert result['api'] == 'up'
        assert result['database'] == 'up'
        mock_client.health_check.assert_called_once()
    
    @patch('ipilot.commands.health.ApiClient')
    @patch('ipilot.commands.health.load_config')
    def test_get_health_status_error(self, mock_load_config, mock_api_client_class):
        """Test Health Check mit Fehler"""
        # Setup
        mock_load_config.return_value = {
            'api_url': 'http://localhost:8080',
            'token': None
        }
        
        mock_client = Mock(spec=ApiClient)
        mock_client.health_check.side_effect = Exception('Connection refused')
        mock_api_client_class.return_value = mock_client
        
        # Execute
        result = get_health_status()
        
        # Assert
        assert result['status'] == 'error'
        assert 'Connection refused' in result['message']
        assert result['component'] == 'api'
    
    @patch('ipilot.commands.health.load_config')
    def test_get_health_status_config_error(self, mock_load_config):
        """Test Health Check wenn Config laden fehlschlägt"""
        # Setup
        mock_load_config.side_effect = Exception('Config not found')
        
        # Execute
        result = get_health_status()
        
        # Assert
        assert result['status'] == 'error'
        assert 'Config not found' in result['message']


class TestHealthFormatting:
    """Test Health Output Formatierung"""
    
    def test_format_health_output_healthy(self):
        """Test Formatierung von gesundem Status"""
        health_data = {
            'status': 'healthy',
            'api': 'up',
            'database': 'up',
            'cache': 'up',
            'version': '1.0.0',
            'timestamp': '2024-01-15T10:30:00Z',
            'uptime': '5d 12h'
        }
        
        result = format_health_output(health_data)
        
        assert result['status'] == 'HEALTHY'
        assert result['api'] == 'up'
        assert result['database'] == 'up'
        assert result['cache'] == 'up'
        assert result['version'] == '1.0.0'
    
    def test_format_health_output_with_error(self):
        """Test Formatierung mit Fehler"""
        health_data = {
            'error': 'Database connection failed',
            'timestamp': '2024-01-15T10:30:00Z'
        }
        
        result = format_health_output(health_data)
        
        assert result['status'] == 'UNHEALTHY'
        assert result['error'] == 'Database connection failed'
    
    def test_format_health_output_partial_data(self):
        """Test Formatierung mit unvollständigen Daten"""
        health_data = {
            'status': 'degraded',
            'api': 'up'
        }
        
        result = format_health_output(health_data)
        
        assert result['status'] == 'DEGRADED'
        assert result['api'] == 'up'
        assert result['database'] == 'UNKNOWN'
        assert result['cache'] == 'UNKNOWN'