import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from kanban.models import Board, BoardLabel

STANDARD_LABELS = [
    {"name": "To-Do", "color": "#8590a2"},
    {"name": "In Review", "color": "#f5cd47"},
    {"name": "PBI", "color": "#579dff"},
    {"name": "Completed", "color": "#4bce97"},
    {"name": "In Progress", "color": "#216e4e"},
    {"name": "Done", "color": "#4bce97"},
    {"name": "User Story", "color": "#943d73"},
]

for board in Board.objects.all():
    # Remove unnamed labels
    BoardLabel.objects.filter(board=board, name="").delete()
    BoardLabel.objects.filter(board=board, name="Unnamed").delete()
    BoardLabel.objects.filter(board=board, name__isnull=True).delete()
    
    # Also delete existing default labels to recreate them with the correct names
    # (Just in case they got added before we expanded the list)
    # Actually, get_or_create by name will avoid duplicates
    for label_data in STANDARD_LABELS:
        label, created = BoardLabel.objects.get_or_create(
            board=board,
            name=label_data['name'],
            defaults={'color': label_data['color']}
        )
        if not created and label.color != label_data['color']:
            label.color = label_data['color']
            label.save()

print("Board labels synced.")
