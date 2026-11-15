/* ==========================================================================
   Madame Lux — interacción
   Umbral 18+, brasas del hero, revelados, visor, formulario de admisión
   por pasos y botón flotante de WhatsApp. Sin dependencias.
   ========================================================================== */
(() => {
  'use strict';

  const d = document.documentElement;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine   = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = {
    get(k)    { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* modo privado: no pasa nada */ } },
  };
  const WHATSAPP = 'https://wa.me/34614006638?text=Hola%20Madame%20Lux%2C%20vengo%20de%20tu%20web%20y%20me%20gustar%C3%ADa%20saber%20m%C3%A1s.';


  /* ── Letras del título, una a una ─────────────────────────────────────── */
  const h1 = $('.hero__t');
  if (h1) {
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = 'Madame Lux';
    h1.prepend(sr);
  }
  $$('.split').forEach((el, k) => {
    const base = k === 0 ? 0.35 : 0.8;
    const txt = el.textContent.trim();
    el.textContent = '';
    el.setAttribute('aria-hidden', 'true');
    [...txt].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      s.style.setProperty('--d', (base + i * 0.07).toFixed(2) + 's');
      el.appendChild(s);
    });
  });


  /* ── Brasas del hero (canvas 2D) ──────────────────────────────────────── */
  const embers = (() => {
    const cv = $('#embers'), hero = $('.hero');
    if (!cv || !hero || reduce) return { start() {} };
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, ps = [], cols = [], raf = 0, prev = 0, visible = true, on = false;

    const hex = (s) => {
      s = (s || '').trim().replace('#', '');
      if (s.length === 3) s = s.split('').map((c) => c + c).join('');
      const n = parseInt(s, 16) || 0;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const readCols = () => {
      const cs = getComputedStyle(d);
      cols = [hex(cs.getPropertyValue('--gold-hi')), hex(cs.getPropertyValue('--gold')), hex(cs.getPropertyValue('--red-hi'))];
    };
    /* en escritorio suben sobre todo por el lado del trono */
    const spawn = (anywhere) => ({
      x: W * (W >= 760 ? 0.3 + Math.random() * 0.7 : Math.random()),
      y: anywhere ? Math.random() * H : H + 8,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.22 + Math.random() * 0.65),
      s: 0.6 + Math.random() * 1.7,
      ph: Math.random() * 6.283,
      c: Math.random() < 0.74 ? (Math.random() < 0.5 ? 0 : 1) : 2,
      a: 0.3 + Math.random() * 0.55,
    });
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const N = W < 760 ? 30 : 60;
      while (ps.length < N) ps.push(spawn(true));
      ps.length = N;
    };
    const frame = (t) => {
      raf = 0;
      const dt = prev ? Math.min(t - prev, 120) / 16.667 : 1;   // por tiempo, no por fotogramas
      prev = t;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        p.x += (p.vx + Math.sin(t * 0.001 + p.ph) * 0.2) * dt;
        p.y += p.vy * dt;
        if (p.y < -12 || p.x < -12 || p.x > W + 12) Object.assign(p, spawn(false));
        const flick = 0.65 + 0.35 * Math.sin(t * 0.006 + p.ph * 3);
        const fade = Math.min(1, (p.y / H) * 1.7);
        const a = Math.min(1, p.a * flick * fade * 0.85);
        if (a <= 0.01) continue;
        const [r, g, b] = cols[p.c];
        ctx.fillStyle = `rgba(${r},${g},${b},${(a * 0.16).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 4.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const run = () => { if (on && !raf) raf = requestAnimationFrame(frame); };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; run(); }).observe(hero);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('resize', resize);
    readCols();
    resize();
    return { start() { on = true; run(); } };
  })();


  /* ── Música de fondo ──────────────────────────────────────────────────────
     Pista original (assets/audio/ambiente.mp3): 1 s de margen + 90 s de bucle + 1 s.
     Va por Web Audio para que el bucle no tenga cortes. Empieza al pulsar «Entrar»
     en el umbral (o al primer toque si ya se había entrado antes) y se silencia con
     el botón de abajo a la izquierda; la elección se recuerda. */
  const music = (() => {
    const btn = $('#music');
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!btn || !AC) { if (btn) btn.hidden = true; return { play() {}, wanted: () => false }; }
    const SRC = 'assets/audio/ambiente.mp3', LOOP_START = 1, LOOP_LEN = 90, VOL = 0.32;
    let ctx = null, gain = null, buf = null, node = null, loading = null, on = false;
    const wanted = () => store.get('ml-musica') !== 'off';
    const ui = () => {
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', String(on));
      const label = on ? 'Silenciar música' : 'Activar música';
      btn.setAttribute('aria-label', label); btn.title = label;
    };
    const load = () => loading || (loading = fetch(SRC)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((a) => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej)))
      .then((b) => { buf = b; return b; })
      .catch((e) => { loading = null; throw e; }));
    const ramp = (to, secs) => {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(to, t + secs);
    };
    const play = () => {
      if (!ctx) { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination); }
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      on = true; ui();
      load().then(() => {
        if (!on) return;
        if (!node) {
          node = ctx.createBufferSource();
          node.buffer = buf; node.loop = true;
          node.loopStart = LOOP_START; node.loopEnd = LOOP_START + LOOP_LEN;
          node.connect(gain); node.start(0, LOOP_START);
        }
        ramp(VOL, 3);                                   // entra despacio
      }).catch((e) => { console.warn('Música:', e); on = false; ui(); });
    };
    const pause = () => {
      on = false; ui();
      if (!ctx) return;
      ramp(0, 0.6);
      setTimeout(() => { if (!on && ctx.state === 'running') ctx.suspend(); }, 700);
    };
    btn.addEventListener('click', () => {
      if (on) { pause(); store.set('ml-musica', 'off'); }
      else { play(); store.set('ml-musica', 'on'); }
    });
    /* Ya había cruzado el umbral otro día: el navegador solo deja sonar tras un gesto */
    if (d.classList.contains('pasa') && wanted()) {
      const evs = ['pointerup', 'mousedown', 'keydown', 'touchend'];
      const first = (e) => {
        evs.forEach((t) => window.removeEventListener(t, first, true));
        if (e.target && e.target.closest && e.target.closest('#music')) return;   // el botón ya se encarga
        if (!on) play();
      };
      evs.forEach((t) => window.addEventListener(t, first, true));
    }
    /* Pestaña oculta: se calla; al volver, sigue donde iba */
    document.addEventListener('visibilitychange', () => {
      if (!ctx || !on) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    ui();
    return { play, wanted };
  })();


  /* ── Umbral 18+ ───────────────────────────────────────────────────────── */
  const enter = () => { d.classList.add('entered'); embers.start(); };
  const gate = $('#gate');
  if (d.classList.contains('pasa') || !gate) {
    requestAnimationFrame(() => requestAnimationFrame(enter));
  } else {
    const outside = [$('#nav'), $('main'), $('footer'), $('.wa-fab')].filter(Boolean);
    outside.forEach((e) => { e.inert = true; });
    const ok = $('#gate-ok');
    setTimeout(() => ok && ok.focus({ preventScroll: true }), 350);
    ok.addEventListener('click', () => {
      store.set('ml-umbral', '1');
      if (music.wanted()) music.play();               // el clic de «Entrar» permite que suene
      window.scrollTo(0, 0);
      gate.classList.add('open');
      d.classList.remove('locked');
      outside.forEach((e) => { e.inert = false; });
      setTimeout(enter, reduce ? 0 : 520);
      setTimeout(() => d.classList.add('pasa'), reduce ? 60 : 1650);
    });
  }


  /* ── Cabecera, menú móvil y barra de progreso ─────────────────────────── */
  const nav = $('#nav'), prog = $('.progress'), burger = $('.nav__burger');
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    d.classList.toggle('fab-on', y > window.innerHeight * 0.6);
    const max = d.scrollHeight - window.innerHeight;
    prog.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    d.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  burger.addEventListener('click', () => setMenu(!d.classList.contains('menu-open')));
  $$('#menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  matchMedia('(min-width: 1081px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });


  /* ── Revelado al entrar en pantalla ───────────────────────────────────── */
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      el.classList.add('in');
      /* al terminar, se quita la clase para que manden las transiciones
         propias del elemento (hover de tarjetas, enlaces…) sin retardo */
      const i = parseFloat(getComputedStyle(el).getPropertyValue('--i')) || 0;
      setTimeout(() => el.classList.remove('reveal', 'in'), 1300 + i * 90);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  $$('.reveal').forEach((el) => io.observe(el));


  /* ── Tarjetas: un brillo suave que sigue al ratón ─────────────────────── */
  $$('.card').forEach((c) => c.addEventListener('pointermove', (e) => {
    const b = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - b.left).toFixed(0) + 'px');
    c.style.setProperty('--my', (e.clientY - b.top).toFixed(0) + 'px');
  }));


  /* ── Medallones que se inclinan hacia el ratón ────────────────────────── */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach((m) => {
      const zone = m.closest('.inter, .gate') || m;
      zone.addEventListener('pointermove', (e) => {
        const b = m.getBoundingClientRect();
        const dx = (e.clientX - (b.left + b.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (b.top + b.height / 2)) / window.innerHeight;
        m.style.transform = `perspective(900px) rotateY(${(dx * 26).toFixed(2)}deg) rotateX(${(-dy * 22).toFixed(2)}deg)`;
      });
      zone.addEventListener('pointerleave', () => { m.style.transform = ''; });
    });
  }


  /* ── Visor de la galería ──────────────────────────────────────────────── */
  const lb = $('#lb');
  const shots = $$('.shot');
  if (lb && shots.length) {
    const img = $('#lb-img'), cap = $('#lb-cap'), count = $('#lb-count');
    let idx = 0, x0 = null, wasOpen = false;
    const pad = (n) => String(n).padStart(2, '0');
    const show = (i) => {
      idx = (i + shots.length) % shots.length;
      const s = shots[idx], im = s.querySelector('img');
      img.src = im.currentSrc || im.src;
      img.alt = im.alt;
      cap.textContent = s.dataset.cap || '';
      count.textContent = `${pad(idx + 1)} / ${pad(shots.length)}`;
      img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    };
    /* la limpieza se hace aquí mismo y no solo en el evento «close», que
       algunos navegadores entregan tarde: así el scroll nunca se queda bloqueado */
    const cleanup = () => {
      if (!wasOpen) return;
      wasOpen = false;
      d.classList.remove('locked');
      shots[idx].focus({ preventScroll: true });
    };
    const closeLb = () => { if (lb.open) lb.close(); else lb.removeAttribute('open'); cleanup(); };
    shots.forEach((s, i) => s.addEventListener('click', () => {
      show(i);
      wasOpen = true;
      d.classList.add('locked');
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
    }));
    lb.addEventListener('close', cleanup);
    lb.addEventListener('cancel', (e) => { e.preventDefault(); closeLb(); });
    $('.lb__x', lb).addEventListener('click', closeLb);
    $('.lb__prev', lb).addEventListener('click', () => show(idx - 1));
    $('.lb__next', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb__fig')) closeLb(); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft')  show(idx - 1);
      if (e.key === 'Escape') { e.preventDefault(); closeLb(); }
    });
    lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }


  /* ── Formulario de admisión ───────────────────────────────────────────────
     Las mismas preguntas que su Google Form. Se envía a FormSubmit por AJAX
     (https://formsubmit.co/ajax/<correo>), que lo reenvía a su correo.
     El correo destino es el «action» del <form>: si FormSubmit le da un
     alias tras activarlo, basta con cambiarlo ahí. */
  const form = $('#adm');
  if (form) {
    /* Prácticas de la rejilla, en el mismo orden que su Google Form */
    const PRACTICAS = [
      'Animalización (Pet Play)', 'Ataduras / Bondage', 'Ballbusting', 'Bofetadas',
      'CBT / Control genital', 'Cera', 'Control de la castidad', 'Control de orgasmo / Edging',
      'Dominación mental / psicológica', 'Feminización', 'Findom', 'Finfet', 'Flagelación',
      'Foot fetish', 'Humillación', 'Inmovilización', 'Juegos de rol', 'Látex', 'Lencería',
      'Lluvia dorada', 'MoneySlave', 'Momificación', 'Dilatación anal', 'Pegging',
      'Privación sensorial', 'Contenido personalizado', 'Sodomización', 'Spanking',
      'Spitting', 'Strapon', 'Trampling',
    ];
    const grid = $('#grid');
    const PREFIX = grid ? grid.dataset.prefix : 'Interés · ';
    form.noValidate = true;   // con JS validamos nosotros, con mensajes propios (sin JS, el navegador)

    const pill = (name, v, req) =>
      `<label class="pill"><input type="radio" name="${name}" value="${v}"${req ? ' required' : ''}><span>${v}</span></label>`;

    if (grid) {
      grid.innerHTML = PRACTICAS.map((p) =>
        `<div class="pr" role="radiogroup" aria-label="${p}"><span class="pr__n">${p}</span>` +
        `<span class="pr__o">${[0, 1, 2, 3, 4, 5].map((n) => pill(PREFIX + p, n, false)).join('')}</span></div>`
      ).join('');
    }

    /* Escalas numéricas: data-scale="1-5", data-name, data-required, etiquetas opcionales */
    $$('.scale[data-scale]', form).forEach((s) => {
      const [a, b] = s.dataset.scale.split('-').map(Number);
      const req = s.hasAttribute('data-required');
      let html = s.dataset.minLabel ? `<span class="scale__end">${s.dataset.minLabel}</span>` : '';
      for (let n = a; n <= b; n++) html += pill(s.dataset.name, n, req && n === a);
      if (s.dataset.maxLabel) html += `<span class="scale__end">${s.dataset.maxLabel}</span>`;
      s.innerHTML = html;
    });

    /* «Otra (especificar)»: muestra su campo de texto */
    $$('input[type="radio"]', form).forEach((r) => r.addEventListener('change', () => {
      $$(`input[name="${CSS.escape(r.name)}"][data-other]`, form).forEach((o) => {
        const box = document.getElementById(o.dataset.other);
        if (box) box.hidden = !o.checked;
      });
    }));

    /* Pasos */
    const steps = $$('.step', form);
    const prevB = $('.adm__prev', form), nextB = $('.adm__next', form), sendB = $('.adm__send', form);
    const counter = $('.adm__count', form), bar = $('.adm__bar', form), progLis = $$('.adm__prog li', form);
    const msg = $('#adm-msg'), done = $('#adm-done'), frame = $('#adm-frame');
    let cur = 0;

    const scrollToFrame = () => {
      if (frame.getBoundingClientRect().top < 0) frame.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };
    const render = () => {
      steps.forEach((s, i) => s.classList.toggle('is-on', i === cur));
      prevB.hidden = cur === 0;
      nextB.hidden = cur === steps.length - 1;
      sendB.hidden = cur !== steps.length - 1;
      counter.textContent = `Paso ${cur + 1} de ${steps.length}`;
      progLis.forEach((li, i) => { li.classList.toggle('is-on', i === cur); li.classList.toggle('is-done', i < cur); });
      bar.style.setProperty('--p', ((cur + 1) / steps.length * 100) + '%');
    };
    const go = (i) => {
      cur = Math.max(0, Math.min(steps.length - 1, i));
      render();
      scrollToFrame();
      const lg = $('legend', steps[cur]);
      if (lg) { lg.tabIndex = -1; lg.focus({ preventScroll: true }); }
    };

    /* Validación con mensajes propios, campo a campo */
    const errorText = (c) => {
      const v = c.validity;
      if (v.valueMissing || (c.required && !c.value.trim())) {
        if (c.type === 'radio') return 'Elige una opción.';
        if (c.type === 'checkbox') return 'Marca esta casilla para poder enviar tu solicitud.';
        return 'Esta pregunta es obligatoria.';
      }
      if (v.rangeUnderflow) return c.dataset.msgMin || 'El número es demasiado bajo.';
      if (v.rangeOverflow || v.badInput) return 'Revisa este número.';
      return c.validationMessage;
    };
    const isBad = (c) => !c.checkValidity() || (c.required && /^(text|textarea|number)$/.test(c.type) && !c.value.trim());
    const checkField = (f) => {
      const ctrls = $$('input:not([type="hidden"]), textarea', f).filter((c) => !c.hidden && !c.closest('[hidden]'));
      const bad = ctrls.find(isBad);
      const old = $('.err', f);
      if (old) old.remove();
      f.classList.toggle('is-err', !!bad);
      if (bad) {
        const p = document.createElement('p');
        p.className = 'err';
        p.textContent = errorText(bad);
        f.appendChild(p);
      }
      return bad;
    };
    const validate = (step) => {
      let first = null;
      $$('.field', step).forEach((f) => { const bad = checkField(f); if (bad && !first) first = bad; });
      if (first) {
        first.closest('.field').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        first.focus({ preventScroll: true });
        return false;
      }
      return true;
    };
    form.addEventListener('input', (e) => { const f = e.target.closest('.field.is-err'); if (f) checkField(f); });
    form.addEventListener('change', (e) => { const f = e.target.closest('.field.is-err'); if (f) checkField(f); });

    nextB.addEventListener('click', () => { if (validate(steps[cur])) go(cur + 1); });
    prevB.addEventListener('click', () => go(cur - 1));
    /* Intro en un campo de texto: pasa al siguiente paso en vez de enviar */
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && cur < steps.length - 1) {
        e.preventDefault();
        nextB.click();
      }
    });
    render();

    /* Datos para el correo: en el orden del formulario, y la rejilla de
       prácticas resumida por nivel de interés para que se lea de un vistazo */
    const payload = () => {
      const fd = new FormData(form);
      const entries = [];
      const scores = {};
      let gridAt = -1;
      for (const [k, v] of fd.entries()) {
        if (k === '_honey') continue;
        if (k.startsWith(PREFIX)) {
          scores[k.slice(PREFIX.length)] = Number(v);
          if (gridAt < 0) { gridAt = entries.length; entries.push(null); }
          continue;
        }
        const val = String(v).trim();
        if (!val) continue;
        const prev = entries.find((x) => x && x[0] === k);
        if (prev) prev[1] += ', ' + val; else entries.push([k, val]);
      }
      if (gridAt >= 0) {
        const levels = [];
        for (let s = 5; s >= 0; s--) {
          const names = PRACTICAS.filter((p) => scores[p] === s);
          const label = s === 5 ? 'Interés 5 (máximo)' : s === 0 ? 'Interés 0 (ninguno)' : `Interés ${s}`;
          if (names.length) levels.push([label, names.join(', ')]);
        }
        entries.splice(gridAt, 1, ...levels);
      }
      const data = Object.fromEntries(entries.filter(Boolean));
      const nombre = data['Nombre'] || 'sin nombre';
      data._subject = `Solicitud de admisión · ${nombre}${data['Edad'] ? ' (' + data['Edad'] + ')' : ''}`;
      data._template = 'table';
      data._captcha = 'false';
      const contacto = data['Contacto'] || '';
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto)) data._replyto = contacto;
      return data;
    };

    const finish = () => {
      form.hidden = true;
      done.hidden = false;
      scrollToFrame();
      done.focus({ preventScroll: true });
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(steps[cur])) return;
      for (let i = 0; i < steps.length; i++) { if (!validate(steps[i])) { if (i !== cur) go(i); return; } }

      const hp = form.querySelector('[name="_honey"]');
      if (hp && hp.value) { finish(); return; }          // bot: se le da las gracias y no se envía nada

      const endpoint = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
      msg.textContent = '';
      form.classList.add('is-sending');
      sendB.textContent = 'Enviando…';
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload()),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && String(j.success) === 'true') finish();
        else throw new Error(j.message || 'HTTP ' + r.status);
      } catch (err) {
        console.warn('Formulario de admisión:', err);
        msg.innerHTML = 'No se ha podido enviar ahora mismo. Vuelve a intentarlo en un momento o ' +
          `<a href="${WHATSAPP}" target="_blank" rel="noopener">escríbeme por WhatsApp</a>.`;
      } finally {
        form.classList.remove('is-sending');
        sendB.textContent = 'Enviar solicitud';
      }
    });
  }


  /* ── Año del pie ──────────────────────────────────────────────────────── */
  const yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();
})();
