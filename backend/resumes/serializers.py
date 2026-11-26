from django.conf import settings
from rest_framework import serializers

from .models import Resume
from .text_extraction import extract_resume_text

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}


class ResumeSerializer(serializers.ModelSerializer):
    text_preview = serializers.SerializerMethodField()

    class Meta:
        model = Resume
        fields = ("id", "original_name", "file_size", "uploaded_at", "text_preview")
        read_only_fields = fields

    def get_text_preview(self, obj):
        text = (obj.extracted_text or "").strip()
        if not text:
            return ""
        limit = settings.RESUME_TEXT_PREVIEW_CHARS
        if len(text) <= limit:
            return text
        return f"{text[:limit].rstrip()}…"


class ResumeUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, uploaded):
        name = uploaded.name or ""
        extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if extension not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Upload a PDF, DOCX, or TXT resume.")
        if uploaded.size > settings.RESUME_MAX_BYTES:
            raise serializers.ValidationError("Resume files must be 10 MB or smaller.")
        return uploaded

    def create(self, validated_data):
        user = self.context["request"].user
        uploaded = validated_data["file"]
        extension = uploaded.name.rsplit(".", 1)[-1].lower()
        file_bytes = uploaded.read()
        try:
            extracted_text = extract_resume_text(file_bytes, extension)
        except ValueError as exc:
            raise serializers.ValidationError({"file": str(exc)}) from exc

        resume = Resume(
            user=user,
            original_name=uploaded.name,
            file_size=uploaded.size,
            extracted_text=extracted_text,
        )
        uploaded.seek(0)
        resume.file.save(uploaded.name, uploaded, save=False)
        resume.save()
        return resume
