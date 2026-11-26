const setupView = document.querySelector('#setup-view');
const sessionView = document.querySelector('#session-view');
const completeView = document.querySelector('#complete-view');
const setupForm = document.querySelector('#setup-form');
const focusSelect = document.querySelector('#interview-focus');
const questionTitle = document.querySelector('#question-title');
const questionHint = document.querySelector('#question-hint');
const questionCategory = document.querySelector('#question-category');
const answerNotes = document.querySelector('#answer-notes');
const questionCount = document.querySelector('#question-count');
const progressPercent = document.querySelector('#progress-percent');
const progressFill = document.querySelector('#progress-fill');
const sessionTimer = document.querySelector('#session-timer');
const previousButton = document.querySelector('#previous-question');
const nextButton = document.querySelector('#next-question');
const breadcrumbCurrent = document.querySelector('#breadcrumb-current');
const followUpText = document.querySelector('#follow-up-text');
const setupMessage = document.querySelector('#setup-message');
const prepareButton = document.querySelector('#prepare-button');
const finishButton = document.querySelector('#finish-session');
const sessionMessage = document.querySelector('#session-message');
const sessionSourceList = document.querySelector('#session-source-list');
const questionSourceList = document.querySelector('#question-source-list');

if (!window.SignalApi?.getToken()) {
	window.location.replace('login.html');
}

let interviewId = null;
let questions = [];
let sources = [];
let currentQuestionIndex = 0;
let furthestQuestionIndex = 0;
let answers = [];
let startedAt = 0;
let timerInterval = null;

const formatElapsed = (seconds) => {
	const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
	const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
	return `${minutes}:${remainingSeconds}`;
};

const showSetupMessage = (message, isError = false) => {
	setupMessage.textContent = message;
	setupMessage.classList.toggle('is-error', isError);
};

const updateTimer = () => {
	const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
	sessionTimer.textContent = formatElapsed(elapsedSeconds);
};

const renderSources = () => {
	sessionSourceList.replaceChildren();
	sources.forEach((source) => {
		const item = document.createElement('li');
		const link = document.createElement('a');
		link.href = source.url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = source.title;
		item.append(link);
		sessionSourceList.append(item);
	});
};

const renderQuestion = () => {
	const question = questions[currentQuestionIndex];
	const totalQuestions = questions.length;
	const currentNumber = currentQuestionIndex + 1;
	const percent = Math.round((currentNumber / totalQuestions) * 100);

	questionCategory.textContent = question.category;
	questionTitle.textContent = question.question;
	questionHint.textContent = question.hint;
	followUpText.textContent = question.follow_up;
	questionSourceList.replaceChildren();
	(question.source_ids || []).forEach((sourceId) => {
		const source = sources[sourceId - 1];
		if (!source) return;
		const item = document.createElement('li');
		const link = document.createElement('a');
		link.href = source.url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = source.title;
		item.append(link);
		questionSourceList.append(item);
	});
	questionCount.textContent = `QUESTION ${String(currentNumber).padStart(2, '0')} OF ${String(totalQuestions).padStart(2, '0')}`;
	progressPercent.textContent = `${percent}%`;
	progressFill.style.width = `${percent}%`;
	answerNotes.value = answers[currentQuestionIndex] || '';
	previousButton.disabled = currentQuestionIndex === 0;
	nextButton.innerHTML = currentQuestionIndex === totalQuestions - 1
		? 'Finish interview <span aria-hidden="true">→</span>'
		: 'Next question <span aria-hidden="true">→</span>';
};

const beginSession = (interview) => {
	interviewId = interview.id;
	questions = interview.questions;
	sources = interview.sources;
	answers = questions.map(() => '');
	currentQuestionIndex = 0;
	furthestQuestionIndex = 0;
	startedAt = Date.now();

	renderSources();
	document.querySelector('#session-role-label').textContent = interview.role_title.toUpperCase();
	document.querySelector('#session-candidate-name').textContent = interview.candidate_name;
	document.querySelector('#session-focus-label').textContent = `${interview.topic} · ${focusSelect.options[focusSelect.selectedIndex].text}`;
	document.querySelector('#session-title').textContent = `Practice: ${interview.topic}`;
	setupView.classList.add('is-hidden');
	completeView.classList.add('is-hidden');
	sessionView.classList.remove('is-hidden');
	breadcrumbCurrent.textContent = 'Interview in progress';
	sessionMessage.textContent = 'ⓘ No audio is recorded. Your written answers are saved to your account when you finish.';
	renderQuestion();
	updateTimer();
	timerInterval = window.setInterval(updateTimer, 1000);
	window.scrollTo({ top: 0, behavior: 'smooth' });
	questionTitle.focus({ preventScroll: true });
};

const prepareSession = async (event) => {
	event.preventDefault();
	if (!setupForm.reportValidity()) return;

	const formData = new FormData(setupForm);
	prepareButton.disabled = true;
	showSetupMessage('Searching official sources and preparing your questions. Local AI generation can take a few minutes; keep this page open.');
	try {
		const interview = await window.SignalApi.request('/interviews/prepare/', {
			method: 'POST',
			body: {
				candidate_name: formData.get('candidateName').trim(),
				role_title: formData.get('roleTitle').trim(),
				topic: formData.get('topic').trim(),
				focus: formData.get('focus'),
				duration_minutes: Number(formData.get('duration')),
			},
		});
		beginSession(interview);
	} catch (error) {
		showSetupMessage(error.message, true);
		if (!window.SignalApi.getToken()) window.location.replace('login.html');
	} finally {
		prepareButton.disabled = false;
	}
};

const changeQuestion = (direction) => {
	answers[currentQuestionIndex] = answerNotes.value.trim();
	currentQuestionIndex = Math.max(0, Math.min(questions.length - 1, currentQuestionIndex + direction));
	furthestQuestionIndex = Math.max(furthestQuestionIndex, currentQuestionIndex);
	renderQuestion();
};

const renderSummary = (interview) => {
	const elapsedSeconds = interview.elapsed_seconds;
	const savedAnswers = interview.answers;
	document.querySelector('#summary-candidate').textContent = interview.candidate_name;
	document.querySelector('#summary-role').textContent = `${interview.role_title} · ${interview.topic}`;
	document.querySelector('#summary-questions').textContent = `${savedAnswers.filter((answer) => answer.trim()).length} of ${questions.length}`;
	document.querySelector('#summary-duration').textContent = formatElapsed(elapsedSeconds);
	document.querySelector('#notes-count').textContent = `${savedAnswers.filter((answer) => answer.trim()).length} responses`;
	document.querySelector('#review-results-link').href = `result.html?id=${encodeURIComponent(interview.id)}`;

	const notesList = document.querySelector('#notes-list');
	notesList.replaceChildren();
	savedAnswers.forEach((answer, index) => {
		if (!answer.trim()) return;
		const article = document.createElement('article');
		article.className = 'note-entry';
		const label = document.createElement('span');
		label.textContent = `QUESTION ${String(index + 1).padStart(2, '0')}`;
		const noteText = document.createElement('p');
		noteText.textContent = answer;
		article.append(label, noteText);
		notesList.append(article);
	});
};

const finishSession = async () => {
	answers[currentQuestionIndex] = answerNotes.value.trim();
	if (!answers.some((answer) => answer.trim())) {
		sessionMessage.textContent = 'ⓘ Add at least one written answer before generating your feedback.';
		answerNotes.focus();
		return;
	}

	window.clearInterval(timerInterval);
	finishButton.disabled = true;
	nextButton.disabled = true;
	sessionMessage.textContent = 'Generating your evidence-based feedback with the local AI model. This may take a few minutes; keep this page open.';
	try {
		const interview = await window.SignalApi.request(`/interviews/${interviewId}/complete/`, {
			method: 'POST',
			body: {
				answers,
				elapsed_seconds: Math.floor((Date.now() - startedAt) / 1000),
			},
		});
		renderSummary(interview);
		sessionView.classList.add('is-hidden');
		completeView.classList.remove('is-hidden');
		breadcrumbCurrent.textContent = 'Session summary';
		window.scrollTo({ top: 0, behavior: 'smooth' });
		completeView.focus({ preventScroll: true });
	} catch (error) {
		sessionMessage.textContent = `ⓘ ${error.message}`;
		window.clearInterval(timerInterval);
		timerInterval = window.setInterval(updateTimer, 1000);
	} finally {
		finishButton.disabled = false;
		nextButton.disabled = false;
	}
};

const cancelSession = async () => {
	if (!interviewId) return;
	const cancelButton = document.querySelector('#cancel-session');
	cancelButton.disabled = true;
	sessionMessage.textContent = 'Discarding this interview…';
	try {
		await window.SignalApi.request(`/interviews/${interviewId}/`, { method: 'DELETE' });
		window.clearInterval(timerInterval);
		setupView.classList.remove('is-hidden');
		sessionView.classList.add('is-hidden');
		completeView.classList.add('is-hidden');
		breadcrumbCurrent.textContent = 'New interview';
		showSetupMessage('Interview discarded.');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	} catch (error) {
		sessionMessage.textContent = `ⓘ ${error.message}`;
	} finally {
		cancelButton.disabled = false;
	}
};

setupForm.addEventListener('submit', prepareSession);
answerNotes.addEventListener('input', () => {
	answers[currentQuestionIndex] = answerNotes.value;
});
previousButton.addEventListener('click', () => changeQuestion(-1));
nextButton.addEventListener('click', () => {
	if (currentQuestionIndex === questions.length - 1) finishSession();
	else changeQuestion(1);
});
finishButton.addEventListener('click', finishSession);
document.querySelector('#cancel-session').addEventListener('click', cancelSession);
document.querySelector('#new-session').addEventListener('click', () => {
	window.clearInterval(timerInterval);
	setupForm.reset();
	interviewId = null;
	answers = [];
	questions = [];
	sources = [];
	setupView.classList.remove('is-hidden');
	sessionView.classList.add('is-hidden');
	completeView.classList.add('is-hidden');
	breadcrumbCurrent.textContent = 'New interview';
	showSetupMessage('');
	window.scrollTo({ top: 0, behavior: 'smooth' });
	document.querySelector('#candidate-name').focus({ preventScroll: true });
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
