import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from kanban.api import CLIBearer

rf = RequestFactory()
request = rf.get('/api/boards/9/', HTTP_AUTHORIZATION='Bearer hxN1AvF0ulvUEX4GiNHco')
bearer = CLIBearer()
user = bearer(request)
print(f'Test Result: {user}')
