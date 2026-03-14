import uuid
from django.db import models

class TimeStampedModel(models.Model):
    """Abstract base class that provides self-updating 'created_at' and 'updated_at' fields."""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class UUIDModel(models.Model):
    """Abstract base class that uses a UUID for the primary key instead of an auto-incremented integer."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class CoreModel(UUIDModel, TimeStampedModel):
    """Abstract base class combining standard UUIDs and timestamps for future models."""
    class Meta:
        abstract = True
