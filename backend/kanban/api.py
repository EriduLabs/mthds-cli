from ninja import NinjaAPI, Schema, File
from ninja.files import UploadedFile
from ninja.security import django_auth, APIKeyHeader
from typing import List as ListType, Dict, Any, Optional
from django.shortcuts import get_object_or_404
from django.db.models import Prefetch
from .models import Board, List, TaskCard, Checklist, ChecklistItem, Comment, Attachment, BoardLabel, ActivityLog
from pydantic import BaseModel
from datetime import datetime
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.utils import timezone
import os
from ninja.errors import HttpError
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .ai_service import process_prompt

def check_board_ownership(user, board):
    if board.owner != user:
        raise HttpError(403, "Forbidden: You do not own this board.")

# ---------------------------------------------------------------------------
# Reusable optimised querysets — centralise prefetch logic here so every
# endpoint that returns a Board/List/Card schema pays the same fixed cost
# regardless of the number of rows, eliminating N+1 query patterns.
# ---------------------------------------------------------------------------

def _card_qs():
    """TaskCard queryset with all relations needed by TaskCardSchema pre-fetched."""
    return (
        TaskCard.objects
        .select_related('list')
        .prefetch_related(
            'board_labels',
            'assignees',
            'checklists__items',
            'comments',
            'attachments',
            Prefetch('activity_logs', queryset=ActivityLog.objects.select_related('user')),
        )
    )


def _list_qs():
    """List queryset with all card sub-relations pre-fetched."""
    return List.objects.order_by('order').prefetch_related(
        Prefetch('cards', queryset=_card_qs().order_by('order')),
    )


def _board_qs():
    """Board queryset with all nested relations needed by BoardSchema pre-fetched."""
    return Board.objects.select_related('owner').prefetch_related(
        'labels',
        'boardmember_set__user',
        Prefetch('lists', queryset=_list_qs()),
    )
 
class CLIAPIKey(APIKeyHeader):
    param_name = "Authorization"
    
    def authenticate(self, request, key):
        from .models import APIToken
        if not key.startswith("Bearer "):
            return None
        token = key.replace("Bearer ", "").strip()
        print(f"CLIAPIKey extracted token: {token}")
        try:
            api_token = APIToken.objects.select_related('user').get(token=token, is_active=True)
            print(f"CLIAPIKey authenticated user: {api_token.user.username}")
            return api_token.user
        except APIToken.DoesNotExist:
            print(f"CLIAPIKey failed to find token.")
            return None

cli_bearer = CLIAPIKey()
api = NinjaAPI(auth=[cli_bearer, django_auth])

class ChecklistItemSchema(Schema):
    id: int
    text: str
    is_completed: bool

class ChecklistSchema(Schema):
    id: int
    title: str
    items: ListType[ChecklistItemSchema]

class CommentSchema(Schema):
    id: int
    text: str
    is_ai: bool
    created_at: datetime
    # author could be added if needed

class AttachmentSchema(Schema):
    id: int
    filename: str
    file_url: str

    @staticmethod
    def resolve_file_url(obj):
        return obj.file.url if obj.file else ""

class BoardLabelSchema(Schema):
    id: int
    name: str
    color: str

class UserSchema(Schema):
    id: int
    username: str

class ActivityLogSchema(Schema):
    id: int
    user: Optional[UserSchema]
    action_type: str
    description: str
    created_at: datetime

    @staticmethod
    def resolve_file_url(obj):
        return obj.file.url if obj.file else ""

class TaskCardSchema(Schema):
    id: int
    title: str
    description: str
    order: int
    color_boost: str
    metadata: Dict[str, Any]
    due_date: Optional[datetime] = None
    labels: ListType[str]
    board_labels: ListType[BoardLabelSchema]
    assignees: ListType[UserSchema]
    is_archived: bool
    list_id: int
    checklists: ListType[ChecklistSchema]
    comments: ListType[CommentSchema]
    attachments: ListType[AttachmentSchema]
    activity_logs: ListType[ActivityLogSchema]

class ListSchema(Schema):
    id: int
    name: str
    order: int
    color: str
    agent_state_mapping: Optional[str] = None
    is_archived: bool
    cards: ListType[TaskCardSchema]

class BoardSchema(Schema):
    id: int
    name: str
    is_archived: bool
    owner: UserSchema
    members: ListType[UserSchema]
    lists: ListType[ListSchema]
    labels: ListType[BoardLabelSchema]

    @staticmethod
    def resolve_members(obj):
        # We prefetch boardmember_set__user, so this is efficient
        return [bm.user for bm in obj.boardmember_set.all()]

class MoveTaskCardSchema(Schema):
    new_list_id: int
    new_order: int

class CreateTaskCardSchema(Schema):
    list_id: int
    title: str
    description: Optional[str] = ""
    color_boost: Optional[str] = ""
    metadata: Optional[Dict[str, Any]] = {}
    labels: Optional[ListType[str]] = []
    due_date: Optional[datetime] = None

class UpdateTaskCardSchema(Schema):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    labels: Optional[ListType[str]] = None
    color_boost: Optional[str] = None

class CreateListSchema(Schema):
    board_id: int
    name: str
    color: Optional[str] = ''
    agent_state_mapping: Optional[str] = None

class UpdateListSchema(Schema):
    name: Optional[str] = None
    color: Optional[str] = None
    agent_state_mapping: Optional[str] = None
    is_archived: Optional[bool] = None

class CreateChecklistSchema(Schema):
    title: str

class CreateChecklistItemSchema(Schema):
    text: str

class CreateCommentSchema(Schema):
    text: str

class CreateBoardSchema(Schema):
    name: str

class UpdateBoardSchema(Schema):
    name: Optional[str] = None
    is_archived: Optional[bool] = None

class CreateBoardLabelSchema(Schema):
    name: Optional[str] = ""
    color: str

class UpdateBoardLabelSchema(Schema):
    name: Optional[str] = None
    color: Optional[str] = None

class AgentPromptSchema(Schema):
    prompt: str
    board_id: Optional[int] = None

class CLIUpdateStateSchema(Schema):
    target_state: str

# API Endpoints
@api.get("/boards/", response=ListType[BoardSchema])
def list_boards(request):
    if not request.user.is_authenticated:
        return []
    # Use optimised queryset to avoid N+1 across lists → cards → relations
    return _board_qs().filter(owner=request.user)

STANDARD_LABELS = [
    {"name": "To-Do", "color": "#8590a2"},     # Default Neutral
    {"name": "In Review", "color": "#f5cd47"}, # Yellow
    {"name": "PBI", "color": "#579dff"},       # Blue
    {"name": "Completed", "color": "#4bce97"}, # Green
    {"name": "In Progress", "color": "#216e4e"}, # Dark Green
    {"name": "Done", "color": "#4bce97"},      # Green
    {"name": "User Story", "color": "#943d73"},# Pink
]

@api.post("/boards/", response=BoardSchema)
def create_board(request, payload: CreateBoardSchema):
    board = Board.objects.create(name=payload.name, owner=request.user)
    
    # Create standard labels for the new board
    for label_data in STANDARD_LABELS:
        BoardLabel.objects.create(
            board=board,
            color=label_data['color'],
            name=label_data['name']
        )

    # Re-fetch with prefetches so the response includes labels without N+1
    return get_object_or_404(_board_qs(), id=board.id)

@api.put("/boards/{board_id}/", response=BoardSchema)
def update_board(request, board_id: int, payload: UpdateBoardSchema):
    board = get_object_or_404(Board, id=board_id)
    check_board_ownership(request.user, board)
    
    if payload.name is not None:
        board.name = payload.name
    if payload.is_archived is not None:
        board.is_archived = payload.is_archived
    board.save()
    # Re-fetch with prefetches so the response schema doesn't trigger N+1
    return get_object_or_404(_board_qs(), id=board_id)

@api.delete("/boards/{board_id}/")
def delete_board(request, board_id: int):
    board = get_object_or_404(Board, id=board_id)
    check_board_ownership(request.user, board)
    board.delete()
    return {"success": True}

@api.get("/boards/{board_id}/", response=BoardSchema)
def get_board(request, board_id: int):
    # Use optimised queryset to avoid N+1 across lists → cards → relations
    return get_object_or_404(_board_qs(), id=board_id)

from django.contrib.auth.models import User
from .models import BoardMember
from pydantic import Field

class AddMemberSchema(Schema):
    username: str

@api.post("/boards/{board_id}/members/")
def add_board_member(request, board_id: int, payload: AddMemberSchema):
    board = get_object_or_404(Board, id=board_id)
    # Only allow owners to add members (simple ACL)
    if board.owner != request.user:
        return {"error": "Only the board owner can add members."}
        
    try:
        user_to_add = User.objects.get(username=payload.username)
        # Create or update member
        BoardMember.objects.get_or_create(user=user_to_add, board=board, defaults={'role': 'member'})
        return {"success": True, "message": f"Added {user_to_add.username} to board."}
    except User.DoesNotExist:
        return {"error": f"User {payload.username} does not exist."}

@api.get("/boards/{board_id}/active/", response=BoardSchema)
def get_active_board(request, board_id: int):
    # Filter out archived lists/cards while still pre-fetching all card relations
    active_cards_qs = (
        _card_qs()
        .filter(is_archived=False)
        .order_by('order')
    )
    active_lists_qs = (
        List.objects
        .filter(is_archived=False)
        .order_by('order')
        .prefetch_related(
            Prefetch('cards', queryset=active_cards_qs),
        )
    )
    board = get_object_or_404(
        Board.objects.prefetch_related(
            'labels',
            Prefetch('lists', queryset=active_lists_qs),
        ),
        id=board_id,
    )
    return board

from django.contrib.auth import logout as auth_logout
@api.post("/logout/")
def logout_endpoint(request):
    auth_logout(request)
    return {"success": True}

@api.get("/boards/{board_id}/archived/", response=Dict[str, Any])
def get_archived_items(request, board_id: int):
    board = get_object_or_404(Board, id=board_id)
    archived_lists = List.objects.filter(board=board, is_archived=True).values('id', 'name')
    archived_cards = TaskCard.objects.filter(list__board=board, is_archived=True).values('id', 'title', 'list__name')
    return {
        "lists": list(archived_lists),
        "cards": list(archived_cards)
    }

@api.post("/cards/", response=TaskCardSchema)
def create_taskcard(request, payload: CreateTaskCardSchema):
    list_obj = get_object_or_404(List, id=payload.list_id)
    check_board_ownership(request.user, list_obj.board)
    
    # Put at the end of the list
    order = list_obj.cards.count()
    card = TaskCard.objects.create(
        list=list_obj,
        title=payload.title,
        description=payload.description,
        order=order,
        color_boost=payload.color_boost,
        metadata=payload.metadata,
        labels=payload.labels or [],
        due_date=payload.due_date
    )
    ActivityLog.objects.create(card=card, user=request.user if request.user.is_authenticated else None, action_type='created', description=f"Created card")
    # Re-fetch with all prefetches so the response doesn't trigger N+1
    return get_object_or_404(_card_qs(), id=card.id)

@api.post("/lists/", response=ListSchema)
def create_list(request, payload: CreateListSchema):
    board = get_object_or_404(Board, id=payload.board_id)
    check_board_ownership(request.user, board)
    
    # Put at the end of the board
    order = board.lists.count()
    new_list = List.objects.create(
        board=board,
        name=payload.name,
        color=payload.color or '',
        agent_state_mapping=payload.agent_state_mapping,
        order=order
    )
    # Re-fetch with prefetches (empty list, but keeps response shape consistent)
    return get_object_or_404(_list_qs(), id=new_list.id)

@api.put("/cards/{card_id}/move/", response=TaskCardSchema)
def move_taskcard(request, card_id: int, payload: MoveTaskCardSchema):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    
    destination_list = get_object_or_404(List, id=payload.new_list_id)
    check_board_ownership(request.user, destination_list.board)
    
    source_list = card.list

    if source_list.id == destination_list.id:
        # Reorder within the same list
        cards = list(source_list.cards.exclude(id=card.id).order_by('order'))
        # Insert at the new index
        cards.insert(payload.new_order, card)
        # Update orders
        for idx, c in enumerate(cards):
            c.order = idx
            c.save()
    else:
        # Move to a new list
        # Remove from source list and update orders
        source_cards = list(source_list.cards.exclude(id=card.id).order_by('order'))
        for idx, c in enumerate(source_cards):
            c.order = idx
            c.save()

        # Insert into destination list and update orders
        destination_cards = list(destination_list.cards.all().order_by('order'))
        card.list = destination_list
        destination_cards.insert(payload.new_order, card)
        for idx, c in enumerate(destination_cards):
            c.order = idx
            c.save()
            
    # Log the move activity
    ActivityLog.objects.create(
        card=card,
        user=request.user if request.user.is_authenticated else None,
        action_type='moved',
        description=f"Moved to {destination_list.name}"
    )

    # Notify WebSocket clients
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"board_{destination_list.board.id}",
        {
            "type": "board_update",
            "action": "card_moved",
            "message": f"Card {card.id} moved."
        }
    )

    # Re-fetch with prefetches instead of refresh_from_db so response avoids N+1
    return get_object_or_404(_card_qs(), id=card.id)

@api.put("/cards/{card_id}/", response=TaskCardSchema)
def update_taskcard(request, card_id: int, payload: UpdateTaskCardSchema):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    
    if payload.title is not None:
        card.title = payload.title
    if payload.description is not None:
        card.description = payload.description
    if payload.due_date is not None:
        card.due_date = payload.due_date
    if payload.labels is not None:
        card.labels = payload.labels
    if payload.color_boost is not None:
        card.color_boost = payload.color_boost
    card.save()
    # Re-fetch with prefetches so the response doesn't trigger N+1
    return get_object_or_404(_card_qs(), id=card_id)

@api.put("/cards/{card_id}/archive/", response=TaskCardSchema)
def archive_taskcard(request, card_id: int):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    card.is_archived = not card.is_archived
    card.save()
    return get_object_or_404(_card_qs(), id=card_id)

@api.put("/lists/{list_id}/archive/", response=ListSchema)
def archive_list(request, list_id: int):
    lst = get_object_or_404(List, id=list_id)
    check_board_ownership(request.user, lst.board)
    lst.is_archived = not lst.is_archived
    lst.save()
    return get_object_or_404(_list_qs(), id=list_id)

@api.put("/lists/{list_id}/", response=ListSchema)
def update_list(request, list_id: int, payload: UpdateListSchema):
    lst = get_object_or_404(List, id=list_id)
    check_board_ownership(request.user, lst.board)
    
    update_data = payload.dict(exclude_unset=True)
    if 'name' in update_data:
        lst.name = update_data['name']
    if 'color' in update_data:
        lst.color = update_data['color']
    if 'agent_state_mapping' in update_data:
        lst.agent_state_mapping = update_data['agent_state_mapping']
    if 'is_archived' in update_data:
        lst.is_archived = update_data['is_archived']
    lst.save()
    return get_object_or_404(_list_qs(), id=list_id)

@api.post("/cards/{card_id}/checklists/", response=ChecklistSchema)
def create_checklist(request, card_id: int, payload: CreateChecklistSchema):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    checklist = Checklist.objects.create(card=card, title=payload.title)
    return checklist

@api.post("/checklists/{checklist_id}/items/", response=ChecklistItemSchema)
def create_checklist_item(request, checklist_id: int, payload: CreateChecklistItemSchema):
    checklist = get_object_or_404(Checklist, id=checklist_id)
    check_board_ownership(request.user, checklist.card.list.board)
    item = ChecklistItem.objects.create(checklist=checklist, text=payload.text)
    return item

@api.put("/items/{item_id}/toggle/", response=ChecklistItemSchema)
def toggle_checklist_item(request, item_id: int):
    item = get_object_or_404(ChecklistItem, id=item_id)
    check_board_ownership(request.user, item.checklist.card.list.board)
    item.is_completed = not item.is_completed
    item.save()
    return item

@api.post("/cards/{card_id}/comments/", response=CommentSchema)
def create_comment(request, card_id: int, payload: CreateCommentSchema):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    comment = Comment.objects.create(
        card=card,
        text=payload.text,
        author=request.user if request.user.is_authenticated else None
    )
    return comment

@api.post("/cards/{card_id}/attachments/", response=AttachmentSchema)
def upload_attachment(request, card_id: int, file: UploadedFile = File(...)):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    attachment = Attachment.objects.create(
        card=card,
        file=file,
        filename=file.name
    )
    return attachment

@api.delete("/attachments/{attachment_id}/")
def delete_attachment(request, attachment_id: int):
    attachment = get_object_or_404(Attachment, id=attachment_id)
    check_board_ownership(request.user, attachment.card.list.board)
    if attachment.file:
        attachment.file.delete(save=False)
    attachment.delete()
    return {"success": True}

@api.post("/agent/prompt/")
def agent_prompt_handler(request, payload: AgentPromptSchema):
    try:
        result_message = process_prompt(payload.prompt, board_id=payload.board_id)
        return {"message": result_message}
    except Exception as e:
        return {"message": f"Error processing request: {str(e)}"}

# --- New Endpoints for Board Labels ---
@api.post("/boards/{board_id}/labels/", response=BoardLabelSchema)
def create_board_label(request, board_id: int, payload: CreateBoardLabelSchema):
    board = get_object_or_404(Board, id=board_id)
    check_board_ownership(request.user, board)
    label, created = BoardLabel.objects.get_or_create(
        board=board, color=payload.color, 
        defaults={'name': payload.name}
    )
    if not created and payload.name:
        label.name = payload.name
        label.save()
    return label

@api.put("/labels/{label_id}/", response=BoardLabelSchema)
def update_board_label(request, label_id: int, payload: UpdateBoardLabelSchema):
    label = get_object_or_404(BoardLabel, id=label_id)
    check_board_ownership(request.user, label.board)
    if payload.name is not None:
        label.name = payload.name
    if payload.color is not None:
        label.color = payload.color
    label.save()
    return label

@api.delete("/labels/{label_id}/")
def delete_board_label(request, label_id: int):
    label = get_object_or_404(BoardLabel, id=label_id)
    check_board_ownership(request.user, label.board)
    label.delete()
    return {"success": True}

# --- New Endpoints for Card Assignments and Labels ---
@api.post("/cards/{card_id}/assignees/{user_id}/")
def assign_user_to_card(request, card_id: int, user_id: int):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    user = get_object_or_404(User, id=user_id)
    card.assignees.add(user)
    ActivityLog.objects.create(card=card, user=request.user if request.user.is_authenticated else None, action_type='assigned', description=f"Assigned {user.username}")
    return {"success": True}

@api.delete("/cards/{card_id}/assignees/{user_id}/")
def unassign_user_from_card(request, card_id: int, user_id: int):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    user = get_object_or_404(User, id=user_id)
    card.assignees.remove(user)
    ActivityLog.objects.create(card=card, user=request.user if request.user.is_authenticated else None, action_type='unassigned', description=f"Unassigned {user.username}")
    return {"success": True}

@api.post("/cards/{card_id}/labels/{label_id}/")
def add_label_to_card(request, card_id: int, label_id: int):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    label = get_object_or_404(BoardLabel, id=label_id)
    card.board_labels.add(label)
    return {"success": True}

@api.delete("/cards/{card_id}/labels/{label_id}/")
def remove_label_from_card(request, card_id: int, label_id: int):
    card = get_object_or_404(TaskCard, id=card_id)
    check_board_ownership(request.user, card.list.board)
    label = get_object_or_404(BoardLabel, id=label_id)
    card.board_labels.remove(label)
    return {"success": True}

# --- Endpoints for Board Members Search & Management ---
@api.post("/boards/{board_id}/members/")
def add_board_member(request, board_id: int, payload: dict):
    # payload: {"username": "..."}
    board = get_object_or_404(Board, id=board_id)
    check_board_ownership(request.user, board)
    
    username = payload.get("username")
    if not username:
        return api.create_response(request, {"error": "Username is required"}, status=400)
        
    try:
        user_to_add = User.objects.get(username=username)
    except User.DoesNotExist:
        return api.create_response(request, {"error": f"User '{username}' not found"}, status=404)
        
    if user_to_add == board.owner:
        return api.create_response(request, {"error": "User is already the board owner"}, status=400)
    
    # Check if they are already a member
    if board.boardmember_set.filter(user=user_to_add).exists():
        return api.create_response(request, {"error": f"User '{username}' is already a member"}, status=400)
        
    BoardMember.objects.create(board=board, user=user_to_add)
    return {"success": True, "message": f"Added {username} to the board"}

@api.get("/boards/{board_id}/search_members/", response=ListType[UserSchema])
def search_board_members(request, board_id: int):
    board = get_object_or_404(Board.objects.select_related('owner'), id=board_id)
    # select_related('user') prevents N+1 when accessing bm.user for each member
    members = [bm.user for bm in board.boardmember_set.select_related('user').all()]
    # add owner if not in members
    if board.owner not in members and board.owner is not None:
        members.append(board.owner)
    # Uniquify by ID to be safe
    unique_members = {m.id: m for m in members}.values()
    return list(unique_members)

@api.get("/boards/{board_id}/export/")
def export_board(request, board_id: int, include_archived: bool = False):
    board = get_object_or_404(Board, id=board_id)

    # Build card sub-queryset with all relations pre-fetched in one pass
    cards_qs = (
        TaskCard.objects
        .order_by('order')
        .prefetch_related(
            'checklists__items',
            Prefetch('comments', queryset=Comment.objects.select_related('author').order_by('created_at')),
            'attachments',
        )
    )
    if not include_archived:
        cards_qs = cards_qs.filter(is_archived=False)

    # Build list queryset — a single DB round-trip instead of N queries per list
    lists_qs = (
        List.objects
        .filter(board=board)
        .order_by('order')
        .prefetch_related(
            Prefetch('cards', queryset=cards_qs),
        )
    )
    if not include_archived:
        lists_qs = lists_qs.filter(is_archived=False)

    lists_data = []

    for lst in lists_qs:
        list_dict = {
            'name': lst.name,
            'color': lst.color,
            'is_archived': lst.is_archived,
            'cards_list': []
        }

        for card in lst.cards.all():  # Uses pre-fetched cache — no extra queries
            card_dict = {
                'title': card.title,
                'description': card.description,
                'is_archived': card.is_archived,
                'color_boost': card.color_boost,
                'due_date': card.due_date,
                'labels_list': card.labels,
                'checklists_list': [],
                'comments_list': [],
                'attachments_list': []
            }

            for cl in card.checklists.all():  # Pre-fetched cache
                card_dict['checklists_list'].append({
                    'title': cl.title,
                    'items_list': [
                        {'text': i.text, 'is_completed': i.is_completed}
                        for i in cl.items.all()  # Pre-fetched via checklists__items
                    ]
                })

            for comment in card.comments.all():  # Pre-fetched cache (ordered by created_at)
                card_dict['comments_list'].append({
                    'text': comment.text,
                    'is_ai': comment.is_ai,
                    'created_at': comment.created_at,
                    'author_name': comment.author.username if comment.author else 'Unknown'
                })

            for att in card.attachments.all():  # Pre-fetched cache
                ext = os.path.splitext(att.file.name)[1].lower()
                is_img = ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']
                card_dict['attachments_list'].append({
                    'filename': att.filename,
                    'file': att.file,
                    'is_image': is_img
                })

            list_dict['cards_list'].append(card_dict)

        lists_data.append(list_dict)

    context = {
        'board': board,
        'lists': lists_data,
        'export_date': timezone.now(),
        'request': request
    }

    html_string = render_to_string('kanban/report.html', context)

    response = HttpResponse(html_string, content_type='text/html')
    response['Content-Disposition'] = f'attachment; filename="board_report_{board.id}.html"'
    return response

# --- Endpoints for CLI Authentication ---
from .models import APIToken

class ValidateTokenSchema(Schema):
    token: str

class CLITokenResponseSchema(Schema):
    success: bool
    username: Optional[str] = None
    message: str

@api.post("/auth/cli-token/", response=CLITokenResponseSchema, auth=None)
def validate_cli_token(request, payload: ValidateTokenSchema):
    try:
        # Check if the token exists and is active
        api_token = APIToken.objects.select_related('user').get(token=payload.token, is_active=True)
        # Update last_used
        api_token.last_used = timezone.now()
        api_token.save(update_fields=['last_used'])
        return {"success": True, "username": api_token.user.username, "message": "Token validated successfully."}
    except APIToken.DoesNotExist:
        return api.create_response(request, {"success": False, "message": "Invalid or inactive token."}, status=401)

# --- CLI Specific Endpoints ---

@api.get("/boards/{board_id}/export-context/", response=Dict[str, Any], auth=[cli_bearer, django_auth])
def export_board_context(request, board_id: int):
    # Depending on auth method, request.auth might be the User (CLIAPIKey) or request.user
    user = request.auth if hasattr(request, 'auth') and request.auth else request.user
    
    board = get_object_or_404(Board, id=board_id)
    check_board_ownership(user, board)
    
    lists = List.objects.filter(board=board, is_archived=False).order_by('order').prefetch_related(
        Prefetch('cards', queryset=TaskCard.objects.filter(is_archived=False).order_by('order'))
    )
    
    result = {
        "board_id": board.id,
        "name": board.name,
        "lists": []
    }
    
    for lst in lists:
        list_data = {
            "id": lst.id,
            "name": lst.name,
            "agent_state_mapping": lst.agent_state_mapping,
            "cards": []
        }
        for card in lst.cards.all():
            list_data["cards"].append({
                "id": card.id,
                "title": card.title,
                "description": card.description,
                "labels": card.labels,
                "due_date": card.due_date.isoformat() if card.due_date else None
            })
        result["lists"].append(list_data)
        
    return result

@api.put("/cards/{card_id}/update-state/", response=TaskCardSchema, auth=[cli_bearer, django_auth])
def update_card_state_cli(request, card_id: int, payload: CLIUpdateStateSchema):
    user = request.auth if hasattr(request, 'auth') and request.auth else request.user
    
    card = get_object_or_404(TaskCard, id=card_id)
    board = card.list.board
    check_board_ownership(user, board)
    
    target_list = List.objects.filter(board=board, agent_state_mapping=payload.target_state, is_archived=False).first()
    if not target_list:
        return api.create_response(request, {"error": f"No list found with state mapping '{payload.target_state}'"}, status=400)
    
    new_order = target_list.cards.count()
    source_list = card.list
    
    if source_list.id != target_list.id:
        source_cards = list(source_list.cards.exclude(id=card.id).order_by('order'))
        for idx, c in enumerate(source_cards):
            c.order = idx
            c.save()
            
        card.list = target_list
        card.order = new_order
        card.save()

        ActivityLog.objects.create(
            card=card,
            user=request.user if request.user.is_authenticated else None,
            action_type='moved_cli',
            description=f"Moved to {target_list.name} via CLI"
        )

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"board_{board.id}",
            {
                "type": "board_update",
                "action": "card_moved",
                "message": f"Card {card.id} moved to mapped state '{payload.target_state}'."
            }
        )

    return get_object_or_404(_card_qs(), id=card.id)
