(() => {
	const accountsKey = 'signal.localAccounts.v1';
	const iterations = 600000;

	const encodeBase64 = (bytes) => {
		let binary = '';
		bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
		return btoa(binary);
	};

	const decodeBase64 = (value) => {
		const binary = atob(value);
		return Uint8Array.from(binary, (character) => character.charCodeAt(0));
	};

	const readAccounts = () => {
		const stored = localStorage.getItem(accountsKey);
		if (!stored) return [];
		const accounts = JSON.parse(stored);
		if (!Array.isArray(accounts)) throw new Error('Stored accounts data is invalid.');
		return accounts;
	};

	const deriveVerifier = async (password, salt) => {
		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(password),
			'PBKDF2',
			false,
			['deriveBits'],
		);
		const verifier = await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
			keyMaterial,
			256,
		);
		return new Uint8Array(verifier);
	};

	const createAccount = async ({ fullName, email, password }) => {
		if (!crypto?.subtle || !window.isSecureContext) {
			throw new Error('Secure browser storage is unavailable. Open this page on localhost or HTTPS.');
		}

		const normalizedEmail = email.trim().toLowerCase();
		const accounts = readAccounts();
		if (accounts.some((account) => account.email === normalizedEmail)) {
			throw new Error('An account with this email already exists in this browser.');
		}

		const salt = crypto.getRandomValues(new Uint8Array(16));
		const verifier = await deriveVerifier(password, salt);
		const nameParts = fullName.trim().split(/\s+/);
		const account = {
			id: crypto.randomUUID(),
			fullName: fullName.trim(),
			email: normalizedEmail,
			salt: encodeBase64(salt),
			verifier: encodeBase64(verifier),
			iterations,
			createdAt: new Date().toISOString(),
		};

		accounts.push(account);
		localStorage.setItem(accountsKey, JSON.stringify(accounts));
		return { id: account.id, fullName: account.fullName, email: account.email, firstName: nameParts[0] };
	};

	const findAccount = (email) => readAccounts().find((account) => account.email === email.trim().toLowerCase()) || null;

	const verifyPassword = async (account, password) => {
		if (!crypto?.subtle || !account?.salt || !account?.verifier) return false;
		const candidate = await deriveVerifier(password, decodeBase64(account.salt));
		const expected = decodeBase64(account.verifier);
		if (candidate.length !== expected.length) return false;
		let difference = 0;
		candidate.forEach((byte, index) => { difference |= byte ^ expected[index]; });
		return difference === 0;
	};

	const removeAccount = (email) => {
		const normalizedEmail = email.trim().toLowerCase();
		const accounts = readAccounts().filter((account) => account.email !== normalizedEmail);
		if (accounts.length) localStorage.setItem(accountsKey, JSON.stringify(accounts));
		else localStorage.removeItem(accountsKey);
	};

	window.SignalLocalAuth = Object.freeze({ createAccount, findAccount, removeAccount, verifyPassword });
})();