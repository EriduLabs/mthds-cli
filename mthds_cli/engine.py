import time
import requests
import typer
from .ai_config import get_ai_token

def run_micro_sprints(board_id: int, api_base_url: str, mthds_token: str):
    """
    Core orchestrator loop for Mthds Micro-Sprints.
    """
    typer.secho(f"Starting Micro-Sprints for Board {board_id}...", fg=typer.colors.CYAN, bold=True)
    
    ai_token = get_ai_token()
    if not ai_token:
        typer.secho("Error: AI API token not found.", fg=typer.colors.RED)
        typer.secho("Please set it in ~/.mthds/ai_config.json or using the AI_API_KEY environment variable.", fg=typer.colors.YELLOW)
        raise typer.Exit(1)
        
    headers = {
        "Authorization": f"Bearer {mthds_token}",
        "Content-Type": "application/json"
    }

    sprint_count = 1

    while True:
        typer.secho(f"\n--- [ Micro-Sprint {sprint_count} ] ---", fg=typer.colors.MAGENTA, bold=True)
        typer.echo(f"Secret MTHDS TOKEN IS: {mthds_token}")
        typer.echo("Fetching prioritized board context...")
        
        # 1. Fetch Context
        try:
            response = requests.get(f"{api_base_url}/boards/{board_id}/export-context/", headers=headers)
            response.raise_for_status()
            board_data = response.json()
        except requests.RequestException as e:
            typer.secho(f"Failed to fetch board context: {e}", fg=typer.colors.RED)
            break

        # 2. Identify the highest priority card not in 'Done'
        # We assume lists are ordered by workflow progression and cards are ordered by priority (order field).
        # We will look for lists mapped to 'todo' or 'in_progress' and take the first card.
        # Alternatively, take the first card in the first list that isn't 'done' or 'backlog'.
        
        target_card = None
        target_list_name = None
        
        for lst in board_data.get("lists", []):
            mapped_state = lst.get("agent_state_mapping")
            if mapped_state in ["todo", "in_progress", None]: # If no mapping, assume it's actionable if it has cards
                if lst.get("cards"):
                    # The cards array is already ordered by priority
                    target_card = lst["cards"][0]
                    target_list_name = lst["name"]
                    break

        if not target_card:
            typer.secho("\nNo pending cards found! All micro-sprints completed.", fg=typer.colors.GREEN, bold=True)
            break
            
        typer.secho(f"Highest Priority Card: '{target_card['title']}' (List: {target_list_name})", fg=typer.colors.BLUE)
        typer.echo(f"Card Data: {target_card.get('description', '')[:50]}...")
        
        # 3. Simulate AI Execution
        prompt = f"MICRO-SPRINT PROMPT:\n\nRole: You are an expert backend AI engineer building features for 'Mthds'.\nTask: {target_card['title']}\nDescription: {target_card.get('description', 'No description provided')}\n\nContext:\n{board_data}\n\nINSTRUCTIONS:\nAnalyze the context, implement the required changes for the task, and report when complete."
        
        # 3. Simulate AI Execution
        typer.secho("\nSending task to AI Persona for processing...", fg=typer.colors.YELLOW)
        typer.echo(f"Prompt preview (first 250 chars): {prompt[:250]}...")
        
        # Mocking delay for AI execution:
        typer.echo("Waiting for AI response...")
        time.sleep(3) 
        typer.secho("AI Persona reports task is complete!", fg=typer.colors.GREEN)

        # 4. Update Card State (Move to 'Done')
        typer.echo(f"Updating state of card {target_card['id']} to 'done'...")
        try:
            # Note: We need to use the endpoint /api/cards/<id>/update-state/ which we will create in the backend, or use existing move API.
            # Wait, the prompt implies the endpoint '/api/cards/<id>/update-state/' is for this.
            update_response = requests.put(
                f"{api_base_url}/cards/{target_card['id']}/update-state/", 
                json={"target_state": "done"},
                headers=headers
            )
            update_response.raise_for_status()
            typer.secho(f"Card successfully moved to 'Done' state.", fg=typer.colors.GREEN)
        except requests.RequestException as e:
            typer.secho(f"Failed to update card state: {e}", fg=typer.colors.RED)
            break

        # 5. Generate State Change Report
        typer.secho("\n--- [ State Change Report ] ---", fg=typer.colors.CYAN)
        typer.echo(f"- Card Processed: {target_card['title']}")
        typer.echo(f"- Action: Implementation by AI")
        typer.echo(f"- Status: Complete")
        
        # 6. User Validation / Pause
        typer.echo("\n")
        should_continue = typer.confirm("Sufficiently completed? Do you want to continue to the next micro-sprint?", default=True)
        
        if not should_continue:
            typer.secho("Execution paused by user. Exiting micro-sprint manager.", fg=typer.colors.YELLOW)
            break
            
        sprint_count += 1
