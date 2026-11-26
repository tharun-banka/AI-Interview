const loginForm = document.querySelector('#login-form');
const passwordField = document.querySelector('#password');
const passwordToggle = document.querySelector('.password-toggle');
const formMessage = document.querySelector('#form-message');
const submitButton = loginForm?.querySelector('button[type="submit"]');
const submitLabel = submitButton?.querySelector('.submit-label');

if (new URLSearchParams(window.location.search).has('registered')) {
	formMessage.textContent = 'Your database account is ready. Sign in to continue.';
	formMessage.classList.add('is-success');
}

passwordToggle?.addEventListener('click', () => {
	const shouldShow = passwordField.type === 'password';
	passwordField.type = shouldShow ? 'text' : 'password';
	passwordToggle.textContent = shouldShow ? 'Hide' : 'Show';
	passwordToggle.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
	passwordToggle.setAttribute('aria-pressed', String(shouldShow));
});

loginForm?.addEventListener('submit', async (event) => {
	event.preventDefault();
	formMessage.textContent = '';
	formMessage.classList.remove('is-success');
	if (!loginForm.reportValidity()) return;

	submitButton.disabled = true;
	if (submitLabel) submitLabel.textContent = 'Signing in…';
	try {
		const email = document.querySelector('#email').value.trim();
		const password = passwordField.value;
		const result = await window.SignalApi.request('/accounts/login/', {
			method: 'POST',
			auth: false,
			body: { email, password },
		});
		window.SignalApi.saveToken(result.token, document.querySelector('#remember').checked);
		window.location.href = 'dashboard.html';
	} catch (error) {
		try {
			const email = document.querySelector('#email').value.trim();
			const password = passwordField.value;
			const legacyAccount = window.SignalLocalAuth?.findAccount(email);
			if (!legacyAccount || !await window.SignalLocalAuth.verifyPassword(legacyAccount, password)) throw error;
			const migrated = await window.SignalApi.request('/accounts/register/', {
				method: 'POST',
				auth: false,
				body: { full_name: legacyAccount.fullName, email, password },
			});
			window.SignalApi.saveToken(migrated.token, document.querySelector('#remember').checked);
			window.SignalLocalAuth.removeAccount(email);
			window.location.href = 'dashboard.html';
		} catch (migrationError) {
			formMessage.textContent = migrationError.message || error.message || 'Unable to sign in. Check your details and try again.';
			submitButton.disabled = false;
			if (submitLabel) submitLabel.textContent = 'Sign in';
		}
	}
});

loginForm?.addEventListener('input', () => {
	if (formMessage.textContent) formMessage.textContent = '';
	formMessage.classList.remove('is-success');
});
