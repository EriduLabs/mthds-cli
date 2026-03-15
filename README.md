# Mthds Application

Mthds is a dynamic, real-time Kanban board application tailored for seamless team collaboration and automated task management.

## Key Features & Capabilities

- **Real-Time Kanban Boards:** Create, update, and manage boards, lists, and cards with instantaneous updates across all connected clients using WebSockets (Django Channels).
- **AI Agent Integration:** Built-in AI assistants that can automatically process natural language prompts to update card states, descriptions, change colors, and manage tasks autonomously based on list-specific mappings.
- **Team Collaboration:** Easily add members to shared workspaces and boards.
- **Robust Archiving:** Archive boards and cards instantly without page reloads, keeping active workspaces clean.
- **Developer CLI Intgeration:** Securely generate API tokens within the workspace settings to authenticate the `mthds-cli` tool.
- **Responsive Modern UI:** An intuitive, drag-and-drop interface built for productivity.

## Technology Stack

### Backend
- **Framework:** Django & Django REST Framework (DRF)
- **Real-time:** Django Channels & Redis (for WebSockets)
- **Database:** SQLite (Development) / Relational DBs

### Frontend
- **Framework:** React / Vite
- **Styling:** CSS / Modern UI components

### Auxiliary Tools
- **Mthds CLI:** A Typer-based Python CLI for developer workflows.

---

For instructions on integrating with the Mthds CLI, please see the `mthds-cli` repository or navigate to your workspace settings to generate an API Token.
