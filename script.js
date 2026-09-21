/* ============================================
   HEALTH HOUZE — interactions
   Every block is guarded so a missing element can never throw and
   take the rest of the page's behaviour down with it.
   ============================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Dark mode ----------
     The theme itself is applied by the inline script in <head> (before
     first paint). Here we only wire up the toggle and keep its label
     and pressed state in sync. */
  var themeToggle = document.getElementById('themeToggle');

  function syncToggle() {
    if (!themeToggle) return;
    var isDark = root.getAttribute('data-theme') === 'dark';
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('hh-theme', theme); } catch (e) { /* private mode */ }
    syncToggle();
  }

  syncToggle();

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  // Follow the OS only while the visitor hasn't chosen a theme themselves.
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var onSchemeChange = function (e) {
    var stored = null;
    try { stored = localStorage.getItem('hh-theme'); } catch (err) { /* ignore */ }
    if (!stored) {
      root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      syncToggle();
    }
  };
  if (mq.addEventListener) mq.addEventListener('change', onSchemeChange);
  else if (mq.addListener) mq.addListener(onSchemeChange);

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  var showAll = function () {
    for (var i = 0; i < revealEls.length; i++) revealEls[i].classList.add('in-view');
  };

  if (reduceMotion || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px 0px -10% 0px' });

    for (var j = 0; j < revealEls.length; j++) io.observe(revealEls[j]);

    // Safety net: content must never stay hidden if the observer misses it.
    window.setTimeout(showAll, 2500);
  }

  /* ---------- Nav: shadow once scrolled ---------- */
  var nav = document.querySelector('.nav');
  var navLinks = document.getElementById('navLinks');
  var navToggle = document.getElementById('navToggle');

  /* ---------- Mobile nav ---------- */
  function closeNav() {
    if (!navLinks || !navToggle) return;
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  function openNav() {
    if (!navLinks || !navToggle) return;
    navLinks.classList.add('open');
    navToggle.setAttribute('aria-expanded', 'true');
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (navLinks.classList.contains('open')) closeNav();
      else openNav();
    });

    // Close after picking a destination, on Escape, or on an outside tap.
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        closeNav();
        navToggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('open') && !e.target.closest('.nav-inner')) closeNav();
    });

    // The menu is a small-screen layer — never leave it stuck open on resize.
    // Must match the nav breakpoint in style.css.
    var desktop = window.matchMedia('(min-width: 961px)');
    var onDesktopChange = function (e) { if (e.matches) closeNav(); };
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktopChange);
    else if (desktop.addListener) desktop.addListener(onDesktopChange);
  }

  /* ---------- FAQ accordion ----------
     Open/closed is pure CSS (grid-template-rows), so nothing here has to
     measure heights — which means it stays correct through resizes and
     late webfont loads. */
  var faqItems = document.querySelectorAll('.faq-item');

  Array.prototype.forEach.call(faqItems, function (item) {
    var btn = item.querySelector('.faq-q');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var willOpen = !item.classList.contains('open');

      Array.prototype.forEach.call(document.querySelectorAll('.faq-item.open'), function (openItem) {
        if (openItem === item) return;
        openItem.classList.remove('open');
        var openBtn = openItem.querySelector('.faq-q');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      });

      item.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  });

  /* ---------- Active section in the nav ---------- */
  var sectionLinks = navLinks ? navLinks.querySelectorAll('a[href^="#"]') : [];
  var watched = [];

  Array.prototype.forEach.call(sectionLinks, function (link) {
    var id = link.getAttribute('href').slice(1);
    var section = id ? document.getElementById(id) : null;
    if (section) watched.push({ link: link, section: section });
  });

  if (watched.length) {
    var setActive = function (activeLink) {
      watched.forEach(function (entry) {
        var on = entry.link === activeLink;
        entry.link.classList.toggle('is-active', on);
        if (on) entry.link.setAttribute('aria-current', 'true');
        else entry.link.removeAttribute('aria-current');
      });
    };

    var ticking = false;
    var update = function () {
      ticking = false;

      if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8);

      var line = (nav ? nav.offsetHeight : 0) + 24;
      var current = null;
      watched.forEach(function (entry) {
        if (entry.section.getBoundingClientRect().top <= line) current = entry.link;
      });

      // Always light up the last link once the page is scrolled to the end.
      var atBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 2;
      if (atBottom) current = watched[watched.length - 1].link;

      setActive(current);
    };

    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  } else if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    }, { passive: true });
  }
})();
