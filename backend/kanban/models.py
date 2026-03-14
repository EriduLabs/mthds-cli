from django.db import models
from django.contrib.auth.models import User
import secrets

class APIToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='api_tokens')
    token = models.CharField(max_length=128, unique=True, db_index=True)
    name = models.CharField(max_length=255, blank=True, help_text="A name to identify this token (e.g., 'MacBook Pro CLI')")
    created_at = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.name or 'Unnamed Token'}"
class Board(models.Model):
    owner = models.ForeignKey(User, related_name='owned_boards', on_delete=models.CASCADE, null=True, blank=True, db_index=True)
    name = models.CharField(max_length=255)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class BoardMember(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    board = models.ForeignKey(Board, on_delete=models.CASCADE)
    role = models.CharField(max_length=50, default='member')

    class Meta:
        unique_together = ('user', 'board')

    def __str__(self):
        return f"{self.user.username} - {self.board.name} ({self.role})"

class List(models.Model):
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='lists')
    name = models.CharField(max_length=255)
    order = models.IntegerField(default=0)
    color = models.CharField(max_length=255, blank=True, default='')
    is_archived = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name

class BoardLabel(models.Model):
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='labels')
    name = models.CharField(max_length=50, blank=True)
    color = models.CharField(max_length=50)
    
    def __str__(self):
        return f"{self.name} ({self.color})"

def default_labels():
    return []

class TaskCard(models.Model):
    list = models.ForeignKey(List, on_delete=models.CASCADE, related_name='cards')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    color_boost = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    
    # We will migrate from JSON array to ManyToMany, but keep JSON for now to prevent breaking existing data
    labels = models.JSONField(default=default_labels, blank=True)
    board_labels = models.ManyToManyField(BoardLabel, related_name='cards', blank=True)
    
    assignees = models.ManyToManyField(User, related_name='assigned_cards', blank=True)
    
    is_archived = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title

class ActivityLog(models.Model):
    card = models.ForeignKey(TaskCard, on_delete=models.CASCADE, related_name='activity_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action_type = models.CharField(max_length=50) # e.g., 'moved', 'created', 'assigned'
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.user.username if self.user else 'System'} {self.action_type} on {self.card.title}"

class Checklist(models.Model):
    card = models.ForeignKey(TaskCard, on_delete=models.CASCADE, related_name='checklists')
    title = models.CharField(max_length=255, default='Checklist')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.card.title} - {self.title}"

class ChecklistItem(models.Model):
    checklist = models.ForeignKey(Checklist, on_delete=models.CASCADE, related_name='items')
    text = models.CharField(max_length=255)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text

class Comment(models.Model):
    card = models.ForeignKey(TaskCard, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    text = models.TextField()
    is_ai = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Comment on {self.card.title}"

class Attachment(models.Model):
    card = models.ForeignKey(TaskCard, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='attachments/%Y/%m/%d/')
    filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.filename
