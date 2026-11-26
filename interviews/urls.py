from django.urls import path 
from .views import InterviewStatusView 

urlpatterns = [ 
    path("status/", InterviewStatusView.as_view(), name="interview-status"), 
]