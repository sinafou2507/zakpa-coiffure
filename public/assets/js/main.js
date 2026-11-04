/* ==========================================================================
   ZAKPA COIFFURE — interactions
   Aucune dépendance externe. Tout est progressif : si JavaScript est
   désactivé, le site reste lisible et les liens d'appel / WhatsApp
   continuent de fonctionner.
   ========================================================================== */
(function () {
  'use strict'

  const $  = (sel, ctx = document) => ctx.querySelector(sel)
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel))

  /* ════════════════════════════════════════════════════════════════════
     1. LIENS WHATSAPP AVEC MESSAGE PRÉ-REMPLI
     Le numéro n'est écrit qu'une seule fois dans le HTML (dans les liens
     `tel:`). On le réutilise ici pour construire les liens wa.me et y
     ajouter un message déjà rédigé : le client n'a plus qu'à envoyer.
     ════════════════════════════════════════════════════════════════════ */
  const telLink = $('a[href^="tel:"]')
  const WA_NUMBER = telLink
    ? telLink.getAttribute('href').replace(/[^0-9]/g, '')
    : ''

  if (WA_NUMBER) {
    $$('[data-wa]').forEach((el) => {
      const message = el.dataset.waMessage
      el.href = 'https://wa.me/' + WA_NUMBER + (message ? '?text=' + encodeURIComponent(message) : '')
      el.target = '_blank'
      el.rel = 'noopener'
    })
  }

  /* ════════════════════════════════════════════════════════════════════
     2. EN-TÊTE : état « défilé »
     ════════════════════════════════════════════════════════════════════ */
  const header = $('#header')

  /* ════════════════════════════════════════════════════════════════════
     3. MENU MOBILE
     ════════════════════════════════════════════════════════════════════ */
  const nav = $('#nav')
  const navToggle = $('#nav-toggle')

  function setNav(open) {
    if (!nav || !navToggle) return
    nav.classList.toggle('is-open', open)
    navToggle.setAttribute('aria-expanded', String(open))
    navToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu')
    document.body.classList.toggle('no-scroll', open)
  }

  navToggle?.addEventListener('click', () => setNav(!nav.classList.contains('is-open')))
  $$('#nav a').forEach((a) => a.addEventListener('click', () => setNav(false)))

  /* ════════════════════════════════════════════════════════════════════
     4. HORAIRES : badge « ouvert / fermé » calculé en direct
     La source de vérité reste le tableau HTML (#hours) et ses attributs
     data-days / data-open / data-close — aucune duplication.
     ════════════════════════════════════════════════════════════════════ */
  const hoursRows = $$('#hours li')
  const statusEl = $('#status')

  const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }

  function rowForDay(day) {
    return hoursRows.find((row) =>
      (row.dataset.days || '').split(',').map((d) => d.trim()).includes(String(day))
    )
  }

  function renderStatus() {
    if (!statusEl || hoursRows.length === 0) return

    const now = new Date()
    const day = now.getDay()
    const minutes = now.getHours() * 60 + now.getMinutes()

    hoursRows.forEach((row) => row.classList.remove('is-today'))
    const todayRow = rowForDay(day)
    if (todayRow) todayRow.classList.add('is-today')

    let isOpen = false
    let message = ''

    if (todayRow && todayRow.dataset.open && todayRow.dataset.close) {
      const open = toMinutes(todayRow.dataset.open)
      const close = toMinutes(todayRow.dataset.close)
      if (minutes >= open && minutes < close) {
        isOpen = true
        message = `Ouvert · ferme à ${todayRow.dataset.close}`
      } else if (minutes < open) {
        message = `Fermé · ouvre aujourd'hui à ${todayRow.dataset.open}`
      }
    }

    if (!message) {
      // Cherche le prochain jour d'ouverture. On démarre à 1 (demain) : si
      // aujourd'hui était un jour d'ouverture, soit on est dedans, soit on a
      // déjà dépassé l'heure de fermeture — dans les deux cas, aujourd'hui
      // n'est plus une réponse utile.
      for (let i = 1; i <= 7; i += 1) {
        const d = (day + i) % 7
        const row = rowForDay(d)
        if (row && row.dataset.open) {
          const label = i === 1 ? 'demain' : DAY_NAMES[d]
          message = `Fermé · ouvre ${label} à ${row.dataset.open}`
          break
        }
      }
    }

    if (!message) message = 'Fermé'

    statusEl.textContent = message
    statusEl.classList.toggle('is-open', isOpen)
    statusEl.classList.toggle('is-closed', !isOpen)
  }

  renderStatus()
  setInterval(renderStatus, 60000)

  /* ════════════════════════════════════════════════════════════════════
     5. GALERIE : filtres par catégorie
     ════════════════════════════════════════════════════════════════════ */
  const chips = $$('.chip')
  const galleryItems = $$('.gallery__item')

  // Filtres sans aucune photo : masqués (ils réapparaissent dès qu'une
  // photo de la catégorie est ajoutée).
  chips.forEach((chip) => {
    const f = chip.dataset.filter
    if (f !== 'all' && !galleryItems.some((i) => i.dataset.cat === f)) chip.hidden = true
  })

  chips.forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.classList.contains('is-active')))
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        const active = c === chip
        c.classList.toggle('is-active', active)
        c.setAttribute('aria-pressed', String(active))
      })
      const filter = chip.dataset.filter
      galleryItems.forEach((item) => {
        item.classList.toggle('is-hidden', !(filter === 'all' || item.dataset.cat === filter))
      })
    })
  })

  const visibleItems = () => galleryItems.filter((i) => !i.classList.contains('is-hidden'))

  /* ════════════════════════════════════════════════════════════════════
     6. VISIONNEUSE (photos + vidéos)
     ════════════════════════════════════════════════════════════════════ */
  const lb = $('#lightbox')
  const stage = $('#lightbox-stage')
  const caption = $('#lightbox-caption')
  const btnPrev = $('[data-lb-prev]')
  const btnNext = $('[data-lb-next]')

  let openList = []
  let current = 0
  let lastFocused = null

  function showVideoSlot(src) {
    stage.innerHTML =
      '<div class="lightbox__slot">' +
        '<svg aria-hidden="true"><use href="#i-play"/></svg>' +
        '<strong>Emplacement vidéo réservé</strong>' +
        '<p>Déposez votre fichier dans <code>' + src + '</code>, puis rechargez la page.</p>' +
        '<p>Conseil : MP4 (H.264), moins de 10 Mo, format vertical 1080 × 1920 pour les réseaux.</p>' +
      '</div>'
  }

  function renderSlide() {
    const item = openList[current]
    if (!item) return

    const label = item.querySelector('.gallery__cap')
    caption.textContent = label ? label.textContent : ''
    stage.innerHTML = ''

    if (item.dataset.type === 'video') {
      const src = item.dataset.video
      const video = document.createElement('video')
      video.controls = true
      video.playsInline = true
      video.preload = 'metadata'
      if (item.dataset.poster) video.poster = item.dataset.poster
      video.src = src
      video.addEventListener('error', () => showVideoSlot(src), { once: true })
      stage.appendChild(video)
    } else {
      const source = item.querySelector('img')
      const img = document.createElement('img')
      img.src = source.currentSrc || source.src
      img.alt = source.alt
      stage.appendChild(img)
    }

    const multiple = openList.length > 1
    if (btnPrev) btnPrev.hidden = !multiple
    if (btnNext) btnNext.hidden = !multiple
  }

  function openLightbox(item) {
    openList = visibleItems()
    current = openList.indexOf(item)
    if (current < 0) return

    lastFocused = document.activeElement
    renderSlide()
    lb.hidden = false
    document.body.classList.add('no-scroll')
    $('.lightbox__close')?.focus()
  }

  function closeLightbox() {
    if (lb.hidden) return
    stage.innerHTML = '' // stoppe la lecture d'une éventuelle vidéo
    lb.hidden = true
    document.body.classList.remove('no-scroll')
    if (lastFocused instanceof HTMLElement) lastFocused.focus()
  }

  function step(delta) {
    if (openList.length < 2) return
    current = (current + delta + openList.length) % openList.length
    renderSlide()
  }

  galleryItems.forEach((item) => {
    item.addEventListener('click', () => openLightbox(item))
  })

  $$('[data-lb-close]').forEach((el) => el.addEventListener('click', closeLightbox))
  btnPrev?.addEventListener('click', () => step(-1))
  btnNext?.addEventListener('click', () => step(1))

  document.addEventListener('keydown', (e) => {
    if (lb.hidden) {
      if (e.key === 'Escape' && nav?.classList.contains('is-open')) setNav(false)
      return
    }

    if (e.key === 'Escape') { closeLightbox(); return }
    if (e.key === 'Tab') { trapFocus(e); return }
    // Les flèches ne doivent pas détourner le contrôle du lecteur vidéo.
    if (e.target instanceof HTMLVideoElement) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
  })

  function trapFocus(e) {
    const focusables = $$('button, [href], video, [tabindex]:not([tabindex="-1"])', lb)
      .filter((el) => !el.hidden)
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  /* ════════════════════════════════════════════════════════════════════
     7. CARTE GOOGLE MAPS : chargement à la demande (vie privée)
     Aucune requête vers Google n'est faite tant que l'internaute n'a pas
     cliqué : pas de cookies déposés sans consentement.
     ════════════════════════════════════════════════════════════════════ */
  const map = $('#map')
  $('#map-load')?.addEventListener('click', () => {
    const query = map.dataset.query || ''
    const iframe = document.createElement('iframe')
    iframe.src = 'https://www.google.com/maps?q=' + encodeURIComponent(query) + '&output=embed'
    iframe.title = 'Carte : ' + query
    iframe.loading = 'lazy'
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
    iframe.setAttribute('allowfullscreen', '')
    map.innerHTML = ''
    map.appendChild(iframe)
  })

  /* ════════════════════════════════════════════════════════════════════
     7 bis. TITRE QUI S'ÉCRIT TOUT SEUL (effet machine à écrire)
     Le vrai titre reste dans le HTML (Google, lecteurs d'écran) : on ne
     fait que le « rejouer » visuellement. La 2ᵉ ligne alterne ensuite
     entre plusieurs formules. Désactivé si l'internaute préfère éviter
     les animations.
     ════════════════════════════════════════════════════════════════════ */
  const titre = $('.hero h1')
  const animer = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (titre && titre.querySelector('em') && animer) {
    const ligne1 = (titre.firstChild?.textContent || '').trim()
    const FORMULES = [
      titre.querySelector('em').textContent.trim(),
      'pour toute la famille.',
      'du cheveu aux ongles.',
      'à Yopougon Ananeraie.',
    ]

    titre.setAttribute('aria-label', titre.textContent.replace(/\s+/g, ' ').trim())
    titre.innerHTML =
      '<span aria-hidden="true"><span class="type-1"></span><br><em class="type-2"></em></span>'
    const t1 = $('.type-1', titre)
    const t2 = $('.type-2', titre)
    const curseur = document.createElement('span')
    curseur.className = 'type-caret'
    curseur.setAttribute('aria-hidden', 'true')

    // Réserve la hauteur la plus grande pour que la page ne « saute » pas.
    function reserver() {
      titre.style.minHeight = ''
      const a = t1.textContent, b = t2.textContent
      t1.textContent = ligne1
      let max = 0
      FORMULES.forEach((f) => { t2.textContent = f; max = Math.max(max, titre.offsetHeight) })
      t1.textContent = a; t2.textContent = b
      titre.style.minHeight = max + 'px'
    }
    reserver()
    window.addEventListener('resize', reserver)

    const pause = (ms) => new Promise((r) => setTimeout(r, ms))
    async function taper(el, texte, vitesse) {
      el.after(curseur)
      for (let i = 1; i <= texte.length; i += 1) {
        el.textContent = texte.slice(0, i)
        await pause(vitesse + Math.random() * 40)
      }
    }
    async function effacer(el) {
      while (el.textContent.length) {
        el.textContent = el.textContent.slice(0, -1)
        await pause(28)
      }
    }

    ;(async () => {
      await pause(350)
      await taper(t1, ligne1, 55)
      await pause(250)
      await taper(t2, FORMULES[0], 65)
      let i = 0
      for (;;) {
        await pause(3200)
        await effacer(t2)
        i = (i + 1) % FORMULES.length
        await pause(300)
        await taper(t2, FORMULES[i], 65)
      }
    })()
  }

  /* ════════════════════════════════════════════════════════════════════
     8. APPARITION AU DÉFILEMENT
     ════════════════════════════════════════════════════════════════════ */
  const reveals = $$('.reveal')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-visible'))
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    )
    reveals.forEach((el, i) => {
      el.style.transitionDelay = (i % 4) * 70 + 'ms'
      io.observe(el)
    })
  }

  /* ════════════════════════════════════════════════════════════════════
     9. EN-TÊTE + LIGNE ACTIVE DANS LE MENU (au défilement)
     ════════════════════════════════════════════════════════════════════ */
  const navLinks = $$('.nav ul a')
  const sections = navLinks
    .map((a) => $(a.getAttribute('href')))
    .filter(Boolean)

  let ticking = false

  function onScroll() {
    header?.classList.toggle('is-scrolled', window.scrollY > 12)

    const threshold = window.scrollY + (header ? header.offsetHeight : 70) + 90
    let activeId = null
    sections.forEach((section) => {
      if (section.offsetTop <= threshold) activeId = '#' + section.id
    })
    navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === activeId))

    ticking = false
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll) }
  }, { passive: true })

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setNav(false)
  })

  onScroll()

  /* ════════════════════════════════════════════════════════════════════
     10. DIVERS
     ════════════════════════════════════════════════════════════════════ */
  // Équipe : on masque les fiches pas encore remplies (nom vide ou
  // « À compléter ») pour ne montrer que les vrais membres.
  const members = $$('.member')
  members.forEach((m) => {
    const nom = (m.querySelector('h4')?.textContent || '').trim()
    if (!nom || /^à compléter$/i.test(nom)) m.hidden = true
  })
  if (members.length && members.every((m) => m.hidden)) {
    $('.team__title')?.setAttribute('hidden', '')
  }

  const year = $('#year')
  if (year) year.textContent = String(new Date().getFullYear())
})()
