const storageKey = 'signal.previewResult.v1';
const reviewView = document.querySelector('#review-view');
const noSessionView = document.querySelector('#no-session-view');
const evidenceList = document.querySelector('#evidence-list');

const readPreviewSession = () => {
	try {
		const value = sessionStorage.getItem(storageKey);
		if (!value) return null;
		const parsed = JSON.parse(value);
		if (!parsed || typeof parsed !== 'object' || typeof parsed.candidate !== 'string' || !Array.isArray(parsed.notes)) return null;
		return parsed;
	} catch {
		return null;
	}
};

const setText = (selector, value) => {
	document.querySelector(selector).textContent = value;
};

const renderEmptyEvidence = (message) => {
	evidenceList.replaceChildren();
	const panel = document.createElement('div');
	panel.className = 'empty-panel';
	const glyph = document.createElement('span');
	glyph.className = 'empty-glyph';
	glyph.setAttribute('aria-hidden', 'true');
	glyph.textContent = '⌁';
	const title = document.createElement('h3');
	title.textContent = message ? 'Session details are unavailable' : 'No interview notes to review';
	const description = document.createElement('p');
	description.textContent = message || 'Complete a preview interview to bring its notes into this review.';
	const link = document.createElement('a');
	link.href = 'interview.html';
	link.innerHTML = 'Start an interview <span aria-hidden="true">→</span>';
	panel.append(glyph, title, description, link);
	evidenceList.append(panel);
};

const renderEvidence = (notes) => {
	evidenceList.replaceChildren();
	if (!notes.length) {
		renderEmptyEvidence('No notes were captured in this interview.');
		return;
	}

	notes.forEach((entry, index) => {
		const card = document.createElement('article');
		card.className = 'evidence-card';
		const topline = document.createElement('div');
		topline.className = 'evidence-topline';
		const questionNumber = document.createElement('span');
		questionNumber.textContent = `QUESTION ${String(Number(entry.number) || index + 1).padStart(2, '0')}`;
		const sourceLabel = document.createElement('span');
		sourceLabel.textContent = 'INTERVIEWER NOTE';
		const question = document.createElement('h3');
		question.textContent = typeof entry.question === 'string' ? entry.question : 'Interview prompt';
		const quote = document.createElement('blockquote');
		quote.textContent = typeof entry.note === 'string' ? entry.note : '';
		topline.append(questionNumber, sourceLabel);
		card.append(topline, question, quote);
		evidenceList.append(card);
	});
};

const session = readPreviewSession();
if (!session) {
	reviewView.classList.add('is-hidden');
	noSessionView.classList.remove('is-hidden');
} else {
	const candidate = session.candidate.trim() || 'Candidate';
	const role = session.role.trim() || 'Role not provided';
	const notes = session.notes.filter((entry) => entry && typeof entry.note === 'string' && entry.note.trim());
	setText('#candidate-name', candidate);
	setText('#candidate-role', role);
	setText('#candidate-avatar', candidate.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase());
	setText('#session-length', typeof session.duration === 'string' ? session.duration : '—');
	setText('#prompts-reached', `${Number(session.promptsReached) || 0} of ${Number(session.totalQuestions) || 0}`);
	setText('#notes-captured', String(notes.length));
	setText('#evidence-count', `${notes.length} ${notes.length === 1 ? 'NOTE' : 'NOTES'}`);
	renderEvidence(notes);
}

document.querySelector('#print-review').addEventListener('click', () => window.print());
document.querySelector('#clear-session').addEventListener('click', () => {
	try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable for local files. */ }
	reviewView.classList.add('is-hidden');
	noSessionView.classList.remove('is-hidden');
	window.scrollTo({ top: 0, behavior: 'smooth' });
});

const sidebar = document.querySelector('#sidebar');
const menuToggle = document.querySelector('.mobile-menu-toggle');
const sidebarScrim = document.querySelector('.sidebar-scrim');
const setSidebarOpen = (isOpen) => {
	sidebar.classList.toggle('is-open', isOpen);
	sidebarScrim.classList.toggle('is-visible', isOpen);
	menuToggle.setAttribute('aria-expanded', String(isOpen));
	menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
};

menuToggle.addEventListener('click', () => setSidebarOpen(menuToggle.getAttribute('aria-expanded') !== 'true'));
sidebarScrim.addEventListener('click', () => setSidebarOpen(false));
sidebar.addEventListener('click', (event) => {
	if (event.target.closest('a')) setSidebarOpen(false);
});
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape') setSidebarOpen(false);
});
