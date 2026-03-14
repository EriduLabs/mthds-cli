import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kanban_project.settings')
django.setup()

from kanban.models import Board, BoardLabel

STANDARD_LABELS = [
    {"name": "", "color": "#4bce97"}, # Green
    {"name": "", "color": "#f5cd47"}, # Yellow
    {"name": "", "color": "#fea362"}, # Orange
    {"name": "", "color": "#f87168"}, # Red
    {"name": "", "color": "#9f8fef"}, # Purple
    {"name": "", "color": "#579dff"}, # Blue
    {"name": "", "color": "#6cc3e0"}, # Sky
    {"name": "", "color": "#94c748"}, # Lime
    {"name": "", "color": "#e774bb"}, # Pink
    {"name": "", "color": "#8590a2"}, # Black/Gray
]

# Get all boards
boards = Board.objects.all()

labels_created = 0
for board in boards:
    for label_data in STANDARD_LABELS:
        # Check if a label with this color already exists for this board
        label, created = BoardLabel.objects.get_or_create(
            board=board,
            color=label_data['color'],
            defaults={'name': label_data['name']}
        )
        if created:
            labels_created += 1

print(f"Migration complete. Created {labels_created} missing standard labels for {boards.count()} boards.")
