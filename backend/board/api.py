from ninja import NinjaAPI, Schema
from typing import List as ListType, Optional
from django.shortcuts import get_object_or_404
from .models import Board, List, Card
from pydantic import BaseModel

api = NinjaAPI()

# Schemas
class CardSchema(Schema):
    id: int
    title: str
    description: str
    order: int
    list_id: int

class ListSchema(Schema):
    id: int
    name: str
    order: int
    cards: ListType[CardSchema]

class BoardSchema(Schema):
    id: int
    name: str
    lists: ListType[ListSchema]

class MoveCardSchema(Schema):
    list_id: int
    index: int

# API Endpoints
@api.get("/boards/{board_id}", response=BoardSchema)
def get_board(request, board_id: int):
    # Prefetch lists→cards to avoid N+1 when the schema serializes nested relations
    board = get_object_or_404(
        Board.objects.prefetch_related('lists__cards'),
        id=board_id,
    )
    return board

@api.put("/cards/{card_id}/move", response=CardSchema)
def move_card(request, card_id: int, payload: MoveCardSchema):
    card = get_object_or_404(Card, id=card_id)
    destination_list = get_object_or_404(List, id=payload.list_id)
    source_list = card.list

    if source_list.id == destination_list.id:
        # Reorder within the same list
        cards = list(source_list.cards.exclude(id=card.id).order_by('order'))
        # Insert at the new index
        cards.insert(payload.index, card)
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
        destination_cards.insert(payload.index, card)
        for idx, c in enumerate(destination_cards):
            c.order = idx
            c.save()
            
    card.refresh_from_db()
    return card
