const reviewView = document.querySelector('#review-view');
const noSessionView = document.querySelector('#no-session-view');
const evidenceList = document.querySelector('#evidence-list');
const interviewId = new URLSearchParams(window.location.search).get('id');

if (!window.SignalApi?.getToken()) {
	window.location.replace('login.html');
}

const setText = (selector, value) => {
	document.querySelector(selector).textContent = value;
};

const makeReportItem = (title, detail, action) => {
	const item = document.createElement('li');
	const heading = document.createElement('strong');
	heading.textContent = title;
	item.append(heading);
	if (detail) {
		const evidence = document.createElement('p');
		evidence.textContent = detail;
		item.append(evidence);
	}
	if (action) {
		const nextStep = document.createElement('p');
		nextStep.textContent = `Try next time: ${action}`;
		item.append(nextStep);
	}
	return item;
};

const renderEvidence = (questions, answers, responseFeedback) => {
	evidenceList.replaceChildren();
	questions.forEach((question, index) => {
		const card = document.createElement('article');
		card.className = 'evidence-card';
		const topline = document.createElement('div');
		topline.className = 'evidence-topline';
		const questionNumber = document.createElement('span');
		questionNumber.textContent = `QUESTION ${String(index + 1).padStart(2, '0')}`;
		const sourceLabel = document.createElement('span');
		sourceLabel.textContent = question.category || 'PRACTICE QUESTION';
		const title = document.createElement('h3');
		title.textContent = question.question;
		const answer = document.createElement('blockquote');
		answer.textContent = answers[index] || 'No written answer was captured.';
		topline.append(questionNumber, sourceLabel);
		card.append(topline, title, answer);

		const feedback = responseFeedback[index];
		if (feedback) {
			const worked = document.createElement('p');
			worked.className = 'response-feedback';
			worked.textContent = `What worked: ${feedback.what_worked || 'No specific feedback provided.'}`;
			const improve = document.createElement('p');
			improve.className = 'response-feedback';
			improve.textContent = `Try next time: ${feedback.try_next_time || 'No additional suggestion.'}`;
			card.append(worked, improve);
		}
		evidenceList.append(card);
	});
};

const renderReport = (interview) => {
	const report = interview.report;
	const answers = interview.answers || [];
	const questions = interview.questions || [];
	const feedback = Array.isArray(report.response_feedback) ? report.response_feedback : [];

	setText('#candidate-name', interview.candidate_name || 'Candidate');
	setText('#candidate-role', `${interview.role_title} · ${interview.topic}`);
	setText('#candidate-avatar', (interview.candidate_name || 'C').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase());
	const elapsedMinutes = Math.floor((interview.elapsed_seconds || 0) / 60);
	const elapsedSeconds = (interview.elapsed_seconds || 0) % 60;
	setText('#session-length', `${elapsedMinutes}:${String(elapsedSeconds).padStart(2, '0')}`);
	setText('#prompts-reached', `${answers.filter((answer) => answer.trim()).length} of ${questions.length}`);
	setText('#notes-captured', String(answers.filter((answer) => answer.trim()).length));
	setText('#evidence-count', `${questions.length} ${questions.length === 1 ? 'QUESTION' : 'QUESTIONS'}`);
	setText('#report-summary', report.summary || 'No overall feedback was provided.');

	renderEvidence(questions, answers, feedback);

	const criteriaList = document.querySelector('#criteria-list');
	criteriaList.replaceChildren();
	(report.criteria || []).forEach((criterion) => {
		const item = document.createElement('div');
		item.className = 'criterion-score';
		const heading = document.createElement('strong');
		heading.textContent = criterion.name;
		const score = document.createElement('span');
		score.textContent = `${criterion.score}/5`;
		const evidence = document.createElement('p');
		evidence.textContent = criterion.evidence || 'No specific evidence provided.';
		item.append(heading, score, evidence);
		criteriaList.append(item);
	});

	const strengthList = document.querySelector('#strength-list');
	strengthList.replaceChildren();
	(report.strengths || []).forEach((strength) => {
		strengthList.append(makeReportItem(
			strength.title || 'Strength',
			strength.evidence || '',
			'',
		));
	});

	const improvementList = document.querySelector('#improvement-list');
	improvementList.replaceChildren();
	(report.improvements || []).forEach((improvement) => {
		improvementList.append(makeReportItem(
			improvement.area || 'Growth area',
			improvement.evidence || '',
			improvement.action || '',
		));
	});

	const practicePlan = document.querySelector('#practice-plan');
	practicePlan.replaceChildren();
	(report.practice_plan || []).forEach((step) => {
		const item = document.createElement('li');
		item.textContent = step;
		practicePlan.append(item);
	});

	const sourceList = document.querySelector('#source-list');
	sourceList.replaceChildren();
	(interview.sources || []).forEach((source) => {
		const item = document.createElement('li');
		const link = document.createElement('a');
		link.href = source.url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = source.title;
		item.append(link);
		sourceList.append(item);
	});
};

const showUnavailable = (message) => {
	reviewView.classList.add('is-hidden');
	noSessionView.classList.remove('is-hidden');
	setText('#report-error', message);
};

const loadReport = async () => {
	if (!interviewId) {
		showUnavailable('The report link is missing its interview ID. Start a new interview from your workspace.');
		return;
	}
	try {
		const interview = await window.SignalApi.request(`/interviews/${encodeURIComponent(interviewId)}/`);
		if (interview.status !== 'completed') {
			showUnavailable('This interview is not complete yet. Finish your answers to generate the report.');
			return;
		}
		renderReport(interview);
	} catch (error) {
		showUnavailable(error.message);
		if (!window.SignalApi.getToken()) window.location.replace('login.html');
	}
};

document.querySelector('#print-review').addEventListener('click', () => window.print());

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

if (window.SignalApi?.getToken()) loadReport();
