import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kanban_project.settings')
django.setup()

from kanban.models import Board, BoardLabel

# User requested dropdown labels: 'To-Do', 'In Review', 'PBI', 'Completed'
NEW_LABELS = [
    {"name": "To-Do", "color": "#8590a2"},     # Default Neutral
    {"name": "In Review", "color": "#f5cd47"}, # Yellow
    {"name": "PBI", "color": "#579dff"},       # Blue
    {"name": "Completed", "color": "#4bce97"}, # Green
]

boards = Board.objects.all()
labels_created = 0

for board in boards:
    for label_data in NEW_LABELS:
        # Check if a label with this exact name already exists for this board
        label, created = BoardLabel.objects.get_or_create(
            board=board,
            name=label_data['name'],
            defaults={'color': label_data['color']}
        )
        if created:
            labels_created += 1

print(f"Migration complete. Created {labels_created} new standard text labels for {boards.count()} boards.")
