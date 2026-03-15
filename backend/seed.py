import os
import django
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from kanban.models import Board, List, TaskCard

def seed():
    print("Clearing old data...")
    Board.objects.all().delete()
    
    print("Creating Board...")
    board = Board.objects.create(name="Project Alpha")

    print("Creating Lists...")
    todo_list = List.objects.create(name="To Do", board=board, order=0)
    in_progress_list = List.objects.create(name="In Progress", board=board, order=1)
    done_list = List.objects.create(name="Done", board=board, order=2)

    print("Creating Cards...")
    TaskCard.objects.create(
        title="Setup React App",
        description="Initialize Vite and setup Tailwind.",
        list=done_list,
        order=0,
        color_boost="#10b981", # Emerald
        metadata={"sprint": 1, "points": 3}
    )
    
    TaskCard.objects.create(
        title="Implement Drag and Drop",
        description="Use hello-pangea/dnd for Kanban board.",
        list=in_progress_list,
        order=0,
        color_boost="#f59e0b", # Amber
        metadata={"sprint": 1, "points": 5}
    )

    TaskCard.objects.create(
        title="Create Django API",
        description="Build Ninja endpoints and models.",
        list=in_progress_list,
        order=1,
        color_boost="#f59e0b", # Amber
        metadata={"sprint": 1, "points": 8}
    )

    TaskCard.objects.create(
        title="Write tests",
        description="Ensure we have 80% coverage on backend.",
        list=todo_list,
        order=0,
        color_boost="#ef4444", # Red
        metadata={"sprint": 2, "points": 5}
    )

    print("Database seeded successfully!")

if __name__ == "__main__":
    seed()
