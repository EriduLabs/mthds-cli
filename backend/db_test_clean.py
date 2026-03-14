import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from kanban.models import APIToken
tokens = APIToken.objects.all()

for t in tokens:
    data = {
        "token": t.token,
        "active": t.is_active,
        "user": t.user.username
    }
    print(json.dumps(data, indent=2))
