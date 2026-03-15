# Mthds CLI

A Typer-based CLI tool to interact directly with the Mthds backend, allowing developers to fetch context, manage tasks, and seamlessly integrate their local workflow with their Mthds boards.

## Installation

Ensure you have Python installed, then clone the repository and install it in editable mode:

```bash
pip install -e .
```

## Authentication

Authentication is handled securely via API Tokens generated from your Mthds web application workspace. 

1. Navigate to your Workspace Settings in the Mthds app.
2. Click **Generate New Token** and copy the resulting token.
3. Use the login command to authenticate the CLI locally.

## Usage

```bash
# Login using your API Token (prompts securely if omitted)
mthds login <your-api-token>

# View your active user session and connection status
mthds status

# Logout and securely remove your token from the local keyring
mthds logout

# Initialize the current directory as a Mthds project
mthds link
```

## Developer Notes

- The CLI uses `keyring` to securely store API tokens on your system.
- It interfaces directly with the Django REST Framework endpoints of the main Mthds application.
- All actions respect the standard permissions and authorizations defined by the Django backend.
