from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import Board

def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('dashboard')
    else:
        form = UserCreationForm()
    return render(request, 'registration/register.html', {'form': form})

@login_required
@ensure_csrf_cookie
def dashboard(request):
    owned_boards = request.user.owned_boards.filter(is_archived=False)
    member_boards = Board.objects.filter(boardmember__user=request.user, is_archived=False)
    
    # Combine or just pass together.
    # The template 'kanban/dashboard.html' natively expects 'boards'. 
    all_boards = (owned_boards | member_boards).distinct()
    
    return render(request, 'kanban/dashboard.html', {'boards': all_boards})

@login_required
@ensure_csrf_cookie
def board_detail(request, board_id):
    board = get_object_or_404(Board, id=board_id)
    # Basic permission check: in a real app, verify if user is owner or member
    return render(request, 'kanban/board_detail.html', {'board': board})

@login_required
def workspace_templates(request):
    return render(request, 'kanban/workspace_templates.html')

@login_required
def workspace_home(request):
    return render(request, 'kanban/workspace_home.html')

@login_required
def workspace_members(request):
    return render(request, 'kanban/workspace_members.html')

@login_required
def workspace_settings(request):
    return render(request, 'kanban/workspace_settings.html')
