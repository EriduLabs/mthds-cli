import typer
import requests
import keyring
import json
import os
from pathlib import Path

from .engine import run_micro_sprints
from .ai_config import save_ai_token

app = typer.Typer(help="Mthds CLI Companion Tool")

API_BASE_URL = os.environ.get("MTHDS_API_URL", "http://localhost:8000/api")
SERVICE_NAME = "mthds-cli"

@app.command()
def login(token: str = typer.Argument(None, help="The API Token generated from your Mthds web profile")):
    """
    Authenticate the CLI using your API Token.
    """
    if not token:
        token = typer.prompt("Please enter your Mthds API Token", hide_input=True)

    typer.echo("Validating token...")
    try:
        response = requests.post(f"{API_BASE_URL}/auth/cli-token/", json={"token": token})
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                username = data.get("username", "User")
                keyring.set_password(SERVICE_NAME, username, token)
                
                config_dir = Path.home() / ".mthds"
                config_dir.mkdir(exist_ok=True)
                config_file = config_dir / "config.json"
                
                config = {}
                if config_file.exists():
                    try:
                        with open(config_file, "r") as f:
                            config = json.load(f)
                    except json.JSONDecodeError:
                        pass
                
                config["active_user"] = username
                
                with open(config_file, "w") as f:
                    json.dump(config, f)
                
                ai_key = typer.prompt("Please enter your AI API Key (e.g. OpenAI or Anthropic)", hide_input=True)
                if ai_key:
                    save_ai_token(ai_key)
                
                typer.secho(f"Successfully authenticated as {username}!", fg=typer.colors.GREEN)
            else:
                typer.secho(f"Authentication failed: {data.get('message')}", fg=typer.colors.RED)
        else:
            typer.secho(f"Failed to communicate with Mthds server. HTTP Status: {response.status_code}", fg=typer.colors.RED)
    except requests.RequestException as e:
        typer.secho(f"Network error: {e}", fg=typer.colors.RED)

@app.command()
def logout():
    """
    Remove the currently saved Mthds API Token and log out.
    """
    config_file = Path.home() / ".mthds" / "config.json"
    if config_file.exists():
        try:
            with open(config_file, "r") as f:
                config = json.load(f)
                username = config.get("active_user")
            
            if username:
                try:
                    keyring.delete_password(SERVICE_NAME, username)
                except keyring.errors.PasswordDeleteError:
                    pass # Key might already be gone
                
                config.pop("active_user", None)
                with open(config_file, "w") as f:
                    json.dump(config, f)
                    
                typer.secho(f"Successfully logged out user: {username}", fg=typer.colors.GREEN)
            else:
                typer.secho("No active user configuration found.", fg=typer.colors.YELLOW)
        except Exception as e:
            typer.secho(f"Error during logout: {e}", fg=typer.colors.RED)
    else:
        typer.secho("Not currently logged in.", fg=typer.colors.YELLOW)

@app.command()
def status():
    """
    View the currently active authenticated user for the CLI.
    """
    config_file = Path.home() / ".mthds" / "config.json"
    if config_file.exists():
        try:
            with open(config_file, "r") as f:
                config = json.load(f)
                username = config.get("active_user")
            
            if username:
                # verify token exists in keyring
                token = keyring.get_password(SERVICE_NAME, username)
                if token:
                    typer.secho(f"Currently logged in as: ", nl=False)
                    typer.secho(f"{username}", fg=typer.colors.GREEN, bold=True)
                else:
                    typer.secho(f"User '{username}' is set in config, but API Token is missing from secure storage. Please login again.", fg=typer.colors.YELLOW)
            else:
                typer.secho("Not currently logged in.", fg=typer.colors.YELLOW)
        except Exception as e:
            typer.secho(f"Error reading status: {e}", fg=typer.colors.RED)
    else:
        typer.secho("Not currently logged in.", fg=typer.colors.YELLOW)

@app.command()
def link():
    """
    Link the current directory as an Mthds-managed project by creating .vscode configs.
    """
    current_dir = Path.cwd()
    vscode_dir = current_dir / ".vscode"
    settings_file = vscode_dir / "settings.json"
    
    vscode_dir.mkdir(exist_ok=True)
    
    settings = {}
    if settings_file.exists():
        try:
            with open(settings_file, "r") as f:
                settings = json.load(f)
        except json.JSONDecodeError:
            pass
            
    # Add or update specific Mthds settings
    settings["mthds.isLinked"] = True
    settings["mthds.projectPath"] = str(current_dir)
    
    with open(settings_file, "w") as f:
        json.dump(settings, f, indent=4)
        
    typer.secho(f"Successfully linked current directory to Mthds!", fg=typer.colors.GREEN)
    typer.secho(f"Settings written to {settings_file}", fg=typer.colors.CYAN)

def get_mthds_token():
    config_file = Path.home() / ".mthds" / "config.json"
    if not config_file.exists():
        return None
    try:
        with open(config_file, "r") as f:
            config = json.load(f)
            username = config.get("active_user")
            if not username:
                return None
            return keyring.get_password(SERVICE_NAME, username)
    except Exception:
        return None

@app.command()
def run(board_id: int = typer.Argument(..., help="The ID of the Mthds board to run micro-sprints on")):
    """
    Start the Micro-Sprint Manager for a given board.
    Fetches the highest priority card, assigns it to the AI Persona, and automatically
    moves it to 'Done' upon completion, waiting for user validation before continuing.
    """
    token = get_mthds_token()
    if not token:
        typer.secho("Error: Not logged in. Please run 'mthds login <token>' first.", fg=typer.colors.RED)
        raise typer.Exit(1)
        
    run_micro_sprints(board_id=board_id, api_base_url=API_BASE_URL, mthds_token=token)


if __name__ == "__main__":
    app()
