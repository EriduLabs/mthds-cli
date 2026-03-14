import os
import json
from pathlib import Path

def get_config_dir():
    config_dir = Path.home() / ".mthds"
    config_dir.mkdir(exist_ok=True)
    return config_dir

def get_ai_config_path():
    return get_config_dir() / "ai_config.json"

def get_ai_token():
    # First check env var
    token = os.environ.get("AI_API_KEY")
    if token:
        return token
        
    # Then check config file
    config_path = get_ai_config_path()
    if config_path.exists():
        try:
            with open(config_path, "r") as f:
                config = json.load(f)
                return config.get("api_key")
        except json.JSONDecodeError:
            pass
            
    return None

def save_ai_token(token: str):
    config_path = get_ai_config_path()
    config = {}
    if config_path.exists():
        try:
            with open(config_path, "r") as f:
                config = json.load(f)
        except json.JSONDecodeError:
            pass
            
    config["api_key"] = token
    with open(config_path, "w") as f:
        json.dump(config, f)
