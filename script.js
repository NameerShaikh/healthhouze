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

  /* ---------- Request a call ----------
     There is no backend, so the form cannot post anywhere. It composes a
     WhatsApp message from the answers and hands it to WhatsApp with
     everything pre-filled; the visitor presses send. Nothing is stored. */
  var WA_NUMBER = '917276188690';
  var SEEN_KEY = 'hh-callback-seen';

  function remember() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* private mode */ }
  }
  function alreadySeen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  function showError(input, msg) {
    var box = document.getElementById(input.id + '-error');
    input.setAttribute('aria-invalid', 'true');
    if (box) {
      box.textContent = msg;
      box.hidden = false;
      input.setAttribute('aria-describedby', box.id);
    }
  }
  function clearError(input) {
    var box = document.getElementById(input.id + '-error');
    input.removeAttribute('aria-invalid');
    if (box) { box.hidden = true; box.textContent = ''; }
  }

  // Accepts an Indian mobile in any of the usual shapes, and any
  // explicitly-dialled international number so overseas clients are not
  // turned away. Returns a tidy display string, or null if it is not a
  // plausible number.
  function normalisePhone(raw) {
    var s = String(raw).trim();
    var hasPlus = s.charAt(0) === '+';
    var d = s.replace(/\D/g, '');

    if (d.length === 12 && d.indexOf('91') === 0 && /^[6-9]/.test(d.slice(2))) return '+91 ' + d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0' && /^[6-9]/.test(d.slice(1))) return '+91 ' + d.slice(1);
    if (/^[6-9]\d{9}$/.test(d)) return '+91 ' + d;
    if (hasPlus && d.length >= 8 && d.length <= 15) return '+' + d;
    return null;
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-callback-form]'), function (form) {
    var name = form.querySelector('input[name="name"]');
    var phone = form.querySelector('input[name="phone"]');
    var goal = form.querySelector('select[name="goal"]');
    var time = form.querySelector('select[name="time"]');
    var done = form.querySelector('.cb-done');
    var fallback = form.querySelector('.cb-fallback');

    [name, phone].forEach(function (el) {
      if (el) el.addEventListener('input', function () { clearError(el); });
    });

    var lastSent = 0;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // A double-tap on the button would otherwise open WhatsApp twice.
      // Still allows a deliberate retry a moment later.
      if (Date.now() - lastSent < 1500) return;

      var ok = true;

      if (!name.value.trim()) { showError(name, 'Please tell us your name.'); ok = false; }
      else clearError(name);

      var dialled = normalisePhone(phone.value);
      if (!phone.value.trim()) { showError(phone, 'We need a number to call you on.'); ok = false; }
      else if (!dialled) { showError(phone, "That doesn't look right. Enter a 10-digit mobile, or include the country code if you're outside India."); ok = false; }
      else clearError(phone);

      if (!ok) {
        var bad = form.querySelector('[aria-invalid="true"]');
        if (bad) bad.focus();
        return;
      }

      var lines = [
        "Hi Health Houze! I'd like to request a call from a dietician.",
        '',
        'Name: ' + name.value.trim(),
        'WhatsApp: ' + dialled,
        'Looking for help with: ' + goal.value,
        'Best time to call: ' + time.value
      ];
      var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));

      lastSent = Date.now();
      remember();
      if (done) done.hidden = false;
      if (fallback) fallback.href = url;

      // A synthesised link click, not window.open. window.open(..., 'noopener')
      // returns null even when it succeeds, so there is no way to tell a
      // blocked popup from a successful one — testing its result opened
      // WhatsApp twice. An anchor click is also the form iOS Safari honours
      // most reliably inside a user gesture. If it is blocked, the visitor
      // still has the link in the confirmation message.
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  });

  /* ---------- The prompt ----------
     Shown at most once per visitor, never again once used or dismissed,
     and never while the inline form is already on screen. */
  var modal = document.getElementById('callModal');

  if (modal && !alreadySeen()) {
    var panel = modal.querySelector('.modal-panel');
    var lastFocus = null;
    var armed = false;
    var open = false;
    var lockedY = 0;

    var inlineForm = document.querySelector('.callback');
    var inlineVisible = false;
    if (inlineForm && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inlineVisible = entries[0].isIntersecting;
      }, { threshold: 0.25 }).observe(inlineForm);
    }

    function focusables() {
      return Array.prototype.filter.call(
        panel.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'),
        function (el) { return el.offsetParent !== null; }
      );
    }

    // Returns whether it actually opened, so a caller can keep waiting
    // rather than burning its trigger when the prompt was suppressed.
    function openModal() {
      if (open || alreadySeen()) return false;
      // Never interrupt someone who is already looking at the inline form,
      // or who has the mobile menu open.
      if (inlineVisible) return false;
      if (navLinks && navLinks.classList.contains('open')) return false;

      open = true;
      lastFocus = document.activeElement;
      modal.hidden = false;
      // Pin the body at its current offset. Plain `overflow: hidden` lets
      // the page scroll behind the dialog on iOS.
      lockedY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = (-lockedY) + 'px';
      document.body.classList.add('modal-open');
      // Focus the panel rather than the first input, so a phone keyboard
      // does not spring up and cover the dialog.
      panel.focus();
      return true;
    }

    function closeModal() {
      if (!open) return;
      open = false;
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      window.scrollTo(0, lockedY);
      remember();
      // Put focus back without yanking the page around again.
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    Array.prototype.forEach.call(modal.querySelectorAll('[data-close-modal]'), function (el) {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Arm only after the visitor has had time to read something.
    window.setTimeout(function () { armed = true; }, 15000);

    // Trigger 1 — read more than half the page.
    var onDepth = function () {
      if (!armed || open) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && (window.scrollY / max) > 0.55) {
        // Only retire this trigger once it has actually produced the prompt.
        if (openModal()) window.removeEventListener('scroll', onDepth);
      }
    };
    window.addEventListener('scroll', onDepth, { passive: true });

    // Trigger 2 — desktop exit intent (pointer leaves towards the tab bar).
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.addEventListener('mouseout', function (e) {
        if (!armed || open || e.relatedTarget || e.clientY > 8) return;
        openModal();
      });
    }

    // Trigger 3 — long dwell, as a backstop on touch devices.
    window.setTimeout(function () { openModal(); }, 55000);
  }

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
