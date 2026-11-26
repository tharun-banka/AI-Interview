from django.contrib import admin

from .models import Resume


@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    list_display = ("original_name", "user", "file_size", "uploaded_at")
    search_fields = ("original_name", "extracted_text", "user__email")
    readonly_fields = ("uploaded_at",)
