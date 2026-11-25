(() => {
  const root = document.documentElement;
  const trigger = document.querySelector('#owl-trigger');
  const slot = trigger.querySelector('.identity-avatar');
  const avatar = slot.querySelector('img');
  const dialog = document.querySelector('#owl-dialog');
  const stage = dialog.querySelector('.owl-stage');
  const canvas = dialog.querySelector('.owl-canvas');
  const shade = dialog.querySelector('.owl-shade');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const assets = new URL('assets/logo/seasonal/', document.currentScript.src);
  const original = {
    thumbnail: avatar.src,
    poster: new URL('../weeboo-owl-512.png', assets).href,
  };
  const restingTransform = 'translate(0px, 0px) scale(1)';
  let theme = original;
  let active;
  let rendererPromise;
  let requestedKey;
  let midnightTimer;

  function sceneForDate(date) {
    const month = date.getMonth() + 1;
    const monthDay = month * 100 + date.getDate();
    if (!Number.isFinite(monthDay)) return null;
    if (monthDay >= 1021 && monthDay <= 1103) return 'halloween';
    if (monthDay >= 1215 && monthDay <= 1227) return 'christmas';
    if (monthDay >= 1228 || monthDay <= 104) return 'new-year';
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  function decodeImage(src) {
    const image = new Image();
    image.src = src;
    return image.decode().then(() => image.src, () => null);
  }

  async function selectTheme(key) {
    let nextTheme = original;
    if (key) {
      const poster = new URL(`images/${key}.webp`, assets).href;
      const thumbnail = await decodeImage(new URL(`thumbnails/${key}.webp`, assets).href) ?? await decodeImage(poster);
      if (thumbnail) nextTheme = { key, thumbnail, poster };
    }

    if (requestedKey !== key) return;
    theme = nextTheme;
    if (!active) avatar.src = theme.thumbnail;
    trigger.disabled = typeof dialog.showModal !== 'function';
    root.classList.remove('owl-loading');
  }

  function refreshCalendar() {
    const now = new Date();
    const key = sceneForDate(now);
    if (key !== requestedKey) {
      requestedKey = key;
      void selectTheme(key);
    }
    clearTimeout(midnightTimer);
    if (!Number.isFinite(+now)) return;
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnightTimer = setTimeout(refreshCalendar, midnight - now + 100);
  }

  function loadRenderer() {
    rendererPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('lottie-light-5.13.0.min.js', assets).href;
      script.addEventListener('load', () => {
        if (window.lottie) resolve(window.lottie);
        else reject(new Error('Lottie failed to initialize'));
      }, { once: true });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error('Lottie could not be loaded'));
      }, { once: true });
      document.head.append(script);
    }).catch((error) => {
      rendererPromise = undefined;
      throw error;
    });
    return rendererPromise;
  }

  async function loadScene(key, signal) {
    const response = await fetch(new URL(`${key}.json`, assets), { signal });
    if (!response.ok) throw new Error(`Owl scene returned ${response.status}`);
    return response.json();
  }

  function align(from, to) {
    const x = from.left + from.width / 2 - to.left - to.width / 2;
    const y = from.top + from.height / 2 - to.top - to.height / 2;
    return `translate(${x}px, ${y}px) scale(${from.width / to.width})`;
  }

  function restore() {
    if (!active) return;
    const view = active;
    active = undefined;
    clearTimeout(view.timer);
    view.request.abort();
    view.player?.destroy();
    view.flight?.cancel();
    view.fade?.cancel();
    slot.append(avatar);
    avatar.src = theme.thumbnail;
    root.classList.remove('owl-open');
    if (dialog.open) dialog.close();
    trigger.focus({ preventScroll: true });
  }

  async function dismiss() {
    const view = active;
    if (!view || view.closing) return;
    if (motion.matches || typeof stage.animate !== 'function') {
      restore();
      return;
    }

    view.closing = true;
    clearTimeout(view.timer);
    view.request.abort();
    view.player?.destroy();
    view.player = undefined;
    const start = stage.getBoundingClientRect();
    const opacity = getComputedStyle(shade).opacity;
    view.flight?.cancel();
    view.fade?.cancel();
    const centered = stage.getBoundingClientRect();
    const origin = slot.getBoundingClientRect();
    if (!centered.width || origin.bottom < 0 || origin.top > innerHeight) {
      restore();
      return;
    }

    view.flight = stage.animate([
      { transform: align(start, centered) },
      { transform: align(origin, centered) },
    ], { duration: 390, easing: 'cubic-bezier(.46,.03,.7,1)', fill: 'both' });
    view.fade = shade.animate([{ opacity }, { opacity: 0 }], { duration: 330, fill: 'both' });
    await view.flight.finished.catch(() => {});
    if (active === view) restore();
  }

  async function open() {
    if (active) return;
    const scene = theme;
    const view = { request: new AbortController() };
    active = view;
    const origin = slot.getBoundingClientRect();
    stage.prepend(avatar);
    dialog.showModal();
    root.classList.add('owl-open');
    const poster = decodeImage(scene.poster).then((src) => {
      if (src && active === view && !view.closing) avatar.src = src;
      return src;
    });
    if (motion.matches || typeof stage.animate !== 'function') return;

    const playback = scene.key
      ? Promise.all([poster, loadRenderer(), loadScene(scene.key, view.request.signal)]).catch(() => null)
      : Promise.resolve(null);
    const centered = stage.getBoundingClientRect();
    view.flight = stage.animate([
      { transform: align(origin, centered), offset: 0 },
      { transform: 'translate(0px, 0px) scale(1.025)', offset: .85 },
      { transform: restingTransform, offset: 1 },
    ], { duration: 520, easing: 'cubic-bezier(.22,.75,.24,1)', fill: 'both' });
    view.fade = shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 390, easing: 'ease-out', fill: 'both' });
    view.timer = setTimeout(dismiss, 12000);
    await view.flight.finished.catch(() => {});
    if (active !== view || view.closing) return;
    view.flight.cancel();

    const [picture, player, animationData] = (await playback) ?? [];
    if (active !== view || view.closing) return;
    clearTimeout(view.timer);
    if (picture) {
      try {
        view.player = player.loadAnimation({
          container: canvas, renderer: 'svg', animationData, loop: false, autoplay: true,
          assetsPath: new URL('images/', assets).href,
        });
        view.player.addEventListener('complete', dismiss);
        view.player.addEventListener('data_failed', dismiss);
        const duration = (animationData.op - animationData.ip) / animationData.fr * 1000;
        view.timer = setTimeout(dismiss, duration + 1500);
        return;
      } catch {
        canvas.replaceChildren();
      }
    }
    view.timer = setTimeout(dismiss, 2400);
  }

  trigger.addEventListener('click', open);
  dialog.querySelector('.owl-close').addEventListener('click', dismiss);
  shade.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    void dismiss();
  });
  dialog.addEventListener('close', () => { if (!dialog.open) restore(); });
  motion.addEventListener('change', () => { if (motion.matches) restore(); });
  window.addEventListener('pagehide', restore);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCalendar(); });
  refreshCalendar();
})();
