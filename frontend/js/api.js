const API_BASE_URL = "http://127.0.0.1:8000/api";

async function apiRequest(endpoint, options = {}) {
    const token = sessionStorage.getItem("authToken");

    const headers = {
        ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 204) {
        return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.detail ||
            data.error ||
            JSON.stringify(data) ||
            "Request failed"
        );
    }

    return data;
}

async function registerUser(username, email, password) {
    const data = await apiRequest("/accounts/register/", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
    });

    if (data.token) {
        sessionStorage.setItem("authToken", data.token);
    }

    return data;
}

async function loginUser(email, password) {
    const data = await apiRequest("/accounts/login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });

    if (data.token) {
        sessionStorage.setItem("authToken", data.token);
    }

    return data;
}

async function logoutUser() {
    try {
        await apiRequest("/accounts/logout/", {
            method: "POST",
        });
    } finally {
        sessionStorage.removeItem("authToken");
    }
}

async function uploadDocument(file, documentType) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);

    return apiRequest("/resumes/upload/", {
        method: "POST",
        body: formData,
    });
}