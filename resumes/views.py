from django.http import FileResponse, Http404
from django.db.models import Q

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Resume
from .serializers import ResumeSerializer, ResumeUploadSerializer


class ResumeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Resume.objects.all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ResumeUploadSerializer
        return ResumeSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resume = serializer.save()
        response_serializer = ResumeSerializer(
            resume,
            context=self.get_serializer_context(),
        )
        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def get_queryset(self):
        # Users can access only their own resumes.
        return Resume.objects.filter(user=self.request.user)


class ResumeSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()

        resumes = Resume.objects.filter(user=request.user)

        if query:
            resumes = resumes.filter(
                Q(original_name__icontains=query)
                | Q(extracted_text__icontains=query)
            )

        return Response(ResumeSerializer(resumes, many=True).data)


class ResumeDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Resume.objects.all()
    lookup_field = "id"
    lookup_url_kwarg = "resume_id"

    def get_queryset(self):
        return Resume.objects.filter(user=self.request.user)


class ResumeDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, resume_id):
        try:
            resume = Resume.objects.get(
                id=resume_id,
                user=request.user,
            )
        except Resume.DoesNotExist:
            raise Http404("Resume not found.")

        if not resume.file:
            raise Http404("No file is attached to this resume.")

        try:
            resume.file.open("rb")
            return FileResponse(
                resume.file,
                as_attachment=True,
                filename=resume.file.name.split("/")[-1],
            )
        except (OSError, ValueError):
            raise Http404("Resume file could not be opened.")
        