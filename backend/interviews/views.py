from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai_service import InterviewGenerationError, generate_questions, generate_report
from .models import Interview


class InterviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = (
            "id",
            "candidate_name",
            "role_title",
            "topic",
            "focus",
            "duration_minutes",
            "status",
            "questions",
            "sources",
            "answers",
            "report",
            "elapsed_seconds",
            "created_at",
            "completed_at",
        )
        read_only_fields = fields


class InterviewListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = ("id", "role_title", "topic", "status", "created_at", "completed_at")
        read_only_fields = fields


class InterviewPreparationSerializer(serializers.Serializer):
    candidate_name = serializers.CharField(max_length=100)
    role_title = serializers.CharField(max_length=120)
    topic = serializers.CharField(max_length=200)
    focus = serializers.ChoiceField(
        choices=("balanced", "behavioral", "technical", "collaboration")
    )
    duration_minutes = serializers.ChoiceField(choices=(30, 45, 60))

    def validate_candidate_name(self, value):
        return value.strip()

    def validate_role_title(self, value):
        return value.strip()

    def validate_topic(self, value):
        return value.strip()

    def validate(self, attrs):
        if not attrs["candidate_name"] or not attrs["role_title"] or not attrs["topic"]:
            raise serializers.ValidationError(
                "Name, target role, and interview topic are required."
            )
        return attrs


class InterviewCompletionSerializer(serializers.Serializer):
    answers = serializers.ListField(
        child=serializers.CharField(max_length=10000, allow_blank=True),
        min_length=1,
        max_length=5,
    )
    elapsed_seconds = serializers.IntegerField(min_value=0, max_value=86400)


class InterviewListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        interviews = Interview.objects.filter(user=request.user).only(
            "id",
            "role_title",
            "topic",
            "status",
            "created_at",
            "completed_at",
        )
        return Response(InterviewListSerializer(interviews, many=True).data)


class InterviewPrepareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = InterviewPreparationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        details = serializer.validated_data
        try:
            questions, sources = generate_questions(
                details["topic"],
                details["role_title"],
                details["focus"],
            )
        except InterviewGenerationError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        interview = Interview.objects.create(
            user=request.user,
            candidate_name=details["candidate_name"],
            role_title=details["role_title"],
            topic=details["topic"],
            focus=details["focus"],
            duration_minutes=details["duration_minutes"],
            questions=questions,
            sources=sources,
        )
        return Response(
            InterviewSerializer(interview).data,
            status=status.HTTP_201_CREATED,
        )


class InterviewDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, interview_id):
        interview = get_object_or_404(
            Interview,
            id=interview_id,
            user=request.user,
        )
        return Response(InterviewSerializer(interview).data)

    def delete(self, request, interview_id):
        interview = get_object_or_404(
            Interview,
            id=interview_id,
            user=request.user,
            status=Interview.Status.IN_PROGRESS,
        )
        interview.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InterviewCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, interview_id):
        interview = get_object_or_404(
            Interview,
            id=interview_id,
            user=request.user,
        )
        if interview.status == Interview.Status.COMPLETED:
            return Response(InterviewSerializer(interview).data)

        serializer = InterviewCompletionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        answers = serializer.validated_data["answers"]
        if len(answers) != len(interview.questions):
            raise serializers.ValidationError(
                {"answers": "Provide one answer or summary for each interview question."}
            )
        if not any(answer.strip() for answer in answers):
            raise serializers.ValidationError(
                {"answers": "Add at least one written answer before requesting feedback."}
            )

        interview.answers = answers
        interview.elapsed_seconds = serializer.validated_data["elapsed_seconds"]
        interview.save(update_fields=("answers", "elapsed_seconds"))
        try:
            interview.report = generate_report(interview, answers)
        except InterviewGenerationError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        interview.status = Interview.Status.COMPLETED
        interview.completed_at = timezone.now()
        interview.save(update_fields=("report", "status", "completed_at"))
        return Response(InterviewSerializer(interview).data)


class InterviewStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, _request):
        return Response({
            "status": "connected",
            "message": "Interview API is working.",
        })
