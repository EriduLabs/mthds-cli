# Mthds CLI

A Typer-based CLI tool to interact with the Mthds backend.

## Installation

```bash
pip install -e .
```

## Usage

## Usage

```bash
# Login using your API Token
mthds login <your-api-token>
# Or to be prompted securely for a token:
mthds login

# View your active user session
mthds status

# Logout and securely remove your token
mthds logout

# Initialize current directory as a Mthds project
mthds link
# Or if `mthds` is not in your PATH:
python -m mthds_cli.main link
```
