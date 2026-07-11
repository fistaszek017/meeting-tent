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

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

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
  function renderPeople() {
    peopleList.innerHTML = '';
    // klasa A na górze, w obrębie klasy zachowana kolejność dodania (sort jest stabilny)
    const ordered = state.people
      .slice()
      .sort((a, b) => (a.cls === 'A' ? 0 : 1) - (b.cls === 'A' ? 0 : 1));
    for (const p of ordered) {
      const li = document.createElement('li');
      li.className = 'person' + (p.disabled ? ' disabled' : '') + (p.cls === 'A' ? ' is-a' : '');
      li.title = p.disabled
        ? 'Kliknij, aby przywrócić do losowania'
        : 'Kliknij, aby wyłączyć z najbliższego losowania';

      const dot = document.createElement('span');
      dot.className = 'dot';

      const cls = document.createElement('span');
      cls.className = 'p-class cls-' + p.cls;
      cls.textContent = p.cls;
      cls.title = 'Klasa ' + p.cls + ' — kliknij, aby zmienić';
      cls.addEventListener('click', (e) => {
        e.stopPropagation();
        p.cls = p.cls === 'A' ? 'U' : 'A';
        save();
        renderAll();
      });

      const name = document.createElement('span');
      name.className = 'p-name';
      name.textContent = p.name;

      li.append(dot, cls, name);

      if (p.disabled) {
        const tag = document.createElement('span');
        tag.className = 'p-tag';
        tag.textContent = 'pominięty';
        li.append(tag);
      }

      const rm = document.createElement('button');
      rm.className = 'p-remove';
      rm.textContent = '✕';
      rm.title = 'Usuń z listy na stałe';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Usunąć „${p.name}” z listy na stałe?`)) return;
        state.people = state.people.filter((x) => x.id !== p.id);
        state.pairs = state.pairs.filter((pr) => !pr.includes(p.id));
        save();
        renderAll();
      });
      li.append(rm);

      li.addEventListener('click', () => {
        p.disabled = !p.disabled;
        save();
        renderAll();
      });

      peopleList.append(li);
    }

    const active = state.people.filter((p) => !p.disabled).length;
    countBadge.textContent = state.people.length
      ? `${active} aktywnych / ${state.people.length}`
      : '';
    emptyInfo.hidden = state.people.length > 0;
    btnClear.hidden = state.people.length === 0;
  }

  // ---------- ustalone pary ----------
  function renderPairSelects() {
    const takenIds = new Set(state.pairs.flat());
    const options = state.people.filter((p) => !takenIds.has(p.id));
    for (const sel of [pairA, pairB]) {
      sel.innerHTML = '<option value="">— wybierz osobę —</option>';
      for (const p of options) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        sel.append(opt);
      }
    }
  }

  function renderPairs() {
    pairsList.innerHTML = '';
    for (const [a, b] of state.pairs) {
      const pa = personById(a);
      const pb = personById(b);
      if (!pa || !pb) continue;
      const li = document.createElement('li');
      li.className = 'pair-item';
      li.innerHTML = `<span class="pair-name">${pa.name}</span>
        <span class="pair-amp">&amp;</span>
        <span class="pair-name">${pb.name}</span>`;
      const rm = document.createElement('button');
      rm.className = 'pair-remove';
      rm.textContent = '✕';
      rm.title = 'Rozłącz parę';
      rm.addEventListener('click', () => {
        state.pairs = state.pairs.filter((pr) => pr !== undefined && !(pr[0] === a && pr[1] === b));
        save();
        renderAll();
      });
      li.append(rm);
      pairsList.append(li);
    }
    pairsEmpty.hidden = state.pairs.length > 0;
  }

  btnPair.addEventListener('click', () => {
    const a = pairA.value;
    const b = pairB.value;
    if (!a || !b || a === b) return;
    state.pairs.push([a, b]);
    save();
    renderAll();
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
    resultsEl.innerHTML = '';

    const cards = groups.map((group, i) => {
      const card = document.createElement('div');
      card.className = 'result-card' + (group.length > 2 ? ' trio' : '');
      card.innerHTML = `<div class="pair-no">Para ${i + 1}</div>
        <div class="result-names"><span class="shuffling"></span></div>`;
      resultsEl.append(card);
      return card;
    });

    // krótka animacja: migające losowe imiona, potem odsłanianie kart po kolei
    const spinMs = 900;
    const spinInterval = setInterval(() => {
      for (const card of cards) {
        const el = card.querySelector('.shuffling');
        if (!el) continue;
        const a = activeNames[Math.floor(Math.random() * activeNames.length)];
        const b = activeNames[Math.floor(Math.random() * activeNames.length)];
        el.textContent = `${a} & ${b}`;
      }
    }, 70);

    setTimeout(() => {
      clearInterval(spinInterval);
      cards.forEach((card, i) => {
        setTimeout(() => {
          const names = groups[i]
            .map((n) => `<span>${n}</span>`)
            .join('<span class="amp">&amp;</span>');
          card.querySelector('.result-names').innerHTML = names;
          card.classList.add('revealed');

          if (i === cards.length - 1) {
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
        }, i * 220);
      });
    }, spinMs);
  }

  btnDraw.addEventListener('click', drawPairs);

  // ---------- render ----------
  function renderAll() {
    renderPeople();
    renderPairSelects();
    renderPairs();

    const active = state.people.filter((p) => !p.disabled).length;
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

  load();
  renderAll();
})();
