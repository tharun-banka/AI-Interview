const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('.primary-nav');
const progressBar = document.querySelector('.scroll-progress span');
const sectionLinks = [...document.querySelectorAll('.primary-nav a')];
const observedSections = sectionLinks
	.map((link) => document.querySelector(link.getAttribute('href')))
	.filter(Boolean);

if (menuToggle && primaryNav) {
	menuToggle.addEventListener('click', () => {
		const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
		menuToggle.setAttribute('aria-expanded', String(!isOpen));
		menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
		primaryNav.classList.toggle('is-open', !isOpen);
	});

	primaryNav.addEventListener('click', (event) => {
		if (event.target.closest('a')) {
			menuToggle.setAttribute('aria-expanded', 'false');
			menuToggle.setAttribute('aria-label', 'Open navigation');
			primaryNav.classList.remove('is-open');
		}
	});
}

const updateScrollProgress = () => {
	const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
	const progress = scrollableDistance > 0 ? window.scrollY / scrollableDistance : 0;
	if (progressBar) progressBar.style.transform = `scaleX(${progress})`;
};

window.addEventListener('scroll', updateScrollProgress, { passive: true });
window.addEventListener('resize', updateScrollProgress);
updateScrollProgress();

if ('IntersectionObserver' in window) {
	const revealObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				entry.target.classList.add('is-visible');
				observer.unobserve(entry.target);
			}
		});
	}, { threshold: 0.12 });

	document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

	const sectionObserver = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			sectionLinks.forEach((link) => {
				if (link.getAttribute('href') === `#${entry.target.id}`) {
					link.setAttribute('aria-current', 'location');
				} else {
					link.removeAttribute('aria-current');
				}
			});
		});
	}, { rootMargin: '-35% 0px -55% 0px' });

	observedSections.forEach((section) => sectionObserver.observe(section));
} else {
	document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
}
