const sidebar = document.querySelector('#sidebar');
const menuToggle = document.querySelector('.mobile-menu-toggle');
const sidebarScrim = document.querySelector('.sidebar-scrim');
const navLinks = [...document.querySelectorAll('.nav-link')];
const interviewTableBody = document.querySelector('.activity-table tbody');
const navSections = navLinks
	.map((link) => document.querySelector(link.getAttribute('href')))
	.filter(Boolean);
const todayLabel = document.querySelector('#today-label');
const resumeList = document.querySelector('#resume-list');
const resumeMessage = document.querySelector('#resume-message');
const resumeUploadForm = document.querySelector('#resume-upload-form');
const resumeSearchForm = document.querySelector('#resume-search-form');
const resumeFileInput = document.querySelector('#resume-file');
const uploadButton = resumeUploadForm?.querySelector('button[type="submit"]');

if (!window.SignalApi?.getToken()) {
	window.location.replace('login.html');
}

if (todayLabel) {
	todayLabel.dateTime = new Date().toISOString().slice(0, 10);
	todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(new Date());
}

const setSidebarOpen = (isOpen) => {
	sidebar?.classList.toggle('is-open', isOpen);
	sidebarScrim?.classList.toggle('is-visible', isOpen);
	menuToggle?.setAttribute('aria-expanded', String(isOpen));
	menuToggle?.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
};

menuToggle?.addEventListener('click', () => {
	setSidebarOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
});

sidebarScrim?.addEventListener('click', () => setSidebarOpen(false));

sidebar?.addEventListener('click', (event) => {
	if (event.target.closest('a')) setSidebarOpen(false);
});

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape') setSidebarOpen(false);
});

const setActiveSection = (section) => {
	navLinks.forEach((link) => {
		const isActive = link.hash === `#${section.id}`;
		link.classList.toggle('is-active', isActive);
		if (isActive) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
	});
};

const updateActiveSection = () => {
	if (!navSections.length) return;
	const hashSection = navSections.find((section) => `#${section.id}` === window.location.hash);
	if (hashSection) {
		const bounds = hashSection.getBoundingClientRect();
		if (bounds.top < window.innerHeight && bounds.bottom > 0) {
			setActiveSection(hashSection);
			return;
		}
	}

	const isAtPageBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
	if (isAtPageBottom) {
		setActiveSection(navSections[navSections.length - 1]);
		return;
	}

	const marker = window.scrollY + 100;
	const currentSection = navSections.reduce((current, section) => {
		return section.getBoundingClientRect().top + window.scrollY <= marker ? section : current;
	}, navSections[0]);
	setActiveSection(currentSection);
};

window.addEventListener('scroll', updateActiveSection, { passive: true });
window.addEventListener('resize', updateActiveSection);
window.addEventListener('hashchange', updateActiveSection);
updateActiveSection();

const formatFileSize = (bytes) => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const showResumeMessage = (message, isError = false) => {
	resumeMessage.textContent = message;
	resumeMessage.classList.toggle('is-error', isError);
};

const renderResumes = (resumes) => {
	resumeList.replaceChildren();
	if (!resumes.length) {
		const empty = document.createElement('p');
		empty.className = 'resume-empty';
		empty.textContent = 'No resumes found. Upload a PDF, DOCX, or TXT resume to begin.';
		resumeList.append(empty);
		return;
	}

	resumes.forEach((resume) => {
		const card = document.createElement('article');
		card.className = 'resume-card';
		const extension = resume.original_name.split('.').pop().slice(0, 4);
		const icon = document.createElement('span');
		icon.className = 'resume-file-icon';
		icon.textContent = extension;
		icon.setAttribute('aria-hidden', 'true');
		const main = document.createElement('div');
		main.className = 'resume-card-main';
		const name = document.createElement('strong');
		name.textContent = resume.original_name;
		const meta = document.createElement('small');
		meta.textContent = `${formatFileSize(resume.file_size)} · Uploaded ${new Date(resume.uploaded_at).toLocaleDateString()}`;
		main.append(name, meta);
		const actions = document.createElement('div');
		actions.className = 'resume-card-actions';
		const downloadButton = document.createElement('button');
		downloadButton.type = 'button';
		downloadButton.dataset.action = 'download';
		downloadButton.dataset.id = resume.id;
		downloadButton.dataset.name = resume.original_name;
		downloadButton.textContent = 'Download';
		const deleteButton = document.createElement('button');
		deleteButton.type = 'button';
		deleteButton.dataset.action = 'delete';
		deleteButton.dataset.id = resume.id;
		deleteButton.textContent = 'Delete';
		actions.append(downloadButton, deleteButton);
		card.append(icon, main, actions);
		if (resume.text_preview) {
			const preview = document.createElement('p');
			preview.className = 'resume-preview';
			preview.textContent = resume.text_preview;
			card.append(preview);
		}
		resumeList.append(card);
	});
};

const loadResumes = async (searchTerm = '') => {
	try {
		const path = searchTerm
			? `/resumes/search/?q=${encodeURIComponent(searchTerm)}`
			: '/resumes/';
		const resumes = await window.SignalApi.request(path);
		renderResumes(resumes);
		if (searchTerm) showResumeMessage(`${resumes.length} matching ${resumes.length === 1 ? 'resume' : 'resumes'}.`);
		else showResumeMessage('');
	} catch (error) {
		showResumeMessage(error.message, true);
		if (!window.SignalApi.getToken()) window.location.replace('login.html');
	}
};

const loadInterviews = async () => {
	try {
		const interviews = await window.SignalApi.request('/interviews/');
		if (!Array.isArray(interviews)) throw new Error('The interview list could not be read.');
		interviewTableBody.replaceChildren();
		if (!interviews.length) {
			const row = document.createElement('tr');
			const cell = document.createElement('td');
			cell.colSpan = 5;
			cell.innerHTML = '<div class="empty-state"><span class="empty-mark" aria-hidden="true"><i></i><i></i><i></i></span><h3>No interviews yet</h3><p>Your interview list will appear here when you create your first session.</p><a href="interview.html">Create an interview <span aria-hidden="true">→</span></a></div>';
			row.append(cell);
			interviewTableBody.append(row);
			return;
		}

		interviews.forEach((interview) => {
			const row = document.createElement('tr');
			const topic = document.createElement('td');
			topic.textContent = interview.topic;
			const role = document.createElement('td');
			role.textContent = interview.role_title;
			const updated = document.createElement('td');
			updated.textContent = new Date(interview.completed_at || interview.created_at).toLocaleDateString();
			const status = document.createElement('td');
			status.textContent = interview.status === 'completed' ? 'Completed' : 'In progress';
			const action = document.createElement('td');
			if (interview.status === 'completed') {
				const reportLink = document.createElement('a');
				reportLink.href = `result.html?id=${encodeURIComponent(interview.id)}`;
				reportLink.textContent = 'View report';
				action.append(reportLink);
			} else {
				action.textContent = '—';
			}
			row.append(topic, role, updated, status, action);
			interviewTableBody.append(row);
		});
	} catch (error) {
		const row = document.createElement('tr');
		const cell = document.createElement('td');
		cell.colSpan = 5;
		cell.textContent = `Unable to load interviews: ${error.message}`;
		row.append(cell);
		interviewTableBody.replaceChildren(row);
		if (!window.SignalApi.getToken()) window.location.replace('login.html');
	}
};

resumeFileInput?.addEventListener('change', () => {
	document.querySelector('#selected-file-name').textContent = resumeFileInput.files[0]?.name || 'PDF, DOCX, or TXT';
});

resumeUploadForm?.addEventListener('submit', async (event) => {
	event.preventDefault();
	if (!resumeFileInput.files.length) return;
	const file = resumeFileInput.files[0];
	if (file.size > 10 * 1024 * 1024) {
		showResumeMessage('Resume files must be 10 MB or smaller.', true);
		return;
	}

	uploadButton.disabled = true;
	uploadButton.innerHTML = '<span aria-hidden="true">…</span> Uploading';
	showResumeMessage('Uploading file and extracting resume text…');
	try {
		const body = new FormData();
		body.append('file', file);
		await window.SignalApi.request('/resumes/', { method: 'POST', body });
		resumeUploadForm.reset();
		document.querySelector('#selected-file-name').textContent = 'PDF, DOCX, or TXT';
		await loadResumes();
		showResumeMessage('Resume saved to the database and indexed for keyword search.');
	} catch (error) {
		showResumeMessage(error.message, true);
	} finally {
		uploadButton.disabled = false;
		uploadButton.innerHTML = '<span aria-hidden="true">＋</span> Upload';
	}
});

resumeSearchForm?.addEventListener('submit', async (event) => {
	event.preventDefault();
	const query = document.querySelector('#resume-search').value.trim();
	if (!query) return loadResumes();
	await loadResumes(query);
});

document.querySelector('#clear-resume-search')?.addEventListener('click', () => {
	document.querySelector('#resume-search').value = '';
	loadResumes();
});

resumeList?.addEventListener('click', async (event) => {
	const button = event.target.closest('button[data-action]');
	if (!button) return;
	const resumeId = button.dataset.id;
	button.disabled = true;
	try {
		if (button.dataset.action === 'download') {
			const blob = await window.SignalApi.download(`/resumes/${resumeId}/download/`);
			const objectUrl = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = objectUrl;
			link.download = button.dataset.name;
			link.click();
			URL.revokeObjectURL(objectUrl);
		} else if (button.dataset.action === 'delete') {
			await window.SignalApi.request(`/resumes/${resumeId}/`, { method: 'DELETE' });
			await loadResumes(document.querySelector('#resume-search').value.trim());
			showResumeMessage('Resume and stored file deleted.');
		}
	} catch (error) {
		showResumeMessage(error.message, true);
		button.disabled = false;
	}
});

document.querySelector('#signout-button')?.addEventListener('click', async () => {
	try { await window.SignalApi.request('/accounts/logout/', { method: 'POST' }); } catch { /* Clear the local token even if the API is offline. */ }
	window.SignalApi.clearToken();
	window.location.replace('login.html');
});

if (window.SignalApi?.getToken()) {
	loadResumes();
	loadInterviews();
}
