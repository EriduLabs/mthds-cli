import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from kanban.models import APIToken
tokens = APIToken.objects.all()
for t in tokens:
    print(f'Token: {t.token}, Active: {t.is_active}, User: {t.user.username}')
