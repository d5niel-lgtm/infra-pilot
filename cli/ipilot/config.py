import json
import os

CONFIG_DIR = os.path.expanduser('~/.ipilot')
CONFIG_FILE = os.path.join(CONFIG_DIR, 'config.json')

DEFAULT_CONFIG = {
    'api_url': os.environ.get('IPILOT_API_URL', 'http://localhost:8080'),
    'api_key': None,
    'token': None,
    'output_format': 'table',
}


def ensure_config_dir():
    os.makedirs(CONFIG_DIR, exist_ok=True)


def load_config():
    ensure_config_dir()
    if not os.path.exists(CONFIG_FILE):
        return dict(DEFAULT_CONFIG)
    try:
        with open(CONFIG_FILE, 'r') as f:
            return {**DEFAULT_CONFIG, **json.load(f)}
    except (json.JSONDecodeError, IOError):
        return dict(DEFAULT_CONFIG)


def save_config(config):
    ensure_config_dir()
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)


def get(key):
    return load_config().get(key)


def set_key(key, value):
    config = load_config()
    config[key] = value
    save_config(config)


def unset_key(key):
    config = load_config()
    config.pop(key, None)
    save_config(config)
