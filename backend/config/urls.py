"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from kanban.api import api
from kanban import views as kanban_views
from django.views.generic import RedirectView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api.urls),
    
    # Auth URLs (login, logout, password change, etc.)
    path('accounts/', include('django.contrib.auth.urls')),
    
    # Kanban URLs
    path('register/', kanban_views.register, name='register'),
    path('dashboard/', kanban_views.dashboard, name='dashboard'),
    path('board/<int:board_id>/', kanban_views.board_detail, name='board_detail'),
    
    # Workspace URLs
    path('workspace/templates/', kanban_views.workspace_templates, name='workspace_templates'),
    path('workspace/home/', kanban_views.workspace_home, name='workspace_home'),
    path('workspace/members/', kanban_views.workspace_members, name='workspace_members'),
    path('workspace/settings/', kanban_views.workspace_settings, name='workspace_settings'),
    path('workspace/tokens/', kanban_views.workspace_tokens, name='workspace_tokens'),
    
    # Redirect root to dashboard
    path('', RedirectView.as_view(url='/dashboard/', permanent=False), name='index'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
