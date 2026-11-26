import uuid

from django.conf import settings
from django.db import models


def resume_upload_path(instance, filename):
    return f"resumes/{instance.user_id}/{instance.id}/{filename}"


class Resume(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resumes")
    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to=resume_upload_path)
    file_size = models.PositiveIntegerField()
    extracted_text = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return self.original_name
