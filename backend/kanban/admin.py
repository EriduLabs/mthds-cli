from django.contrib import admin
from .models import Board, List, TaskCard, BoardMember

@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'owner', 'created_at')
    search_fields = ('name', 'owner__username')

@admin.register(BoardMember)
class BoardMemberAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'board', 'role')
    list_filter = ('board', 'role')

@admin.register(List)
class ListAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'board', 'order')
    list_filter = ('board',)
    ordering = ('board', 'order')

@admin.register(TaskCard)
class TaskCardAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'list', 'order', 'color_boost')
    list_filter = ('list__board', 'list')
    search_fields = ('title', 'description')
    ordering = ('list', 'order')
