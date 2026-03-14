import typer
import requests
import keyring
import json
import os
from pathlib import Path

app = typer.Typer(help="Mthds CLI Companion Tool")

API_BASE_URL = "http://localhost:8000/api"
SERVICE_NAME = "mthds-cli"

@app.command()
def login(token: str = typer.Argument(..., help="The API Token generated from your Mthds web profile")):
    """
    Authenticate the CLI using your API Token.
    """
    typer.echo("Validating token...")
    try:
        response = requests.post(f"{API_BASE_URL}/auth/cli-token/", json={"token": token})
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                username = data.get("username", "User")
                # Store token securely in OS keyring
                keyring.set_password(SERVICE_NAME, username, token)
                
                # Also save the active username so we know who is currently logged in
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
                
                typer.secho(f"Successfully authenticated as {username}!", fg=typer.colors.GREEN)
            else:
                typer.secho(f"Authentication failed: {data.get('message')}", fg=typer.colors.RED)
        else:
            typer.secho(f"Failed to communicate with Mthds server. HTTP Status: {response.status_code}", fg=typer.colors.RED)
    except requests.RequestException as e:
        typer.secho(f"Network error: {e}", fg=typer.colors.RED)

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

if __name__ == "__main__":
    app()
