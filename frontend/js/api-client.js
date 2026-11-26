(() => {
	const apiBaseUrl = (window.SIGNAL_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
	const tokenKeys = ['signal.authToken', 'signal.rememberedAuthToken'];

	const getToken = () => tokenKeys
		.map((key) => sessionStorage.getItem(key) || localStorage.getItem(key))
		.find(Boolean) || null;

	const saveToken = (token, remember = false) => {
		tokenKeys.forEach((key) => {
			sessionStorage.removeItem(key);
			localStorage.removeItem(key);
		});
		(remember ? localStorage : sessionStorage).setItem(remember ? tokenKeys[1] : tokenKeys[0], token);
	};

	const clearToken = () => tokenKeys.forEach((key) => {
		sessionStorage.removeItem(key);
		localStorage.removeItem(key);
	});

	const request = async (path, options = {}) => {
		const headers = new Headers(options.headers || {});
		const token = getToken();
		if (token && options.auth !== false) headers.set('Authorization', `Token ${token}`);
		let body = options.body;
		if (body && !(body instanceof FormData) && typeof body !== 'string') {
			headers.set('Content-Type', 'application/json');
			body = JSON.stringify(body);
		}
		if (!headers.has('Accept')) headers.set('Accept', 'application/json');

		let response;
		try {
			response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers, body });
		} catch {
			throw new Error('Cannot reach the Django API. Start it with `python backend/manage.py runserver`.');
		}

		if (response.status === 204) return null;
		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			if (response.status === 401) clearToken();
			const message = Object.values(data).flatMap((value) => Array.isArray(value) ? value : [value])
				.find((value) => typeof value === 'string');
			throw new Error(message || `Request failed (${response.status}).`);
		}
		return data;
	};

	const download = async (path) => {
		const token = getToken();
		let response;
		try {
			response = await fetch(`${apiBaseUrl}${path}`, {
				headers: token ? { Authorization: `Token ${token}` } : {},
			});
		} catch {
			throw new Error('Cannot reach the Django API. Start the backend and try again.');
		}
		if (!response.ok) {
			if (response.status === 401) clearToken();
			throw new Error(response.status === 404 ? 'This resume is no longer available.' : 'Resume download failed.');
		}
		return response.blob();
	};

	window.SignalApi = Object.freeze({ apiBaseUrl, clearToken, download, getToken, request, saveToken });
})();