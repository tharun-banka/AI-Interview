const signupForm = document.querySelector('#signup-form');
const passwordInput = document.querySelector('#password');
const confirmPasswordInput = document.querySelector('#confirm-password');
const confirmHint = document.querySelector('#confirm-hint');
const submitButton = signupForm.querySelector('button[type="submit"]');
const submitLabel = signupForm.querySelector('.submit-label');
const formMessage = document.querySelector('#form-message');
const accountStatus = document.querySelector('#account-status');
const accountStatusText = document.querySelector('#account-status-text');
const signupBottom = document.querySelector('.signup-bottom');

document.querySelectorAll('.password-toggle').forEach((toggle) => {
	toggle.addEventListener('click', () => {
		const input = document.getElementById(toggle.getAttribute('aria-controls'));
		const shouldShow = input.type === 'password';
		input.type = shouldShow ? 'text' : 'password';
		toggle.textContent = shouldShow ? 'Hide' : 'Show';
		toggle.setAttribute('aria-label', `${shouldShow ? 'Hide' : 'Show'} ${input.id === 'password' ? 'password' : 'confirmation password'}`);
		toggle.setAttribute('aria-pressed', String(shouldShow));
	});
});

const validatePasswordMatch = () => {
	const passwordsEntered = confirmPasswordInput.value.length > 0;
	const passwordsMatch = passwordInput.value === confirmPasswordInput.value;
	confirmPasswordInput.setCustomValidity(passwordsEntered && !passwordsMatch ? 'Passwords do not match.' : '');
	confirmHint.textContent = passwordsEntered && !passwordsMatch ? 'Passwords do not match.' : '';
	confirmHint.classList.toggle('is-error', passwordsEntered && !passwordsMatch);
	return passwordsMatch;
};

passwordInput.addEventListener('input', () => {
	passwordInput.setCustomValidity('');
	validatePasswordMatch();
});
confirmPasswordInput.addEventListener('input', validatePasswordMatch);

signupForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	formMessage.textContent = '';
	validatePasswordMatch();
	if (!signupForm.reportValidity()) return;
	if (/^\d+$/.test(passwordInput.value) || /^(password|qwerty|letmein|welcome|12345678)$/i.test(passwordInput.value)) {
		passwordInput.setCustomValidity('Choose a password that is not common or entirely numeric.');
		passwordInput.reportValidity();
		return;
	}
	passwordInput.setCustomValidity('');

	submitButton.disabled = true;
	submitLabel.textContent = 'Creating account…';
	accountStatus.classList.remove('is-error', 'is-success');
	accountStatusText.textContent = 'Creating your database account securely…';

	try {
		const account = await window.SignalApi.request('/accounts/register/', {
			method: 'POST',
			auth: false,
			body: {
				full_name: document.querySelector('#full-name').value.trim(),
				email: document.querySelector('#email').value.trim(),
				password: passwordInput.value,
			},
		});
		window.SignalApi.saveToken(account.token);

		accountStatus.classList.add('is-success');
		accountStatusText.textContent = `Account created for ${account.user.email} and saved in the database.`;
		signupForm.classList.add('is-complete');
		signupBottom.classList.add('is-hidden');
		passwordInput.value = '';
		confirmPasswordInput.value = '';
		const signInLink = document.createElement('a');
		signInLink.className = 'submit-button success-link';
		signInLink.href = 'dashboard.html';
		signInLink.textContent = 'Open my workspace';
		accountStatus.insertAdjacentElement('afterend', signInLink);
	} catch (error) {
		accountStatus.classList.add('is-error');
		accountStatusText.textContent = 'The account could not be created.';
		formMessage.textContent = error.message || 'Check your details and try again.';
		submitButton.disabled = false;
		submitLabel.textContent = 'Create account';
	} finally {
		if (!signupForm.classList.contains('is-complete')) submitButton.disabled = false;
	}
});

signupForm.addEventListener('input', () => {
	formMessage.textContent = '';
	accountStatus.classList.remove('is-error');
	accountStatusText.textContent = 'Your account details will be stored in the application database.';
});
