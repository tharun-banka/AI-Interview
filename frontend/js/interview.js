const setupView = document.querySelector('#setup-view');
const sessionView = document.querySelector('#session-view');
const completeView = document.querySelector('#complete-view');
const setupForm = document.querySelector('#setup-form');
const focusSelect = document.querySelector('#interview-focus');
const structuredMode = document.querySelector('#structured-mode');
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

const questionSets = {
	balanced: [
		{ category: 'OPENING', question: 'Could you tell me about the path that brought you to this kind of work?', hint: 'Give the candidate a moment to choose where their story begins.', followUp: 'Which experience most influenced the direction you took?' },
		{ category: 'EXPERIENCE', question: 'Tell me about a piece of work you are particularly proud of.', hint: 'Invite a specific example and clarify their personal contribution.', followUp: 'What part of the outcome came directly from your decisions?' },
		{ category: 'PROBLEM SOLVING', question: 'Describe a challenge where your first approach did not work as expected.', hint: 'Listen for how they noticed the issue and adapted their approach.', followUp: 'What did you change after you realized the first approach was not working?' },
		{ category: 'COLLABORATION', question: 'Tell me about a time you had to bring different perspectives together.', hint: 'Explore how they made space for disagreement and reached a way forward.', followUp: 'What did you do when the group did not initially agree?' },
		{ category: 'REFLECTION', question: 'What is something you have changed your mind about in your work?', hint: 'Close by exploring learning, not only outcomes.', followUp: 'What new information shifted your perspective?' },
	],
	behavioral: [
		{ category: 'OWNERSHIP', question: 'Tell me about a commitment you had to deliver under difficult circumstances.', hint: 'Ask for the situation, their actions, and the result.', followUp: 'What trade-off did you have to make?' },
		{ category: 'ADAPTABILITY', question: 'Describe a time priorities changed after you had already started the work.', hint: 'Explore how they reassessed and communicated the change.', followUp: 'How did you decide what to deprioritize?' },
		{ category: 'FEEDBACK', question: 'Tell me about feedback that changed how you approach your work.', hint: 'Listen for openness, reflection, and a concrete change in behavior.', followUp: 'What would a colleague notice you doing differently now?' },
		{ category: 'JUDGMENT', question: 'Describe a decision you made without having all the information you wanted.', hint: 'Explore how they handled uncertainty and risk.', followUp: 'What signal would have caused you to change course?' },
		{ category: 'REFLECTION', question: 'What would you handle differently in a recent project?', hint: 'Leave room for an honest example and what they learned.', followUp: 'How have you used that learning since?' },
	],
	technical: [
		{ category: 'APPROACH', question: 'Walk me through how you would break down a technical problem you have not seen before.', hint: 'Listen for how they clarify constraints before choosing a solution.', followUp: 'What would you want to learn before committing to an approach?' },
		{ category: 'TRADE-OFFS', question: 'Tell me about a technical decision where you had to balance competing needs.', hint: 'Explore the constraints and how the trade-off was communicated.', followUp: 'Which constraint had the greatest influence on your choice?' },
		{ category: 'DEBUGGING', question: 'Describe a difficult issue you investigated and how you narrowed it down.', hint: 'Ask how they formed and tested hypotheses.', followUp: 'What evidence ruled out your initial theory?' },
		{ category: 'QUALITY', question: 'How have you decided when a solution was ready to ship?', hint: 'Explore reliability, user impact, and practical constraints.', followUp: 'What risk did you monitor after release?' },
		{ category: 'REFLECTION', question: 'What technical practice have you changed your mind about over time?', hint: 'Invite them to connect experience to their current judgment.', followUp: 'What changed your perspective?' },
	],
	collaboration: [
		{ category: 'COMMUNICATION', question: 'Tell me about a time you had to explain a complex idea to a different audience.', hint: 'Explore how they adapted the message to what the audience needed.', followUp: 'How did you know the explanation had landed?' },
		{ category: 'DISAGREEMENT', question: 'Describe a disagreement with a teammate about how to move forward.', hint: 'Listen for curiosity and how they worked toward a resolution.', followUp: 'What did you understand about their perspective afterward?' },
		{ category: 'TEAMWORK', question: 'Tell me about a time someone else’s contribution changed the outcome of your work.', hint: 'Invite specific detail about interdependence and shared credit.', followUp: 'What did you learn from the way they approached it?' },
		{ category: 'INFLUENCE', question: 'Describe how you built support for an idea without having direct authority.', hint: 'Explore listening, evidence, and how they responded to concerns.', followUp: 'Which concern was hardest to address?' },
		{ category: 'REFLECTION', question: 'What helps you do your best work with a team?', hint: 'Close with the conditions that support their collaboration.', followUp: 'Can you share an example of that working well?' },
	],
};

let questions = [];
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

const updateTimer = () => {
	const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
	sessionTimer.textContent = formatElapsed(elapsedSeconds);
};

const renderQuestion = () => {
	const question = questions[currentQuestionIndex];
	const totalQuestions = questions.length;
	const currentNumber = currentQuestionIndex + 1;
	const percent = Math.round((currentNumber / totalQuestions) * 100);

	questionCategory.textContent = question.category;
	questionTitle.textContent = question.question;
	questionHint.textContent = question.hint;
	followUpText.textContent = question.followUp;
	questionCount.textContent = `QUESTION ${String(currentNumber).padStart(2, '0')} OF ${String(totalQuestions).padStart(2, '0')}`;
	progressPercent.textContent = `${percent}%`;
	progressFill.style.width = `${percent}%`;
	answerNotes.value = answers[currentQuestionIndex] || '';
	previousButton.disabled = currentQuestionIndex === 0;
	nextButton.innerHTML = currentQuestionIndex === totalQuestions - 1
		? 'Review interview <span aria-hidden="true">→</span>'
		: 'Next question <span aria-hidden="true">→</span>';
};

const startSession = (event) => {
	event.preventDefault();
	if (!setupForm.reportValidity()) return;

	const formData = new FormData(setupForm);
	const focus = formData.get('focus');
	questions = structuredMode.checked ? [...questionSets[focus]] : [...questionSets.balanced];
	answers = questions.map(() => '');
	currentQuestionIndex = 0;
	furthestQuestionIndex = 0;
	startedAt = Date.now();

	document.querySelector('#session-role-label').textContent = formData.get('roleTitle').trim().toUpperCase();
	document.querySelector('#session-candidate-name').textContent = formData.get('candidateName').trim();
	document.querySelector('#session-focus-label').textContent = focusSelect.options[focusSelect.selectedIndex].text;
	setupView.classList.add('is-hidden');
	completeView.classList.add('is-hidden');
	sessionView.classList.remove('is-hidden');
	breadcrumbCurrent.textContent = 'Interview in progress';
	renderQuestion();
	updateTimer();
	timerInterval = window.setInterval(updateTimer, 1000);
	window.scrollTo({ top: 0, behavior: 'smooth' });
	questionTitle.focus({ preventScroll: true });
};

const changeQuestion = (direction) => {
	answers[currentQuestionIndex] = answerNotes.value.trim();
	currentQuestionIndex = Math.max(0, Math.min(questions.length - 1, currentQuestionIndex + direction));
	furthestQuestionIndex = Math.max(furthestQuestionIndex, currentQuestionIndex);
	renderQuestion();
};

const finishSession = () => {
	answers[currentQuestionIndex] = answerNotes.value.trim();
	window.clearInterval(timerInterval);
	updateTimer();
	const formData = new FormData(setupForm);
	const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
	const notes = answers
		.map((note, index) => ({ note, question: questions[index].question, number: index + 1 }))
		.filter((entry) => entry.note);
	const previewResult = {
		candidate: formData.get('candidateName').trim(),
		role: formData.get('roleTitle').trim(),
		focus: formData.get('focus'),
		duration: formatElapsed(elapsedSeconds),
		promptsReached: furthestQuestionIndex + 1,
		totalQuestions: questions.length,
		notes,
	};
	try {
		sessionStorage.setItem('signal.previewResult.v1', JSON.stringify(previewResult));
	} catch {
		document.querySelector('#result-storage-notice').textContent = 'This browser cannot pass preview data to the result page. Your in-page summary is still available.';
		document.querySelector('#review-results-link').setAttribute('aria-disabled', 'true');
		document.querySelector('#review-results-link').removeAttribute('href');
	}

	document.querySelector('#summary-candidate').textContent = formData.get('candidateName').trim();
	document.querySelector('#summary-role').textContent = formData.get('roleTitle').trim();
	document.querySelector('#summary-questions').textContent = `${furthestQuestionIndex + 1} of ${questions.length}`;
	document.querySelector('#summary-duration').textContent = formatElapsed(elapsedSeconds);
	document.querySelector('#notes-count').textContent = `${notes.length} ${notes.length === 1 ? 'entry' : 'entries'}`;
	const notesList = document.querySelector('#notes-list');
	notesList.replaceChildren();
	if (!notes.length) {
		const emptyNotes = document.createElement('p');
		emptyNotes.className = 'empty-notes';
		emptyNotes.textContent = 'No notes were added during this preview session.';
		notesList.append(emptyNotes);
	} else {
		notes.forEach((entry) => {
			const article = document.createElement('article');
			article.className = 'note-entry';
			const label = document.createElement('span');
			label.textContent = `QUESTION ${String(entry.number).padStart(2, '0')}`;
			const noteText = document.createElement('p');
			noteText.textContent = entry.note;
			article.append(label, noteText);
			notesList.append(article);
		});
	}

	sessionView.classList.add('is-hidden');
	completeView.classList.remove('is-hidden');
	breadcrumbCurrent.textContent = 'Session summary';
	window.scrollTo({ top: 0, behavior: 'smooth' });
	completeView.focus({ preventScroll: true });
};

setupForm.addEventListener('submit', startSession);
answerNotes.addEventListener('input', () => {
	answers[currentQuestionIndex] = answerNotes.value;
});
previousButton.addEventListener('click', () => changeQuestion(-1));
nextButton.addEventListener('click', () => {
	if (currentQuestionIndex === questions.length - 1) finishSession();
	else changeQuestion(1);
});
document.querySelector('#finish-session').addEventListener('click', finishSession);
document.querySelector('#cancel-session').addEventListener('click', () => {
	window.clearInterval(timerInterval);
	setupView.classList.remove('is-hidden');
	sessionView.classList.add('is-hidden');
	completeView.classList.add('is-hidden');
	breadcrumbCurrent.textContent = 'New interview';
	window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.querySelector('#new-session').addEventListener('click', () => {
	window.clearInterval(timerInterval);
	setupForm.reset();
	answers = [];
	questions = [];
	setupView.classList.remove('is-hidden');
	sessionView.classList.add('is-hidden');
	completeView.classList.add('is-hidden');
	breadcrumbCurrent.textContent = 'New interview';
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
