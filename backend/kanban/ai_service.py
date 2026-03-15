import vertexai
from vertexai.generative_models import GenerativeModel, FunctionDeclaration, Tool, Part
from django.shortcuts import get_object_or_404
from .models import Board, List, TaskCard

# Vertex AI is initialized lazily inside process_prompt()

# -------------------------------------------------------------
# Local Django Model Functions
# -------------------------------------------------------------
def create_board_list(board_id: int, name: str) -> str:
    board = get_object_or_404(Board, id=board_id)
    # Put order at end
    order = board.lists.count()
    new_list = List.objects.create(board=board, name=name, order=order)
    return f"Created list '{new_list.name}' with id {new_list.id} on board {board_id}."

def add_card(list_id: int, title: str) -> str:
    lst = get_object_or_404(List, id=list_id)
    order = lst.cards.count()
    new_card = TaskCard.objects.create(list=lst, title=title, order=order)
    return f"Added card '{new_card.title}' with id {new_card.id} to list {list_id}."

def set_card_color(card_id: int, color: str) -> str:
    card = get_object_or_404(TaskCard, id=card_id)
    card.color_boost = color
    card.save()
    return f"Set color of card {card_id} to {color}."

def apply_card_boost(card_id: int, custom_tailwind_css: str) -> str:
    card = get_object_or_404(TaskCard, id=card_id)
    card.color_boost = custom_tailwind_css
    card.save()
    return f"Applied custom CSS '{custom_tailwind_css}' to card {card_id}."

def add_card_comment(card_id: int, text: str) -> str:
    from .models import Comment
    card = get_object_or_404(TaskCard, id=card_id)
    comment = Comment.objects.create(card=card, text=text, is_ai=True)
    return f"Added AI comment to card {card_id}."

def create_checklist(card_id: int, items: list) -> str:
    from .models import Checklist, ChecklistItem
    card = get_object_or_404(TaskCard, id=card_id)
    checklist = Checklist.objects.create(card=card, title="AI Checklist")
    for item_text in items:
        if isinstance(item_text, str):
            ChecklistItem.objects.create(checklist=checklist, text=item_text)
    return f"Created checklist on card {card_id} with {len(items)} items."

def archive_card(card_id: int) -> str:
    card = get_object_or_404(TaskCard, id=card_id)
    card.is_archived = True
    card.save()
    return f"Archived card {card_id}."

def unarchive_card(card_id: int) -> str:
    card = get_object_or_404(TaskCard, id=card_id)
    card.is_archived = False
    card.save()
    return f"Unarchived card {card_id}."

def edit_card_details(card_id: int, title: str, description: str) -> str:
    card = get_object_or_404(TaskCard, id=card_id)
    if title: card.title = title
    if description: card.description = description
    card.save()
    return f"Edited card {card_id}."

def archive_list(list_id: int) -> str:
    lst = get_object_or_404(List, id=list_id)
    lst.is_archived = True
    lst.save()
    return f"Archived list {list_id}."

def set_list_color(list_id: int, color: str) -> str:
    lst = get_object_or_404(List, id=list_id)
    lst.color = color
    lst.save()
    return f"Set color of list {list_id} to {color}."

# -------------------------------------------------------------
# Vertex AI Function Declarations
# -------------------------------------------------------------
create_board_list_func = FunctionDeclaration(
    name="create_board_list",
    description="Creates a new list (column) on a Kanban board.",
    parameters={
        "type": "object",
        "properties": {
            "board_id": {"type": "integer", "description": "The ID of the board to add the list to."},
            "name": {"type": "string", "description": "The name of the new list."}
        },
        "required": ["board_id", "name"]
    }
)

add_card_func = FunctionDeclaration(
    name="add_card",
    description="Adds a new task card to a specific list.",
    parameters={
        "type": "object",
        "properties": {
            "list_id": {"type": "integer", "description": "The ID of the list to add the card to."},
            "title": {"type": "string", "description": "The title of the new card."}
        },
        "required": ["list_id", "title"]
    }
)

set_card_color_func = FunctionDeclaration(
    name="set_card_color",
    description="Sets the background color of a specific task card. Useful for highlighting or categorizing. DO NOT USE HEX CODES. Use one of these specific Tailwind values: 'bg-[#0c66e4]' (blue), 'bg-[#216e4e]' (green), 'bg-[#a54800]' (orange), 'bg-[#ae2e24]' (red), 'bg-[#5e4db2]' (purple), or gradients like 'bg-gradient-to-r from-blue-600 to-indigo-600', 'bg-gradient-to-r from-purple-600 to-pink-600', 'bg-gradient-to-r from-emerald-500 to-teal-500', 'bg-gradient-to-r from-orange-500 to-red-500'. To clear the color use ''",
    parameters={
        "type": "object",
        "properties": {
            "card_id": {"type": "integer", "description": "The ID of the task card to modify."},
            "color": {"type": "string", "description": "The EXACT Tailwind CSS class from the allowed list (e.g., 'bg-[#0c66e4]')."}
        },
        "required": ["card_id", "color"]
    }
)

apply_card_boost_func = FunctionDeclaration(
    name="apply_card_boost",
    description="Applies custom Tailwind CSS strings to a specific task card to visually boost it. (e.g., 'bg-[#0c66e4]' or 'bg-gradient-to-r from-blue-600 to-indigo-600'). Valid colors: 'bg-[#0c66e4]', 'bg-[#216e4e]', 'bg-[#a54800]', 'bg-[#ae2e24]', 'bg-[#5e4db2]'. Gradients: 'bg-gradient-to-r from-blue-600 to-indigo-600', etc.",
    parameters={
        "type": "object",
        "properties": {
            "card_id": {"type": "integer"},
            "custom_tailwind_css": {"type": "string"}
        },
        "required": ["card_id", "custom_tailwind_css"]
    }
)

add_card_comment_func = FunctionDeclaration(
    name="add_card_comment",
    description="Adds a comment to a card from the AI.",
    parameters={
        "type": "object",
        "properties": {
            "card_id": {"type": "integer"},
            "text": {"type": "string"}
        },
        "required": ["card_id", "text"]
    }
)

create_checklist_func = FunctionDeclaration(
    name="create_checklist",
    description="Creates a checklist on a card with a list of string items.",
    parameters={
        "type": "object",
        "properties": {
            "card_id": {"type": "integer"},
            "items": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["card_id", "items"]
    }
)

archive_card_func = FunctionDeclaration(
    name="archive_card",
    description="Archives a task card.",
    parameters={
        "type": "object",
        "properties": {"card_id": {"type": "integer"}},
        "required": ["card_id"]
    }
)

unarchive_card_func = FunctionDeclaration(
    name="unarchive_card",
    description="Unarchives a task card.",
    parameters={
        "type": "object",
        "properties": {"card_id": {"type": "integer"}},
        "required": ["card_id"]
    }
)

edit_card_details_func = FunctionDeclaration(
    name="edit_card_details",
    description="Edits a task card's title and description.",
    parameters={
        "type": "object",
        "properties": {
            "card_id": {"type": "integer"},
            "title": {"type": "string"},
            "description": {"type": "string"}
        },
        "required": ["card_id"]
    }
)

archive_list_func = FunctionDeclaration(
    name="archive_list",
    description="Archives a list (column) and hides it.",
    parameters={
        "type": "object",
        "properties": {"list_id": {"type": "integer"}},
        "required": ["list_id"]
    }
)

set_list_color_func = FunctionDeclaration(
    name="set_list_color",
    description="Sets the background color of a list.",
    parameters={
        "type": "object",
        "properties": {
            "list_id": {"type": "integer"},
            "color": {"type": "string", "description": "Hex color code"}
        },
        "required": ["list_id", "color"]
    }
)

# Aggregate into a Tool
agent_tools = Tool(function_declarations=[
    create_board_list_func, add_card_func, set_card_color_func,
    apply_card_boost_func, add_card_comment_func, create_checklist_func,
    archive_card_func, unarchive_card_func, edit_card_details_func,
    archive_list_func, set_list_color_func
])

# Model is initialized lazily inside process_prompt()

# -------------------------------------------------------------
# Main Agent Prompt Processor
# -------------------------------------------------------------
def process_prompt(prompt_text: str, board_id: int = None) -> str:
    # Lazy-initialize Vertex AI and model
    try:
        vertexai.init()
        model = GenerativeModel("gemini-2.5-flash", tools=[agent_tools])
    except Exception as e:
        return f"AI Service Initialization Error: {str(e)}"

    # Provide context: let it know this is a kanban board setting.
    if board_id:
        first_board = Board.objects.filter(id=board_id).first()
    else:
        first_board = Board.objects.first()
    default_board_id = first_board.id if first_board else 1

    # Also list out the available Lists and their Cards so it knows the IDs
    list_info = ""
    if first_board:
        lists_data = []
        for l in first_board.lists.prefetch_related('cards').all():
            cards_str = ", ".join([f"'{c.title}' (id: {c.id})" for c in l.cards.all()])
            lists_data.append(f"'{l.name}' (id: {l.id}) with cards [{cards_str}]")
        list_info = "; ".join(lists_data)

    context_prefix = (
        f"You are an AI assistant managing a Kanban board (Board ID is {default_board_id}). "
        f"Available lists and cards on this board: {list_info}. "
         "When asked to create a list, ALWAYS use this Board ID. "
         "When asked to add a card, use the ID of the list that best matches the user's request, or ask if unsure. "
         "You can call a function multiple times (for example, to set the color of multiple cards). "
        "User request: "
    )
    
    chat = model.start_chat()
    try:
        response = chat.send_message(context_prefix + prompt_text)
    except Exception as e:
        return f"AI Generation Error: {str(e)}"

    for _ in range(5): # Limit the number of turns to prevent infinite loops
        if not response.candidates:
            return "No response from AI."

        candidate = response.candidates[0]

        if candidate.function_calls:
            tool_responses = []
            for func_call in candidate.function_calls:
                try:
                    result_msg = ""
                    if func_call.name == "create_board_list":
                        args = func_call.args
                        result_msg = create_board_list(int(args["board_id"]), args["name"])
                    elif func_call.name == "add_card":
                        args = func_call.args
                        result_msg = add_card(int(args["list_id"]), args["title"])
                    elif func_call.name == "set_card_color":
                        args = func_call.args
                        result_msg = set_card_color(int(args["card_id"]), args["color"])
                    elif func_call.name == "apply_card_boost":
                        args = func_call.args
                        result_msg = apply_card_boost(int(args["card_id"]), args["custom_tailwind_css"])
                    elif func_call.name == "add_card_comment":
                        args = func_call.args
                        result_msg = add_card_comment(int(args["card_id"]), args["text"])
                    elif func_call.name == "create_checklist":
                        args = func_call.args
                        items = args.get("items", [])
                        if hasattr(items, "pb"): # Handle proto repeated composite
                            items = [i for i in items]
                        result_msg = create_checklist(int(args["card_id"]), items)
                    elif func_call.name == "archive_card":
                        args = func_call.args
                        result_msg = archive_card(int(args["card_id"]))
                    elif func_call.name == "unarchive_card":
                        args = func_call.args
                        result_msg = unarchive_card(int(args["card_id"]))
                    elif func_call.name == "edit_card_details":
                        args = func_call.args
                        result_msg = edit_card_details(int(args["card_id"]), args.get("title", ""), args.get("description", ""))
                    elif func_call.name == "archive_list":
                        args = func_call.args
                        result_msg = archive_list(int(args["list_id"]))
                    elif func_call.name == "set_list_color":
                        args = func_call.args
                        result_msg = set_list_color(int(args["list_id"]), args["color"])
                    else:
                        result_msg = f"Unknown function: {func_call.name}"
                        
                    tool_responses.append(Part.from_function_response(
                        name=func_call.name,
                        response={"result": result_msg}
                    ))
                except Exception as e:
                    tool_responses.append(Part.from_function_response(
                        name=func_call.name,
                        response={"result": f"Error: {str(e)}"}
                    ))
            
            try:
                response = chat.send_message(tool_responses)
            except Exception as e:
                return f"AI Tool Execution Error: {str(e)}"
        else:
            if candidate.content and candidate.content.parts:
                return candidate.content.parts[0].text
            return "Action completed successfully."
            
    return "Action completed, but AI reached iteration limit."
