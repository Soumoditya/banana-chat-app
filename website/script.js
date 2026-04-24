/* ═══════════════════════════════════════════════
   BANANA CHAT — Landing Page Scripts
   Scroll reveals, counter animations, nav state,
   cursor glow, mobile menu, marquee
   ═══════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── Lucide icons ───
    if (window.lucide) lucide.createIcons();

    // ─── Nav scroll state ───
    const nav = document.getElementById('nav');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    // ─── Mobile menu toggle ───
    const toggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (toggle && mobileMenu) {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            mobileMenu.classList.toggle('open');
        });
        mobileMenu.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                toggle.classList.remove('active');
                mobileMenu.classList.remove('open');
            });
        });
    }

    // ─── Cursor glow (desktop only) ───
    const glow = document.getElementById('cursorGlow');
    if (glow && window.matchMedia('(pointer: fine)').matches) {
        document.addEventListener('mousemove', (e) => {
            glow.style.left = e.clientX + 'px';
            glow.style.top = e.clientY + 'px';
            glow.classList.add('active');
        });
        document.addEventListener('mouseleave', () => {
            glow.classList.remove('active');
        });
    }

    // ─── Intersection Observer for reveals ───
    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const siblings = entry.target.parentElement?.querySelectorAll('.reveal');
                    if (siblings && siblings.length > 1) {
                        let idx = Array.from(siblings).indexOf(entry.target);
                        setTimeout(() => entry.target.classList.add('visible'), idx * 80);
                    } else {
                        entry.target.classList.add('visible');
                    }
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // ─── Counter animation ───
    const counterObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    counterObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.5 }
    );
    const statsSection = document.querySelector('.stats');
    if (statsSection) counterObserver.observe(statsSection);

    function animateCounters() {
        document.querySelectorAll('.stat-num').forEach(el => {
            const target = parseInt(el.dataset.target, 10);
            const duration = 1600;
            const start = performance.now();
            function tick(now) {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.round(target * eased);
                if (progress < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        });
    }

    // ─── Smooth scroll for nav links ───
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ─── Tilt effect on phone mockup ───
    const phone = document.querySelector('.phone-frame');
    if (phone && window.matchMedia('(pointer: fine)').matches) {
        const hero = document.querySelector('.hero');
        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            phone.style.transform = `translateY(${Math.sin(Date.now() / 800) * -6}px) rotateY(${x * 6}deg) rotateX(${-y * 4}deg)`;
        });
        hero.addEventListener('mouseleave', () => { phone.style.transform = ''; });
    }

    // ─── Marquee: duplicate content for seamless loop ───
    const track = document.querySelector('.marquee-track');
    if (track) {
        const items = track.innerHTML;
        track.innerHTML = items + items;
    }

})();
