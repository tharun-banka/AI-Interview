import uuid

from django.conf import settings
from django.db import models


class Interview(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="interviews",
    )
    candidate_name = models.CharField(max_length=100)
    role_title = models.CharField(max_length=120)
    topic = models.CharField(max_length=200)
    focus = models.CharField(max_length=30)
    duration_minutes = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS,
    )
    questions = models.JSONField(default=list)
    sources = models.JSONField(default=list)
    answers = models.JSONField(default=list)
    report = models.JSONField(default=dict)
    elapsed_seconds = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.topic} interview for {self.role_title}"
