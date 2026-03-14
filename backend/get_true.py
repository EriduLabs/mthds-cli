import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from kanban.models import APIToken
token_obj = APIToken.objects.first()
with open('c:\\Users\\Eridu\\OneDrive\\Desktop\\Mthds\\backend\\true_token.txt', 'w') as f:
    f.write(token_obj.token)
