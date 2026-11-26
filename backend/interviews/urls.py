from django.urls import path

from .views import (
    InterviewCompleteView,
    InterviewDetailView,
    InterviewListView,
    InterviewPrepareView,
    InterviewStatusView,
)

urlpatterns = [
    path("", InterviewListView.as_view(), name="interview-list"),
    path("status/", InterviewStatusView.as_view(), name="interview-status"),
    path("prepare/", InterviewPrepareView.as_view(), name="interview-prepare"),
    path("<uuid:interview_id>/", InterviewDetailView.as_view(), name="interview-detail"),
    path(
        "<uuid:interview_id>/complete/",
        InterviewCompleteView.as_view(),
        name="interview-complete",
    ),
]
