from django.urls import path

from .views import (
    ResumeDetailView,
    ResumeDownloadView,
    ResumeListCreateView,
    ResumeSearchView,
)

urlpatterns = [
    path("", ResumeListCreateView.as_view(), name="resume-list-create"),
    path("search/", ResumeSearchView.as_view(), name="resume-search"),
    path("<uuid:resume_id>/", ResumeDetailView.as_view(), name="resume-detail"),
    path("<uuid:resume_id>/download/", ResumeDownloadView.as_view(), name="resume-download"),
]