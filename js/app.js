(() => {
  'use strict';

  const STORAGE_KEY = 'meeting-tent-state-v1';

  /** @type {{people: {id:string, name:string, cls:'A'|'U', disabled:boolean}[], pairs: [string,string][]}} */
  let state = { people: [], pairs: [] };

  const normClass = (v) => (String(v || '').trim().toUpperCase().startsWith('A') ? 'A' : 'U');

  // ---------- elementy ----------
  const $ = (sel) => document.querySelector(sel);
  const tabs = document.querySelectorAll('.tab-btn');
  const views = { draw: $('#view-draw'), manage: $('#view-manage') };
  const csvInput = $('#csv-input');
  const addForm = $('#add-form');
  const addName = $('#add-name');
  const addClass = $('#add-class');
  const peopleList = $('#people-list');
  const emptyInfo = $('#empty-info');
  const countBadge = $('#count-badge');
  const btnClear = $('#btn-clear');
  const secretToggle = $('#secret-toggle');
  const secretPanel = $('#secret-panel');
  const pairA = $('#pair-a');
  const pairB = $('#pair-b');
  const btnPair = $('#btn-pair');
  const pairsList = $('#pairs-list');
  const pairsEmpty = $('#pairs-empty');
  const btnDraw = $('#btn-draw');
  const drawStatus = $('#draw-status');
  const drawNote = $('#draw-note');
  const resultsEl = $('#results');

  let drawing = false;

  // ---------- localStorage ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.people)) {
        state.people = data.people.map((p) => ({ ...p, cls: normClass(p.cls) }));
      }
      if (Array.isArray(data.pairs)) state.pairs = data.pairs;
    } catch { /* uszkodzone dane — start od zera */ }
  }

  // zapis buforowany — łączy wiele szybkich zmian w jeden zapis do localStorage
  let saveTimer = null;
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* np. brak miejsca */ }
  }
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 300);
  }
  // gwarancja zapisania przy opuszczeniu / ukryciu karty
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

  // ---------- pomocnicze ----------
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function personById(id) {
    return state.people.find((p) => p.id === id);
  }

  function pairOf(id) {
    return state.pairs.find((pr) => pr.includes(id));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- zakładki ----------
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.toggle('active', b === btn));
      Object.entries(views).forEach(([name, el]) =>
        el.classList.toggle('active', name === btn.dataset.view)
      );
    });
  });

  // ---------- CSV ----------
  function parseCsv(text) {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = line.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, '').trim());
      const name = cells[0];
      if (!name) continue;
      rows.push({ name, cls: normClass(cells[1]) });
    }
    // pomiń nagłówek typu "imie"/"name" (+ ewentualna kolumna "klasa"/"class")
    if (rows.length && /^(imi[eę]|imi[eę] i nazwisko|name|osoba|uczestnik)$/i.test(rows[0].name)) {
      rows.shift();
    }
    return rows;
  }

  csvInput.addEventListener('change', () => {
    const file = csvInput.files && csvInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result));
      let added = 0;
      const existing = new Set(state.people.map((p) => p.name.toLowerCase()));
      for (const { name, cls } of rows) {
        if (existing.has(name.toLowerCase())) continue;
        existing.add(name.toLowerCase());
        state.people.push({ id: uid(), name, cls, disabled: false });
        added++;
      }
      save();
      renderAll();
      drawStatus.textContent = added
        ? `Wczytano ${added} ${added === 1 ? 'osobę' : added < 5 ? 'osoby' : 'osób'} z pliku.`
        : 'Wszystkie osoby z pliku już są na liście.';
      csvInput.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  });

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = addName.value.trim();
    if (!name) return;
    if (state.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      addName.value = '';
      return;
    }
    state.people.push({ id: uid(), name, cls: normClass(addClass.value), disabled: false });
    addName.value = '';
    save();
    renderAll();
  });

  btnClear.addEventListener('click', () => {
    if (!confirm('Usunąć całą listę uczestników i ustalone pary?')) return;
    state = { people: [], pairs: [] };
    save();
    renderAll();
  });

  // ---------- lista uczestników ----------
  const disableTitle = (disabled) =>
    disabled ? 'Kliknij, aby przywrócić do losowania' : 'Kliknij, aby wyłączyć z najbliższego losowania';

  function renderPeople() {
    // klasa A na górze, w obrębie klasy zachowana kolejność dodania (sort jest stabilny)
    const ordered = state.people
      .slice()
      .sort((a, b) => (a.cls === 'A' ? 0 : 1) - (b.cls === 'A' ? 0 : 1));

    const frag = document.createDocumentFragment();
    for (const p of ordered) {
      const li = document.createElement('li');
      li.className = 'person' + (p.disabled ? ' disabled' : '') + (p.cls === 'A' ? ' is-a' : '');
      li.dataset.id = p.id;
      li.title = disableTitle(p.disabled);

      const dot = document.createElement('span');
      dot.className = 'dot';

      const cls = document.createElement('span');
      cls.className = 'p-class cls-' + p.cls;
      cls.dataset.role = 'class';
      cls.textContent = p.cls;
      cls.title = 'Klasa ' + p.cls + ' — kliknij, aby zmienić';

      const name = document.createElement('span');
      name.className = 'p-name';
      name.textContent = p.name;

      // etykieta zawsze obecna, pokazywana przez CSS gdy .person.disabled
      const tag = document.createElement('span');
      tag.className = 'p-tag';
      tag.textContent = 'pominięty';

      const rm = document.createElement('button');
      rm.className = 'p-remove';
      rm.dataset.role = 'remove';
      rm.type = 'button';
      rm.textContent = '✕';
      rm.title = 'Usuń z listy na stałe';

      li.append(dot, cls, name, tag, rm);
      frag.append(li);
    }
    peopleList.replaceChildren(frag);
  }

  // jeden nasłuchiwacz dla całej listy (delegacja) — bez odtwarzania listenerów przy renderze
  peopleList.addEventListener('click', (e) => {
    const li = e.target.closest('.person');
    if (!li) return;
    const p = personById(li.dataset.id);
    if (!p) return;

    // usunięcie na stałe
    if (e.target.closest('[data-role="remove"]')) {
      if (!confirm(`Usunąć „${p.name}” z listy na stałe?`)) return;
      state.people = state.people.filter((x) => x.id !== p.id);
      state.pairs = state.pairs.filter((pr) => !pr.includes(p.id));
      save();
      renderPeople();
      renderPairSelects();
      renderPairs();
      updateCounts();
      return;
    }

    // zmiana klasy — wymaga przesortowania listy (rzadka akcja)
    if (e.target.closest('[data-role="class"]')) {
      p.cls = p.cls === 'A' ? 'U' : 'A';
      save();
      renderPeople();
      updateCounts();
      return;
    }

    // najczęstsza akcja: wyłączenie/przywrócenie — aktualizacja w miejscu, bez przebudowy
    p.disabled = !p.disabled;
    save();
    li.classList.toggle('disabled', p.disabled);
    li.title = disableTitle(p.disabled);
    updateCounts();
  });

  function updateCounts() {
    const active = state.people.filter((p) => !p.disabled).length;
    countBadge.textContent = state.people.length
      ? `${active} aktywnych / ${state.people.length}`
      : '';
    emptyInfo.hidden = state.people.length > 0;
    btnClear.hidden = state.people.length === 0;

    if (!drawing) {
      btnDraw.disabled = active < 2;
      if (state.people.length === 0) {
        drawStatus.textContent = 'Wczytaj uczestników w zakładce „Uczestnicy”, aby rozpocząć.';
      } else if (active < 2) {
        drawStatus.textContent = 'Za mało aktywnych uczestników — potrzeba co najmniej dwóch.';
      } else {
        drawStatus.textContent = `Gotowych do losowania: ${active}.`;
      }
    }
  }

  // ---------- ustalone pary ----------
  function renderPairSelects() {
    const takenIds = new Set(state.pairs.flat());
    const options = state.people.filter((p) => !takenIds.has(p.id));
    for (const sel of [pairA, pairB]) {
      const prev = sel.value;
      const frag = document.createDocumentFragment();
      const first = document.createElement('option');
      first.value = '';
      first.textContent = '— wybierz osobę —';
      frag.append(first);
      for (const p of options) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        frag.append(opt);
      }
      sel.replaceChildren(frag);
      // zachowaj wybór, jeśli nadal dostępny
      if (prev && options.some((p) => p.id === prev)) sel.value = prev;
    }
  }

  function renderPairs() {
    const frag = document.createDocumentFragment();
    for (const [a, b] of state.pairs) {
      const pa = personById(a);
      const pb = personById(b);
      if (!pa || !pb) continue;
      const li = document.createElement('li');
      li.className = 'pair-item';
      li.dataset.a = a;
      li.dataset.b = b;
      li.innerHTML = `<span class="pair-name">${pa.name}</span>
        <span class="pair-amp">&amp;</span>
        <span class="pair-name">${pb.name}</span>`;
      const rm = document.createElement('button');
      rm.className = 'pair-remove';
      rm.dataset.role = 'pair-remove';
      rm.type = 'button';
      rm.textContent = '✕';
      rm.title = 'Rozłącz parę';
      li.append(rm);
      frag.append(li);
    }
    pairsList.replaceChildren(frag);
    pairsEmpty.hidden = state.pairs.length > 0;
  }

  // delegacja dla listy par
  pairsList.addEventListener('click', (e) => {
    const li = e.target.closest('.pair-item');
    if (!li || !e.target.closest('[data-role="pair-remove"]')) return;
    const { a, b } = li.dataset;
    state.pairs = state.pairs.filter((pr) => !(pr[0] === a && pr[1] === b));
    save();
    renderPairSelects();
    renderPairs();
  });

  btnPair.addEventListener('click', () => {
    const a = pairA.value;
    const b = pairB.value;
    if (!a || !b || a === b) return;
    state.pairs.push([a, b]);
    save();
    renderPairSelects();
    renderPairs();
  });

  secretToggle.addEventListener('click', () => {
    secretPanel.hidden = !secretPanel.hidden;
    secretToggle.classList.toggle('open', !secretPanel.hidden);
  });

  // ---------- losowanie ----------
  function computeDraw() {
    const active = state.people.filter((p) => !p.disabled);
    const activeIds = new Set(active.map((p) => p.id));
    const isA = (p) => p.cls === 'A';

    const groups = []; // grupy obiektów osób
    const used = new Set();

    // pary wymuszone — tylko gdy obie osoby aktywne
    for (const [a, b] of state.pairs) {
      if (activeIds.has(a) && activeIds.has(b)) {
        groups.push([personById(a), personById(b)]);
        used.add(a);
        used.add(b);
      }
    }

    // reszta losowo
    const rest = shuffle(active.filter((p) => !used.has(p.id)));
    while (rest.length >= 2) {
      const a = rest.pop();
      const b = rest.pop();
      groups.push([a, b]);
    }

    let note = '';
    if (rest.length === 1) {
      // nieparzysta liczba — dołącz do pary jako trójka.
      // Trójka musi zawierać co najmniej jedną osobę z klasą A.
      const lonely = rest.pop();
      const pairs = groups.filter((g) => g.length === 2);
      if (pairs.length) {
        // pary, do których dołączenie utworzy trójkę z klasą A
        const candidates = isA(lonely) ? pairs : pairs.filter((g) => g.some(isA));
        if (candidates.length) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          target.push(lonely);
          note = `Nieparzysta liczba uczestników — ${lonely.name} dołącza do trójki (z osobą klasy A).`;
        } else {
          // brak jakiejkolwiek osoby z klasą A wśród aktywnych — nie da się spełnić warunku
          const target = pairs[Math.floor(Math.random() * pairs.length)];
          target.push(lonely);
          note = `Nieparzysta liczba uczestników — ${lonely.name} dołącza jako trzecia osoba. Uwaga: brak osoby z klasą A, więc trójka nie zawiera klasy A.`;
        }
      } else {
        groups.push([lonely]);
        note = `${lonely.name} pozostaje bez pary — za mało uczestników.`;
      }
    }

    const named = shuffle(groups).map((g) => g.map((p) => p.name));
    return { groups: named, note };
  }

  function drawPairs() {
    if (drawing) return;
    const activeNames = state.people.filter((p) => !p.disabled).map((p) => p.name);
    if (activeNames.length < 2) return;

    drawing = true;
    btnDraw.disabled = true;
    drawNote.hidden = true;
    drawStatus.textContent = 'Ogień losuje…';

    const { groups, note } = computeDraw();

    resultsEl.hidden = false;

    // każda osoba to osobna karta; osoby w jednej grupie łączy znak "&"
    const frag = document.createDocumentFragment();
    const groupData = [];
    for (const group of groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'pair-group' + (group.length > 2 ? ' trio' : '') + (group.length < 2 ? ' solo' : '');
      const nameNodes = [];
      group.forEach((personName, idx) => {
        if (idx > 0) {
          const link = document.createElement('span');
          link.className = 'link';
          link.textContent = '&';
          groupEl.append(link);
        }
        const card = document.createElement('div');
        card.className = 'person-card';
        const nameEl = document.createElement('span');
        nameEl.className = 'card-name';
        card.append(nameEl);
        groupEl.append(card);
        nameNodes.push({ el: nameEl, finalName: personName });
      });
      frag.append(groupEl);
      groupData.push({ el: groupEl, names: nameNodes });
    }
    resultsEl.replaceChildren(frag);

    const allNameNodes = groupData.flatMap((g) => g.names);

    // krótka animacja: w każdej karcie migają losowe imiona
    const spinInterval = setInterval(() => {
      for (const n of allNameNodes) {
        n.el.textContent = activeNames[Math.floor(Math.random() * activeNames.length)];
      }
    }, 70);

    const spinMs = 900;
    setTimeout(() => {
      clearInterval(spinInterval);
      groupData.forEach((g, i) => {
        setTimeout(() => {
          for (const n of g.names) n.el.textContent = n.finalName;
          g.el.classList.add('revealed');

          if (i === groupData.length - 1) {
            // koniec losowania: jednorazowe wyłączenia wracają do puli
            state.people.forEach((p) => { p.disabled = false; });
            save();
            drawing = false;
            renderAll();
            drawStatus.textContent = 'Pary wylosowane! Wyłączeni uczestnicy wrócili do puli.';
            if (note) {
              drawNote.textContent = note;
              drawNote.hidden = false;
            }
          }
        }, i * 180);
      });
    }, spinMs);
  }

  btnDraw.addEventListener('click', drawPairs);

  // ---------- render ----------
  function renderAll() {
    renderPeople();
    renderPairSelects();
    renderPairs();
    updateCounts();
  }

  load();
  renderAll();
})();
