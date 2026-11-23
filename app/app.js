/*
 * Studiedashboard - schermen en bediening
 * ----------------------------------------------------------------
 * Gebruikt de kernlogica uit core.js (window.SD). Alle tekst van de
 * gebruiker wordt via textContent in de pagina gezet, nooit als HTML,
 * zodat een vreemd back-upbestand geen code kan uitvoeren.
 */
(function () {
  'use strict';

  var SD = window.SD;

  /* ---------------- Opslag kiezen ---------------- */

  // Valt terug op tijdelijk geheugen als de browser opslag blokkeert.
  function pickStorage() {
    try {
      var s = window.localStorage;
      var k = '__studiedashboard_test__';
      s.setItem(k, '1');
      s.removeItem(k);
      return { storage: s, persistent: true };
    } catch (e) {
      var mem = {};
      return {
        persistent: false,
        storage: {
          getItem: function (key) { return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null; },
          setItem: function (key, v) { mem[key] = String(v); },
          removeItem: function (key) { delete mem[key]; }
        }
      };
    }
  }

  var picked = pickStorage();
  var storage = picked.storage;

  var state = {
    data: null,
    view: 'overzicht',
    taskFilter: { show: 'open', courseId: '', query: '', sort: 'deadline' },
    noteFilter: { courseId: '', query: '' },
    weekOffset: 0,
    saveError: null
  };

  /* ---------------- DOM-hulp ---------------- */

  /**
   * Maakt een element. attrs: gewone attributen, plus
   *  - text: tekstinhoud (veilig)
   *  - on: { click: fn }
   *  - style: object met CSS-variabelen/eigenschappen
   */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'style') Object.keys(v).forEach(function (p) { el.style.setProperty(p, v[p]); });
      else if (k === 'class') el.className = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
  function $(id) { return document.getElementById(id); }

  function now() { return new Date(); }

  function courseById(id) {
    if (!id) return null;
    for (var i = 0; i < state.data.courses.length; i++) if (state.data.courses[i].id === id) return state.data.courses[i];
    return null;
  }

  /* ---------------- Opslaan ---------------- */

  function commit(message, undoSnapshot) {
    var r = SD.saveData(storage, state.data);
    state.saveError = r.ok ? null : r.error;
    render();
    if (message) toast(message, undoSnapshot);
  }

  function snapshot() { return JSON.parse(JSON.stringify(state.data)); }

  /* ---------------- Meldingen ---------------- */

  var toastTimer = null;
  function toast(message, undoSnapshot) {
    var t = $('toast');
    t.textContent = '';
    append(t, h('span', { text: message }));
    if (undoSnapshot) {
      append(t, h('button', {
        type: 'button', text: 'Ongedaan maken',
        on: { click: function () { state.data = undoSnapshot; t.hidden = true; commit('Hersteld'); } }
      }));
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, undoSnapshot ? 7000 : 2600);
  }

  var startupNotice = null;
  var fileTipClosed = false;
  var iosTipClosed = false;
  /** iPhone/iPad in een gewoon Safari-tabblad (niet via het beginscherm-icoon). */
  function isIosBrowserTab() {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return ios && !standalone && location.protocol === 'https:';
  }
  var WEB_URL = 'https://ji358mmy.github.io/Studiedashboard/';

  function renderBanner() {
    var b = $('banner');
    b.textContent = '';
    b.className = 'banner';
    var msg = null, isError = false, actions = [];
    if (state.saveError) {
      msg = state.saveError; isError = true;
      actions.push(h('button', { type: 'button', class: 'btn small', text: 'Back-up maken', on: { click: exportBackup } }));
    } else if (!picked.persistent) {
      msg = 'Je browser staat opslaan hier niet toe (bijvoorbeeld in een privévenster). Wijzigingen verdwijnen als je dit venster sluit.';
      isError = true;
    } else if (startupNotice) {
      msg = startupNotice;
      actions.push(h('button', { type: 'button', class: 'btn small', text: 'Sluiten', on: { click: function () { startupNotice = null; renderBanner(); } } }));
    } else if (location.protocol === 'file:' && !fileTipClosed) {
      msg = 'Tip: gebruik de webversie. Safari bewaart de gegevens van een los bestand niet altijd, en alleen in de webversie komen je deadlines automatisch binnen.';
      actions.push(h('a', { class: 'btn small', href: WEB_URL, text: 'Open webversie' }));
      actions.push(h('button', { type: 'button', class: 'btn small', text: 'Sluiten', on: { click: function () { fileTipClosed = true; renderBanner(); } } }));
    } else if (isIosBrowserTab() && !iosTipClosed) {
      msg = 'Je opent het dashboard nu in Safari. Gebruik liever het icoon op je beginscherm: Safari en het icoon bewaren hun gegevens apart.';
      actions.push(h('button', { type: 'button', class: 'btn small', text: 'Sluiten', on: { click: function () { iosTipClosed = true; renderBanner(); } } }));
    } else if (SD.backupDue(state.data.settings, now())) {
      msg = 'Tijd voor een back-up van je gegevens.';
      actions.push(h('button', { type: 'button', class: 'btn small', text: 'Back-up maken', on: { click: exportBackup } }));
    }
    if (!msg) { b.hidden = true; return; }
    if (isError) b.classList.add('error');
    append(b, h('span', { text: msg }), h('span', { class: 'actions' }, actions));
    b.hidden = false;
  }

  /* ---------------- Thema ---------------- */

  var THEME_LABEL = { auto: 'Weergave: automatisch', licht: 'Weergave: licht', donker: 'Weergave: donker' };
  function applyTheme() {
    var t = state.data.settings.theme;
    document.documentElement.setAttribute('data-theme', t);
    $('theme-label').textContent = THEME_LABEL[t] || THEME_LABEL.auto;
  }

  /* ---------------- Gedeelde onderdelen ---------------- */

  var STATUS_LABEL = { 'te-laat': 'Te laat', urgent: 'Urgent', binnenkort: 'Binnenkort', later: '', af: 'Af', 'geen-datum': '' };


  /** Uitleg van een opdracht (uit de deadlinelijst): regels, '- ' wordt een lijst, '## ' een kopje. */
  function instructionsBlock(text) {
    var out = [], list = null;
    text.split('\n').forEach(function (line) {
      var l = line.trim();
      if (!l) { list = null; return; }
      if (/^- /.test(l)) {
        if (!list) { list = h('ul'); out.push(list); }
        append(list, h('li', null, mdInline(l.slice(2))));
        return;
      }
      list = null;
      if (/^## /.test(l)) out.push(h('h4', null, mdInline(l.slice(3))));
      else out.push(h('p', null, mdInline(l)));
    });
    return h('div', { class: 'task-instr-body' }, out);
  }

  function taskItem(task, opts) {
    opts = opts || {};
    var n = now();
    var st = SD.taskStatus(task, n, state.data.settings.urgentDays);
    var course = courseById(task.courseId);
    var check = h('input', {
      type: 'checkbox', class: 'check', checked: task.done,
      'aria-label': (task.done ? 'Markeer als niet af: ' : 'Markeer als af: ') + task.title,
      on: { change: function () { toggleTask(task.id); } }
    });

    var meta = h('div', { class: 'task-meta' },
      STATUS_LABEL[st] ? h('span', { class: 'pill ' + st, text: STATUS_LABEL[st] }) : null,
      task.due ? h('span', { text: SD.formatDue(task.due) + (task.done ? '' : ' · ' + SD.relativeDue(task.due, n)) }) : h('span', { text: 'Geen deadline' }),
      course ? h('span', { style: { '--course-color': course.color } }, h('span', { class: 'dot' }), ' ', course.name) : null,
      task.priority === 'hoog' && !task.done ? h('span', { class: 'pill prio-hoog', text: 'Hoge prioriteit' }) : null,
      task.example ? h('span', { class: 'pill example', text: 'Voorbeeld' }) : null,
      task.source === 'brightspace' ? h('span', { class: 'pill example', title: 'Automatisch toegevoegd uit Brightspace', text: 'Brightspace' }) : null
    );

    var actions = h('div', { class: 'task-actions' },
      task.url ? h('a', { class: 'icon-btn', href: task.url, target: '_blank', rel: 'noopener noreferrer', title: 'Open in Brightspace', 'aria-label': 'Open ' + task.title + ' in Brightspace', text: '↗' }) : null,
      h('button', { type: 'button', class: 'icon-btn', title: 'Bewerken', 'aria-label': 'Bewerk ' + task.title, text: '✎', on: { click: function () { openTaskDialog(task); } } }),
      opts.compact ? null : h('button', { type: 'button', class: 'icon-btn', title: 'Verwijderen', 'aria-label': 'Verwijder ' + task.title, text: '🗑', on: { click: function () { deleteTask(task.id); } } })
    );

    return h('li', { class: 'task' + (task.done ? ' done' : ''), style: course ? { '--course-color': course.color } : null },
      check,
      h('div', { class: 'task-main' }, h('div', { class: 'task-title', text: task.title }), meta),
      actions,
      task.feed && task.feed.instructions && !task.done && !opts.compact
        ? h('details', { class: 'task-instr' }, h('summary', { text: 'Wat moet je maken?' }), instructionsBlock(task.feed.instructions.replace(/^## Wat moet je (maken|doen)\?\s*\n/, '')))
        : null
    );
  }

  function emptyBox(title, text, button) {
    return h('div', { class: 'empty' }, h('strong', { text: title }), h('span', { text: text }), button ? h('div', { style: { 'margin-top': '10px' } }, button) : null);
  }

  function pageHead(title, sub, actions) {
    return h('div', { class: 'page-head' },
      h('div', null, h('h1', { text: title }), sub ? h('p', { text: sub }) : null),
      actions ? h('div', { class: 'actions' }, actions) : null
    );
  }

  function courseSelect(value, includeAll, allLabel) {
    var sel = h('select', { class: 'input', name: 'courseId' });
    append(sel, h('option', { value: '', text: includeAll ? (allLabel || 'Alle vakken') : 'Geen vak' }));
    state.data.courses.forEach(function (c) {
      append(sel, h('option', { value: c.id, text: c.name, selected: c.id === value }));
    });
    return sel;
  }

  /* ---------------- Overzicht (startpagina) ---------------- */

  function greeting() {
    var hr = now().getHours();
    if (hr < 6) return 'Goedenacht';
    if (hr < 12) return 'Goedemorgen';
    if (hr < 18) return 'Goedemiddag';
    return 'Goedenavond';
  }

  function viewOverview() {
    var d = state.data, n = now();
    var urgent = SD.urgentTasks(d, n);
    var overdue = urgent.filter(function (t) { return SD.taskStatus(t, n, d.settings.urgentDays) === 'te-laat'; });
    var upcoming = SD.upcomingTasks(d, n, 6);
    var open = d.tasks.filter(function (t) { return !t.done; }).length;
    var ects = SD.ectsSummary(d);
    var avg = SD.weightedAverage(d.courses);
    var dayName = SD.DAYS_LONG[n.getDay()];

    var root = h('div');
    append(root, pageHead(greeting(),
      dayName.charAt(0).toUpperCase() + dayName.slice(1) + ' ' + n.getDate() + ' ' + SD.MONTHS[n.getMonth()] + ' · week ' + SD.isoWeek(n),
      [h('button', { type: 'button', class: 'btn primary', text: '+ Nieuwe taak', on: { click: function () { openTaskDialog(null); } } })]
    ));

    append(root, h('div', { class: 'stats' },
      h('div', { class: 'card stat' + (urgent.length ? ' alert' : '') }, h('div', { class: 'label', text: 'Urgent' }), h('div', { class: 'value', text: String(urgent.length) })),
      h('div', { class: 'card stat' }, h('div', { class: 'label', text: 'Open taken' }), h('div', { class: 'value', text: String(open) })),
      h('div', { class: 'card stat' }, h('div', { class: 'label', text: "EC's behaald" }), h('div', { class: 'value' }, SD.formatNumber(ects.earned), h('small', { text: ' / ' + SD.formatNumber(ects.total) }))),
      h('div', { class: 'card stat' }, h('div', { class: 'label', text: 'Gemiddeld cijfer' }), h('div', { class: 'value', text: avg === null ? '–' : SD.formatGrade(avg) }))
    ));

    // Nu belangrijk
    var focus = h('section', { class: 'card focus-card', 'aria-labelledby': 'focus-h' },
      h('div', { class: 'section-title' },
        h('h2', { id: 'focus-h', text: 'Nu belangrijk' }),
        h('span', { class: 'muted small', text: 'te laat of binnen ' + d.settings.urgentDays + (d.settings.urgentDays === 1 ? ' dag' : ' dagen') })
      )
    );
    if (overdue.length) {
      append(focus, h('p', { class: 'small', style: { color: 'var(--danger)', 'margin-top': '0' }, text: overdue.length === 1 ? '1 taak is over de deadline.' : overdue.length + ' taken zijn over de deadline.' }));
    }
    if (urgent.length) {
      append(focus, h('ul', { class: 'task-list' }, urgent.map(function (t) { return taskItem(t, { compact: true }); })));
    } else {
      append(focus, h('div', { class: 'calm' }, h('span', { text: '✓' }), h('span', { text: 'Niets urgents. Goed bezig.' })));
    }

    var next = h('section', { class: 'card', 'aria-labelledby': 'next-h' },
      h('div', { class: 'section-title' },
        h('h2', { id: 'next-h', text: 'Daarna' }),
        h('a', { href: '#taken', class: 'small', text: 'Alle taken' })
      )
    );
    if (upcoming.length) append(next, h('ul', { class: 'task-list' }, upcoming.map(function (t) { return taskItem(t, { compact: true }); })));
    else append(next, h('p', { class: 'muted small', text: 'Geen latere deadlines gepland.' }));

    var left = h('div', { class: 'grid' }, focus, next);

    // Voortgang per vak
    var prog = h('section', { class: 'card', 'aria-labelledby': 'prog-h' },
      h('div', { class: 'section-title' },
        h('h2', { id: 'prog-h', text: 'Voortgang per vak' }),
        h('a', { href: '#vakken', class: 'small', text: 'Vakken' })
      )
    );
    if (!d.courses.length) {
      append(prog, emptyBox('Nog geen vakken', 'Voeg je vakken toe om voortgang te zien.',
        h('button', { type: 'button', class: 'btn', text: '+ Vak toevoegen', on: { click: function () { openCourseDialog(null); } } })));
    } else {
      d.courses.forEach(function (c) {
        var p = SD.courseProgress(d, c.id);
        var passed = SD.isCoursePassed(c, d.settings.passGrade);
        append(prog, h('div', { class: 'course-row', style: { '--course-color': c.color } },
          h('div', { class: 'course-name' }, h('span', { class: 'dot' }), h('span', { text: c.name })),
          h('div', { class: 'muted small', text: p.total ? p.done + '/' + p.total + ' taken' : (passed ? 'Gehaald' : 'Geen taken') }),
          h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(passed && !p.total ? 100 : p.pct), 'aria-label': 'Voortgang ' + c.name },
            h('span', { style: { width: (passed && !p.total ? 100 : p.pct) + '%' } }))
        ));
      });
    }

    // Vastgepinde aantekeningen
    var pinned = d.notes.filter(function (x) { return x.pinned; }).slice(0, 3);
    var notesCard = null;
    if (pinned.length) {
      notesCard = h('section', { class: 'card', 'aria-labelledby': 'pin-h' },
        h('div', { class: 'section-title' }, h('h2', { id: 'pin-h', text: 'Vastgepind' }), h('a', { href: '#aantekeningen', class: 'small', text: 'Aantekeningen' })),
        pinned.map(function (nt) {
          return h('button', { type: 'button', class: 'mini-task', style: { 'margin-bottom': '6px', '--course-color': (courseById(nt.courseId) || {}).color || 'var(--border)' }, on: { click: function () { openNoteDialog(nt); } } },
            h('strong', { text: nt.title }), h('span', { class: 'time', text: nt.body.slice(0, 90) + (nt.body.length > 90 ? '…' : '') }));
        })
      );
    }

    append(root, h('div', { class: 'grid grid-2' }, left, h('div', { class: 'grid', style: { 'align-content': 'start' } }, prog, notesCard)));
    return root;
  }

  /* ---------------- Taken ---------------- */

  function viewTasks() {
    var d = state.data, f = state.taskFilter, n = now();
    var list = SD.sortTasks(SD.filterTasks(d.tasks, f, n, d.settings.urgentDays), f.sort);

    var root = h('div');
    append(root, pageHead('Taken', 'Deadlines en opdrachten, gesorteerd op wat het eerst moet.',
      [h('button', { type: 'button', class: 'btn primary', text: '+ Nieuwe taak', on: { click: function () { openTaskDialog(null); } } })]));

    var seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Toon' });
    [['open', 'Open'], ['urgent', 'Urgent'], ['af', 'Af'], ['alle', 'Alle']].forEach(function (o) {
      append(seg, h('button', {
        type: 'button', class: f.show === o[0] ? 'active' : '', 'aria-pressed': String(f.show === o[0]), text: o[1],
        on: { click: function () { f.show = o[0]; render(); } }
      }));
    });
    var courseSel = courseSelect(f.courseId, true);
    courseSel.setAttribute('aria-label', 'Filter op vak');
    courseSel.addEventListener('change', function () { f.courseId = courseSel.value; render(); });

    var sortSel = h('select', { class: 'input', 'aria-label': 'Sorteren' },
      h('option', { value: 'deadline', text: 'Sorteer: deadline', selected: f.sort === 'deadline' }),
      h('option', { value: 'prioriteit', text: 'Sorteer: prioriteit', selected: f.sort === 'prioriteit' }),
      h('option', { value: 'titel', text: 'Sorteer: naam', selected: f.sort === 'titel' })
    );
    sortSel.addEventListener('change', function () { f.sort = sortSel.value; render(); });

    var search = h('input', { type: 'search', class: 'input search', placeholder: 'Zoeken…', value: f.query, 'aria-label': 'Zoek in taken' });
    search.addEventListener('input', function () {
      f.query = search.value;
      var pos = search.selectionStart;
      render();
      var s2 = document.querySelector('.search');
      if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) { /* negeren */ } }
    });

    append(root, h('div', { class: 'filters' }, seg, courseSel, sortSel, search));

    if (!list.length) {
      var msg = d.tasks.length ? 'Geen taken die bij dit filter passen.' : 'Voeg je eerste deadline of opdracht toe.';
      append(root, emptyBox(d.tasks.length ? 'Niets gevonden' : 'Nog geen taken', msg,
        d.tasks.length ? null : h('button', { type: 'button', class: 'btn primary', text: '+ Nieuwe taak', on: { click: function () { openTaskDialog(null); } } })));
    } else {
      append(root, h('ul', { class: 'task-list' }, list.map(function (t) { return taskItem(t); })));
      var doneCount = d.tasks.filter(function (t) { return t.done; }).length;
      if (f.show === 'af' && doneCount) {
        append(root, h('div', { style: { 'margin-top': '12px' } },
          h('button', { type: 'button', class: 'btn danger small', text: 'Verwijder alle afgeronde taken', on: { click: clearDone } })));
      }
    }
    return root;
  }

  function toggleTask(id) {
    var t = state.data.tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
    commit(t.done ? 'Taak afgevinkt' : 'Taak weer open');
  }

  function deleteTask(id) {
    var before = snapshot();
    var t = state.data.tasks.find(function (x) { return x.id === id; });
    SD.rememberDismissed(state.data, t);
    state.data.tasks = state.data.tasks.filter(function (x) { return x.id !== id; });
    commit('Taak verwijderd', before);
  }

  function clearDone() {
    confirmDialog('Afgeronde taken verwijderen?', 'Alle taken die af zijn worden verwijderd. Je kunt dit direct daarna nog ongedaan maken.', 'Verwijderen', function () {
      var before = snapshot();
      state.data.tasks.forEach(function (t) { if (t.done) SD.rememberDismissed(state.data, t); });
      state.data.tasks = state.data.tasks.filter(function (t) { return !t.done; });
      commit('Afgeronde taken verwijderd', before);
    });
  }

  /* ---------------- Week ---------------- */

  // Lessen uit app/rooster.js (window.SD_ROOSTER), gesorteerd op begintijd.
  function roosterOnDay(key) {
    var R = window.SD_ROOSTER;
    if (!R || !R.lessons) return [];
    return R.lessons.filter(function (l) { return l && l.date === key && l.title; })
      .sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
  }

  function viewWeek() {
    var d = state.data, n = now();
    var ref = new Date(n.getFullYear(), n.getMonth(), n.getDate() + state.weekOffset * 7);
    var days = SD.weekDays(ref);
    var todayKey = SD.toLocalDate(n);
    var first = days[0], last = days[6];

    var root = h('div');
    append(root, pageHead('Week ' + SD.isoWeek(ref),
      first.getDate() + ' ' + SD.MONTHS[first.getMonth()] + ' – ' + last.getDate() + ' ' + SD.MONTHS[last.getMonth()] + ' ' + last.getFullYear(),
      [
        h('button', { type: 'button', class: 'btn', text: '‹ Vorige', on: { click: function () { state.weekOffset--; render(); } } }),
        h('button', { type: 'button', class: 'btn', text: 'Deze week', disabled: state.weekOffset === 0, on: { click: function () { state.weekOffset = 0; render(); } } }),
        h('button', { type: 'button', class: 'btn', text: 'Volgende ›', on: { click: function () { state.weekOffset++; render(); } } })
      ]));

    var grid = h('div', { class: 'week' });
    days.forEach(function (day, i) {
      var key = SD.toLocalDate(day);
      var tasks = SD.tasksOnDay(d.tasks, day);
      var col = h('div', { class: 'day' + (key === todayKey ? ' today' : '') + (i >= 5 ? ' weekend' : '') },
        h('div', { class: 'day-head' }, h('strong', { text: SD.DAYS_LONG[day.getDay()] }), h('span', { text: day.getDate() + ' ' + SD.MONTHS[day.getMonth()] })),
        roosterOnDay(key).map(function (l) {
          return h('div', { class: 'lesson', title: l.title + (l.location ? ' · ' + l.location : '') },
            h('span', { class: 'time', text: l.start + (l.end ? '–' + l.end : '') + (l.location ? ' · ' + l.location : '') }), l.title);
        }),
        tasks.map(function (t) {
          var c = courseById(t.courseId);
          var time = t.due.slice(11, 16);
          return h('button', {
            type: 'button', class: 'mini-task' + (t.done ? ' done' : ''), style: c ? { '--course-color': c.color } : null,
            title: t.title, on: { click: function () { openTaskDialog(t); } }
          }, h('span', { class: 'time', text: time === '23:59' ? (c ? c.name : 'Hele dag') : time + (c ? ' · ' + c.name : '') }), t.title);
        }),
        h('button', { type: 'button', class: 'add-day', 'aria-label': 'Taak toevoegen op ' + key, text: '+', on: { click: function () { openTaskDialog(null, key + 'T09:00'); } } })
      );
      append(grid, col);
    });
    append(root, grid);
    var R = window.SD_ROOSTER;
    append(root, h('p', { class: 'ls-foot', text: R && R.lessons && R.lessons.length
      ? 'Lessen uit je AvansOne-rooster (grijs), bijgewerkt: ' + R.updatedAt + '. Kijk bij wijzigingen altijd in AvansOne.'
      : 'Je rooster uit AvansOne komt hier zodra het is ingelezen.' }));

    var noDate = d.tasks.filter(function (t) { return !t.due && !t.done; });
    if (noDate.length) {
      append(root, h('section', { class: 'card', style: { 'margin-top': '16px' } },
        h('h2', { text: 'Zonder deadline' }),
        h('ul', { class: 'task-list' }, SD.sortTasks(noDate).map(function (t) { return taskItem(t, { compact: true }); }))));
    }
    return root;
  }

  /* ---------------- Vakken & cijfers ---------------- */

  function viewCourses() {
    var d = state.data;
    var ects = SD.ectsSummary(d);
    var avg = SD.weightedAverage(d.courses);
    var root = h('div');
    append(root, pageHead('Vakken & cijfers', "Voortgang, cijfers en studiepunten (EC's) per vak.",
      [h('button', { type: 'button', class: 'btn primary', text: '+ Nieuw vak', on: { click: function () { openCourseDialog(null); } } })]));

    append(root, h('div', { class: 'stats' },
      h('div', { class: 'card stat' }, h('div', { class: 'label', text: "EC's behaald" }), h('div', { class: 'value', text: SD.formatNumber(ects.earned) })),
      h('div', { class: 'card stat' }, h('div', { class: 'label', text: "EC's nog te halen" }), h('div', { class: 'value', text: SD.formatNumber(ects.remaining) })),
      h('div', { class: 'card stat' }, h('div', { class: 'label', text: 'Gewogen gemiddelde' }), h('div', { class: 'value', text: avg === null ? '–' : SD.formatGrade(avg) })),
      h('div', { class: 'card stat' }, h('div', { class: 'label', text: 'Vakken' }), h('div', { class: 'value', text: String(d.courses.length) }))
    ));

    if (!d.courses.length) {
      append(root, emptyBox('Nog geen vakken', 'Voeg een vak toe met het aantal EC\'s. Zodra je een cijfer invult, telt het mee.',
        h('button', { type: 'button', class: 'btn primary', text: '+ Nieuw vak', on: { click: function () { openCourseDialog(null); } } })));
      return root;
    }

    var cards = h('div', { class: 'course-cards' });
    d.courses.forEach(function (c) {
      var p = SD.courseProgress(d, c.id);
      var passed = SD.isCoursePassed(c, d.settings.passGrade);
      var gradeClass = typeof c.grade === 'number' ? (c.grade >= d.settings.passGrade ? 'pass' : 'fail') : '';
      var noteCount = d.notes.filter(function (x) { return x.courseId === c.id; }).length;
      append(cards, h('article', { class: 'card course-card', style: { '--course-color': c.color } },
        h('div', null,
          h('h3', { text: c.name }),
          h('div', { class: 'task-meta' },
            c.code ? h('span', { text: c.code }) : null,
            c.period ? h('span', { text: c.period }) : null,
            passed ? h('span', { class: 'pill af', text: 'Gehaald' }) : null,
            c.example ? h('span', { class: 'pill example', text: 'Voorbeeld' }) : null)
        ),
        h('div', { class: 'course-facts' },
          h('div', { class: 'fact' }, h('div', { class: 'label', text: 'Cijfer' }), h('div', { class: 'value ' + gradeClass, text: SD.formatGrade(c.grade) })),
          h('div', { class: 'fact' }, h('div', { class: 'label', text: "EC's" }), h('div', { class: 'value', text: SD.formatNumber(c.ects) })),
          h('div', { class: 'fact' }, h('div', { class: 'label', text: 'Taken af' }), h('div', { class: 'value', text: p.total ? p.done + '/' + p.total : '–' }))
        ),
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p.pct), 'aria-label': 'Taken af voor ' + c.name },
          h('span', { style: { width: p.pct + '%' } })),
        h('div', { class: 'foot' },
          h('span', { class: 'muted small' },
            h('a', { href: '#taken', text: p.open + ' open', on: { click: function () { state.taskFilter.courseId = c.id; state.taskFilter.show = 'open'; } } }),
            ' · ',
            h('a', { href: '#aantekeningen', text: noteCount + (noteCount === 1 ? ' aantekening' : ' aantekeningen'), on: { click: function () { state.noteFilter.courseId = c.id; } } })),
          h('span', null,
            h('button', { type: 'button', class: 'btn small ghost', text: '+ Taak', on: { click: function () { openTaskDialog({ courseId: c.id }); } } }),
            h('button', { type: 'button', class: 'btn small', text: 'Bewerken', on: { click: function () { openCourseDialog(c); } } }))
        )
      ));
    });
    append(root, cards);
    append(root, h('p', { class: 'muted small', style: { 'margin-top': '16px' }, text:
      "Een vak telt als gehaald bij een cijfer van " + SD.formatGrade(d.settings.passGrade) + " of hoger. Het gemiddelde is gewogen naar EC's. Bij vakken zonder cijfer (bijvoorbeeld 'voldaan') kun je 'gehaald' handmatig aanzetten." }));
    return root;
  }

  /* ---------------- Aantekeningen ---------------- */

  function viewNotes() {
    var d = state.data, f = state.noteFilter;
    var q = f.query.toLowerCase().trim();
    var list = d.notes.filter(function (n) {
      if (f.courseId && n.courseId !== f.courseId) return false;
      if (q && (n.title + ' ' + n.body).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    var root = h('div');
    append(root, pageHead('Aantekeningen', 'Afspraken, feedback en ideeën, per vak.',
      [h('button', { type: 'button', class: 'btn primary', text: '+ Nieuwe aantekening', on: { click: function () { openNoteDialog(null); } } })]));

    var sel = courseSelect(f.courseId, true);
    sel.setAttribute('aria-label', 'Filter op vak');
    sel.addEventListener('change', function () { f.courseId = sel.value; render(); });
    var search = h('input', { type: 'search', class: 'input search', placeholder: 'Zoeken…', value: f.query, 'aria-label': 'Zoek in aantekeningen' });
    search.addEventListener('input', function () {
      f.query = search.value; var pos = search.selectionStart; render();
      var s2 = document.querySelector('.search'); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) { /* negeren */ } }
    });
    append(root, h('div', { class: 'filters' }, sel, search));

    if (!list.length) {
      append(root, emptyBox(d.notes.length ? 'Niets gevonden' : 'Nog geen aantekeningen', d.notes.length ? 'Probeer een ander filter.' : 'Schrijf je eerste aantekening.'));
      return root;
    }
    append(root, h('div', { class: 'notes' }, list.map(function (n) {
      var c = courseById(n.courseId);
      return h('button', { type: 'button', class: 'card note', style: c ? { '--course-color': c.color } : null, on: { click: function () { openNoteDialog(n); } } },
        h('h3', { text: (n.pinned ? '📌 ' : '') + n.title }),
        n.body ? h('p', { text: n.body }) : null,
        h('div', { class: 'task-meta' },
          c ? h('span', null, h('span', { class: 'dot' }), ' ', c.name) : null,
          h('span', { text: 'Bijgewerkt ' + SD.formatDue(SD.toLocalDateTime(new Date(n.updatedAt))) }),
          n.example ? h('span', { class: 'pill example', text: 'Voorbeeld' }) : null)
      );
    })));
    return root;
  }

  /* ---------------- Instellingen ---------------- */

  function viewSettings() {
    var d = state.data, s = d.settings;
    // Altijd de actuele instellingen aanpassen: de gegevens kunnen intussen
    // vervangen zijn (bijvoorbeeld door nieuwe deadlines die binnenkwamen).
    function live() { return state.data.settings; }
    var root = h('div');
    append(root, pageHead('Instellingen', 'Weergave, back-ups en je gegevens.'));

    var themeSel = h('select', { class: 'input', 'aria-label': 'Weergave' },
      h('option', { value: 'auto', text: 'Automatisch (volgt je Mac)', selected: s.theme === 'auto' }),
      h('option', { value: 'licht', text: 'Licht', selected: s.theme === 'licht' }),
      h('option', { value: 'donker', text: 'Donker', selected: s.theme === 'donker' }));
    themeSel.addEventListener('change', function () { live().theme = themeSel.value; applyTheme(); commit('Weergave aangepast'); });

    var urgentSel = h('select', { class: 'input', 'aria-label': 'Urgent binnen' });
    [1, 2, 3, 5, 7, 14].forEach(function (n) { append(urgentSel, h('option', { value: String(n), text: n + (n === 1 ? ' dag' : ' dagen'), selected: s.urgentDays === n })); });
    urgentSel.addEventListener('change', function () { live().urgentDays = parseInt(urgentSel.value, 10); commit('Opgeslagen'); });

    var passInput = h('input', { class: 'input', style: { width: '80px' }, value: SD.formatGrade(s.passGrade), 'aria-label': 'Voldoende vanaf', inputmode: 'decimal' });
    passInput.addEventListener('change', function () {
      var g = SD.parseGrade(passInput.value);
      if (!g.ok || g.value === null) { toast(g.error || 'Vul een cijfer in.'); passInput.value = SD.formatGrade(s.passGrade); return; }
      live().passGrade = g.value; commit('Opgeslagen');
    });

    var remindSel = h('select', { class: 'input', 'aria-label': 'Back-upherinnering' });
    [[0, 'Uit'], [7, 'Elke week'], [14, 'Elke 2 weken'], [30, 'Elke maand']].forEach(function (o) {
      append(remindSel, h('option', { value: String(o[0]), text: o[1], selected: s.backupReminderDays === o[0] }));
    });
    remindSel.addEventListener('change', function () { live().backupReminderDays = parseInt(remindSel.value, 10); commit('Opgeslagen'); });

    var autoSel = h('select', { class: 'input', 'aria-label': 'Automatisch ophalen', disabled: !online() },
      h('option', { value: 'aan', text: 'Aan', selected: s.autoImport }),
      h('option', { value: 'uit', text: 'Uit', selected: !s.autoImport }));
    autoSel.addEventListener('change', function () { live().autoImport = autoSel.value === 'aan'; commit('Opgeslagen'); if (live().autoImport) fetchFeed(false); });

    append(root, h('div', { class: 'settings' },
      h('section', { class: 'card' },
        h('h2', { text: 'Weergave' }),
        row('Licht of donker', 'Automatisch volgt de instelling van je Mac.', themeSel),
        row('Urgent bij deadline binnen', 'Deze taken staan bovenaan op de startpagina.', urgentSel),
        row('Voldoende vanaf', "Vanaf dit cijfer telt een vak als gehaald en tellen de EC's mee.", passInput)
      ),
      h('section', { class: 'card' },
        h('h2', { text: 'Automatische deadlines' }),
        h('p', { class: 'muted small', style: { 'margin-top': '0' }, text: online()
          ? 'Nieuwe deadlines uit Brightspace komen vanzelf binnen als je de app opent. Afgevinkte taken en je eigen notities blijven van jou. Een taak die je verwijdert, komt niet terug.'
          : 'Werkt alleen als je de app via het webadres opent (zie de uitleg in README.md). In het bestand op je Mac werkt dit niet.' }),
        row('Automatisch ophalen', s.feedUpdatedAt ? 'Laatste lijst van: ' + formatStamp(s.feedUpdatedAt) : 'Nog geen lijst opgehaald.', autoSel),
        online() ? row('Nu ophalen', 'Haal direct de nieuwste deadlines op.', h('button', { type: 'button', class: 'btn', text: 'Ophalen', on: { click: function () { fetchFeed(true); } } })) : null
      ),
      h('section', { class: 'card' },
        h('h2', { text: 'Back-up' }),
        h('p', { class: 'muted small', style: { 'margin-top': '0' }, text:
          'Je gegevens worden automatisch bewaard in deze browser op deze Mac. Een back-up is een los bestand dat je zelf bewaart, bijvoorbeeld in iCloud Drive of OneDrive. Daarmee zet je alles terug op een andere browser of computer.' }),
        row('Back-up maken', s.lastBackup ? 'Laatste back-up: ' + SD.formatDue(SD.toLocalDateTime(new Date(s.lastBackup))) : 'Nog geen back-up gemaakt.',
          h('button', { type: 'button', class: 'btn primary', text: 'Download back-up', on: { click: exportBackup } })),
        row('Back-up terugzetten', 'Vervangt alle huidige gegevens door die uit het bestand.',
          h('button', { type: 'button', class: 'btn', text: 'Bestand kiezen…', on: { click: importBackup } })),
        row('Herinnering', 'Toon een melding als het tijd is voor een nieuwe back-up.', remindSel)
      ),
      h('section', { class: 'card' },
        h('h2', { text: 'Gegevens' }),
        row('Voorbeeldgegevens', SD.countExamples(d) ? SD.countExamples(d) + ' voorbeeld-items staan nog in je dashboard.' : 'Er staan geen voorbeelden meer in je dashboard.',
          SD.countExamples(d)
            ? h('button', { type: 'button', class: 'btn', text: 'Verwijder voorbeelden', on: { click: removeExamples } })
            : h('button', { type: 'button', class: 'btn', text: 'Voorbeelden terugzetten', on: { click: addExamples } })),
        row('Alles wissen', 'Begin helemaal opnieuw met een leeg dashboard.',
          h('button', { type: 'button', class: 'btn danger', text: 'Alles wissen…', on: { click: wipeAll } }))
      ),
      h('p', { class: 'muted small', text: 'Studiedashboard is een persoonlijk hulpmiddel en geen officiële app van Avans Hogeschool. Controleer deadlines altijd in Brightspace.' })
    ));
    return root;

    function row(title, text, control) {
      return h('div', { class: 'setting-row' }, h('div', null, h('strong', { text: title }), h('p', { text: text })), control);
    }
  }

  function online() {
    return location.protocol === 'https:' || location.hostname === 'localhost';
  }

  function formatStamp(iso) {
    var t = Date.parse(iso);
    return isNaN(t) ? iso : SD.formatDue(SD.toLocalDateTime(new Date(t)));
  }

  /**
   * Haalt deadlines.json op (staat naast de app op het webadres) en voegt
   * nieuwe of gewijzigde deadlines toe. Faalt stil als er geen internet is.
   */
  function fetchFeed(manual) {
    if (!online() || !window.fetch) return;
    fetch('deadlines.json?t=' + Date.now(), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(function (feed) {
      var r = SD.mergeFeed(state.data, feed);
      if (!r.ok) { if (manual) toast(r.error); return; }
      var changed = r.added + r.updated;
      var before = snapshot();
      state.data = r.data;
      if (changed) {
        var parts = [];
        if (r.added) parts.push(r.added + (r.added === 1 ? ' nieuwe deadline' : ' nieuwe deadlines'));
        if (r.updated) parts.push(r.updated + ' bijgewerkt');
        commit(parts.join(', ') + ' uit Brightspace', before);
      } else {
        commit(manual ? 'Alles is al bijgewerkt' : null);
      }
    }).catch(function () {
      if (manual) toast('Ophalen lukte niet. Heb je internet?');
    });
  }

  function exportBackup() {
    try {
      var n = now();
      var text = SD.exportData(state.data, n);
      var name = 'studiedashboard-backup-' + SD.toLocalDate(n) + '.json';

      // Op iPhone/iPad: deelmenu, zodat je kunt kiezen voor 'Bewaar in Bestanden' (iCloud Drive)
      var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (touch && typeof File === 'function' && navigator.canShare) {
        var file = new File([text], name, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'Studiedashboard back-up' }).then(function () {
            state.data.settings.lastBackup = new Date().toISOString();
            commit('Back-up gedeeld');
          }).catch(function (err) {
            if (!err || err.name !== 'AbortError') toast('Delen lukte niet. Probeer het nog eens.');
          });
          return;
        }
      }

      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = h('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
      state.data.settings.lastBackup = n.toISOString();
      commit('Back-up gedownload naar je map Downloads');
    } catch (e) {
      toast('Back-up maken is mislukt.');
    }
  }

  function importBackup() {
    var input = h('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { toast('Dit bestand is te groot voor een back-up.'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var r = SD.importData(String(reader.result || ''));
        if (!r.ok) { alertDialog('Terugzetten lukt niet', r.error); return; }
        var summary = r.data.tasks.length + ' taken, ' + r.data.courses.length + ' vakken en ' + r.data.notes.length + ' aantekeningen' +
          (r.dropped ? ' (' + r.dropped + ' onleesbare onderdelen overgeslagen)' : '') + '.';
        confirmDialog('Back-up terugzetten?', 'Het bestand bevat ' + summary + ' Je huidige gegevens worden vervangen.', 'Terugzetten', function () {
          var before = snapshot();
          state.data = r.data;
          applyTheme();
          commit('Back-up teruggezet', before);
        });
      };
      reader.onerror = function () { toast('Het bestand kon niet worden gelezen.'); };
      reader.readAsText(file);
    });
    input.click();
  }

  function removeExamples() {
    var before = snapshot();
    state.data = SD.removeExamples(state.data);
    commit('Voorbeelden verwijderd', before);
  }

  function addExamples() {
    var ex = SD.exampleData();
    var d = state.data;
    ex.courses.forEach(function (c) { if (!courseById(c.id)) d.courses.push(c); });
    ex.tasks.forEach(function (t) { if (!d.tasks.some(function (x) { return x.id === t.id; })) d.tasks.push(t); });
    ex.notes.forEach(function (n) { if (!d.notes.some(function (x) { return x.id === n.id; })) d.notes.push(n); });
    commit('Voorbeelden toegevoegd');
  }

  function wipeAll() {
    confirmDialog('Alles wissen?', 'Alle taken, vakken en aantekeningen worden verwijderd. Maak eerst een back-up als je twijfelt.', 'Alles wissen', function () {
      var before = snapshot();
      var settings = state.data.settings;
      state.data = SD.emptyData();
      state.data.settings = settings;
      commit('Alles gewist', before);
    });
  }

  /* ---------------- Dialogen ---------------- */

  var dialog = $('dialog');
  var hasDialog = typeof dialog.showModal === 'function';

  function openDialog(content) {
    dialog.textContent = '';
    append(dialog, content);
    if (hasDialog) { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
    var first = dialog.querySelector('[autofocus], input, textarea, select');
    if (first) first.focus();
  }
  function closeDialog() {
    if (hasDialog && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDialog(); });

  function field(label, control, opts) {
    opts = opts || {};
    var id = 'f-' + control.name;
    control.id = id;
    return h('div', { class: 'field', 'data-field': control.name },
      h('label', { for: id, text: label }),
      control,
      opts.hint ? h('span', { class: 'hint', text: opts.hint }) : null,
      h('span', { class: 'error', hidden: true })
    );
  }

  function showErrors(form, errors) {
    form.querySelectorAll('.field').forEach(function (f) {
      var err = errors[f.getAttribute('data-field')];
      var el = f.querySelector('.error');
      if (!el) return;
      f.classList.toggle('invalid', !!err);
      el.textContent = err || '';
      el.hidden = !err;
    });
    var firstBad = form.querySelector('.field.invalid .input');
    if (firstBad) firstBad.focus();
  }

  function dialogShell(title, body, footerLeft, submitLabel) {
    return h('form', { method: 'dialog', novalidate: true },
      h('header', null, h('h2', { id: 'dialog-title', text: title })),
      h('div', { class: 'body' }, body),
      h('footer', null, footerLeft || null,
        h('div', { class: 'right' },
          h('button', { type: 'button', class: 'btn', text: 'Annuleren', on: { click: closeDialog } }),
          h('button', { type: 'submit', class: 'btn primary', text: submitLabel || 'Opslaan' })))
    );
  }

  function openTaskDialog(task, presetDue) {
    var existing = task && task.id ? task : null;
    var t = existing || { title: '', courseId: (task && task.courseId) || '', due: presetDue || '', priority: 'normaal', notes: '' };
    var dueDate = t.due ? t.due.slice(0, 10) : '';
    var dueTime = t.due && t.due.slice(11, 16) !== '23:59' ? t.due.slice(11, 16) : '';

    var title = h('input', { class: 'input', name: 'title', value: t.title, maxlength: '200', autofocus: true, placeholder: 'Bijv. Verslag hoofdstuk 2 inleveren' });
    var date = h('input', { class: 'input', type: 'date', name: 'due', value: dueDate });
    var time = h('input', { class: 'input', type: 'time', name: 'time', value: dueTime });
    var course = courseSelect(t.courseId);
    var prio = h('select', { class: 'input', name: 'priority' },
      ['laag', 'normaal', 'hoog'].map(function (p) { return h('option', { value: p, text: p.charAt(0).toUpperCase() + p.slice(1), selected: t.priority === p }); }));
    var notes = h('textarea', { class: 'input', name: 'notes', placeholder: 'Wat moet je doen, waar staat de opdracht?' });
    notes.value = t.notes || '';

    var form = dialogShell(existing ? 'Taak bewerken' : 'Nieuwe taak',
      [
        field('Naam', title),
        h('div', { class: 'row' }, field('Deadline (datum)', date, { hint: 'Leeg laten mag.' }), field('Tijd', time, { hint: 'Leeg = einde van de dag.' })),
        h('div', { class: 'row' }, field('Vak', course), field('Prioriteit', prio)),
        field('Notities', notes),
        existing && existing.feed && existing.feed.instructions
          ? h('div', { class: 'task-instr open' }, h('strong', { text: 'Wat moet je maken? (uit Brightspace)' }), instructionsBlock(existing.feed.instructions))
          : null
      ],
      existing ? h('button', { type: 'button', class: 'btn danger', text: 'Verwijderen', on: { click: function () { closeDialog(); deleteTask(existing.id); } } }) : null
    );

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var due = date.value ? date.value + (time.value ? 'T' + time.value : '') : '';
      if (!date.value && time.value) { showErrors(form, { due: 'Kies ook een datum bij deze tijd.' }); return; }
      var input = {
        id: existing ? existing.id : undefined,
        title: title.value, due: due, courseId: course.value, priority: prio.value, notes: notes.value,
        done: existing ? existing.done : false, doneAt: existing ? existing.doneAt : null,
        createdAt: existing ? existing.createdAt : undefined, example: existing ? existing.example : false,
        source: existing ? existing.source : null, externalId: existing ? existing.externalId : null, url: existing ? existing.url : null,
        feed: existing ? existing.feed : null
      };
      var r = SD.validateTask(input, state.data.courses);
      if (!r.ok) { showErrors(form, r.errors); return; }
      SD.upsert(state.data.tasks, r.value);
      closeDialog();
      commit(existing ? 'Taak bijgewerkt' : 'Taak toegevoegd');
    });
    openDialog(form);
  }

  function openCourseDialog(course) {
    var c = course || { name: '', code: '', period: '', ects: '', grade: null, passed: 'auto', color: SD.COURSE_COLORS[state.data.courses.length % SD.COURSE_COLORS.length] };
    var name = h('input', { class: 'input', name: 'name', value: c.name, maxlength: '200', autofocus: true, placeholder: 'Bijv. Marketing Management' });
    var code = h('input', { class: 'input', name: 'code', value: c.code, maxlength: '40', placeholder: 'Bijv. MM2' });
    var period = h('input', { class: 'input', name: 'period', value: c.period, maxlength: '60', placeholder: 'Bijv. Jaar 2, blok 3' });
    var ects = h('input', { class: 'input', name: 'ects', value: c.ects === '' ? '' : SD.formatNumber(c.ects), inputmode: 'decimal', placeholder: 'Bijv. 5' });
    var grade = h('input', { class: 'input', name: 'grade', value: typeof c.grade === 'number' ? SD.formatGrade(c.grade) : '', inputmode: 'decimal', placeholder: 'Leeg als je nog geen cijfer hebt' });
    var passed = h('select', { class: 'input', name: 'passed' },
      h('option', { value: 'auto', text: 'Automatisch (op basis van cijfer)', selected: c.passed === 'auto' }),
      h('option', { value: 'ja', text: 'Gehaald (ook zonder cijfer)', selected: c.passed === 'ja' }),
      h('option', { value: 'nee', text: 'Nog niet gehaald', selected: c.passed === 'nee' }));

    var colors = h('div', { class: 'color-choices', role: 'radiogroup', 'aria-label': 'Kleur' });
    SD.COURSE_COLORS.forEach(function (col, i) {
      append(colors, h('label', { title: 'Kleur ' + (i + 1) },
        h('input', { type: 'radio', name: 'color', value: col, checked: col === c.color, 'aria-label': 'Kleur ' + (i + 1) }),
        h('span', { style: { background: col } })));
    });

    var form = dialogShell(course ? 'Vak bewerken' : 'Nieuw vak',
      [
        field('Naam', name),
        h('div', { class: 'row' }, field('Code of groep', code), field('Periode', period)),
        h('div', { class: 'row' }, field("EC's", ects), field('Cijfer', grade, { hint: 'Schaal 1 tot 10, bijv. 7,5' })),
        field('Gehaald', passed),
        h('div', { class: 'field' }, h('label', { text: 'Kleur' }), colors)
      ],
      course ? h('button', { type: 'button', class: 'btn danger', text: 'Verwijderen', on: { click: function () { closeDialog(); deleteCourseConfirm(course); } } }) : null
    );

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var chosen = form.querySelector('input[name="color"]:checked');
      var r = SD.validateCourse({
        id: course ? course.id : undefined, name: name.value, code: code.value, period: period.value,
        ects: ects.value, grade: grade.value, passed: passed.value, color: chosen ? chosen.value : c.color,
        example: course ? course.example : false
      }, state.data.courses);
      if (!r.ok) { showErrors(form, r.errors); return; }
      SD.upsert(state.data.courses, r.value);
      closeDialog();
      commit(course ? 'Vak bijgewerkt' : 'Vak toegevoegd');
    });
    openDialog(form);
  }

  function deleteCourseConfirm(course) {
    var p = SD.courseProgress(state.data, course.id);
    confirmDialog('Vak verwijderen?', '"' + course.name + '" wordt verwijderd. ' + (p.total ? 'De ' + p.total + ' taken van dit vak blijven bestaan, zonder vak.' : ''), 'Verwijderen', function () {
      var before = snapshot();
      SD.rememberDismissed(state.data, course);
      SD.deleteCourse(state.data, course.id);
      if (state.taskFilter.courseId === course.id) state.taskFilter.courseId = '';
      if (state.noteFilter.courseId === course.id) state.noteFilter.courseId = '';
      commit('Vak verwijderd', before);
    });
  }

  function openNoteDialog(note) {
    var n = note || { title: '', body: '', courseId: state.noteFilter.courseId || '', pinned: false };
    var title = h('input', { class: 'input', name: 'title', value: n.title, maxlength: '200', autofocus: true, placeholder: 'Titel' });
    var body = h('textarea', { class: 'input tall', name: 'body', placeholder: 'Schrijf hier je aantekening…' });
    body.value = n.body;
    var course = courseSelect(n.courseId);
    var pinned = h('input', { type: 'checkbox', name: 'pinned', checked: n.pinned });

    var form = dialogShell(note ? 'Aantekening' : 'Nieuwe aantekening',
      [
        field('Titel', title),
        field('Tekst', body),
        h('div', { class: 'row' }, field('Vak', course),
          h('div', { class: 'field' }, h('label', { text: 'Op startpagina' }), h('label', { class: 'checkbox-line' }, pinned, 'Vastpinnen')))
      ],
      note ? h('button', { type: 'button', class: 'btn danger', text: 'Verwijderen', on: { click: function () {
        closeDialog();
        var before = snapshot();
        state.data.notes = state.data.notes.filter(function (x) { return x.id !== note.id; });
        commit('Aantekening verwijderd', before);
      } } }) : null
    );
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = SD.validateNote({
        id: note ? note.id : undefined, title: title.value, body: body.value, courseId: course.value,
        pinned: pinned.checked, example: note ? note.example : false, updatedAt: new Date().toISOString()
      }, state.data.courses);
      if (!r.ok) { showErrors(form, r.errors); return; }
      SD.upsert(state.data.notes, r.value);
      closeDialog();
      commit(note ? 'Aantekening bijgewerkt' : 'Aantekening toegevoegd');
    });
    openDialog(form);
  }

  function confirmDialog(title, text, okLabel, onOk) {
    var form = dialogShell(title, h('p', { style: { margin: '0' }, text: text }), null, okLabel);
    form.querySelector('button[type="submit"]').className = 'btn danger solid';
    form.addEventListener('submit', function (e) { e.preventDefault(); closeDialog(); onOk(); });
    openDialog(form);
  }

  function alertDialog(title, text) {
    var form = h('form', { method: 'dialog' },
      h('header', null, h('h2', { id: 'dialog-title', text: title })),
      h('div', { class: 'body' }, h('p', { style: { margin: '0' }, text: text })),
      h('footer', null, h('div', { class: 'right' }, h('button', { type: 'submit', class: 'btn primary', text: 'OK', autofocus: true }))));
    form.addEventListener('submit', function (e) { e.preventDefault(); closeDialog(); });
    openDialog(form);
  }


  /* ---------------- Lesstof ---------------- */

  /** Zet *schuin* en **vet** om in elementen (alleen textContent, geen HTML). */
  function mdInline(text) {
    var out = [], re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(m[1] !== undefined ? h('strong', { text: m[1] }) : h('em', { text: m[2] }));
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  function mdCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  /** Eenvoudige Markdown: ### kop, alinea's, lijsten (- en 1.) en tabellen. */
  function mdBlocks(md) {
    var lines = md.split('\n'), out = [], i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^\|/.test(line)) {
        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var head = mdCells(rows[0]), body = rows.slice(/^\|[\s\-:|]+\|?$/.test(rows[1] || '') ? 2 : 1);
        out.push(h('div', { class: 'ls-table' }, h('table', null,
          h('thead', null, h('tr', null, head.map(function (c) { return h('th', null, mdInline(c)); }))),
          h('tbody', null, body.map(function (r) { return h('tr', null, mdCells(r).map(function (c) { return h('td', null, mdInline(c)); })); })))));
        continue;
      }
      var ul = /^- /.test(line), ol = /^\d+\. /.test(line);
      if (ul || ol) {
        var items = [];
        while (i < lines.length && (ul ? /^- /.test(lines[i]) : /^\d+\. /.test(lines[i]))) {
          items.push(h('li', null, mdInline(lines[i].replace(/^(- |\d+\. )/, '')))); i++;
        }
        out.push(h(ul ? 'ul' : 'ol', null, items));
        continue;
      }
      out.push(h('p', null, mdInline(line)));
      i++;
    }
    return out;
  }

  /** Splitst een week in vakken (### koppen); elk vak wordt een uitklapblok. */
  function lesstofWeek(week) {
    var parts = week.markdown.split(/^### /m);
    var intro = parts.shift();
    return h('div', { class: 'ls-week' },
      intro.trim() ? h('div', { class: 'ls-intro' }, mdBlocks(intro)) : null,
      parts.map(function (part, idx) {
        var nl = part.indexOf('\n');
        var title = nl < 0 ? part : part.slice(0, nl);
        return h('details', { class: 'card ls-section', open: idx === 0 },
          h('summary', null, h('span', { text: title.trim() })),
          h('div', { class: 'ls-body' }, mdBlocks(nl < 0 ? '' : part.slice(nl + 1))));
      }));
  }

  function viewLesstof() {
    var L = window.SD_LESSTOF;
    var root = h('div');
    append(root, pageHead('Lesstof', 'Per week en per vak: wat er in de lessen behandeld is, uitgelegd zoals een docent het zou doen.'));
    if (!L || !L.weeks || !L.weeks.length) {
      append(root, emptyBox('Nog geen lesstof', 'De samenvattingen worden per week toegevoegd.'));
      return root;
    }
    var weeks = L.weeks.slice().sort(function (a, b) { return (b.order || 0) - (a.order || 0); }); // nieuwste bovenaan
    if (!state.lesstofWeek || !weeks.some(function (w) { return w.id === state.lesstofWeek; })) state.lesstofWeek = weeks[0].id;
    append(root, h('div', { class: 'segmented ls-tabs', role: 'tablist' }, weeks.map(function (w) {
      var on = w.id === state.lesstofWeek;
      return h('button', { type: 'button', class: on ? 'active' : null, role: 'tab', 'aria-selected': on ? 'true' : 'false',
        text: w.title.replace(/\s*\(.*\)$/, ''), on: { click: function () { state.lesstofWeek = w.id; render(); } } });
    })));
    var cur = weeks.filter(function (w) { return w.id === state.lesstofWeek; })[0];
    append(root, h('h2', { class: 'ls-title', text: cur.title }));
    append(root, lesstofWeek(cur));
    if (L.updatedAt) append(root, h('p', { class: 'ls-foot', text: 'Bijgewerkt: ' + L.updatedAt + '. Controleer bij twijfel altijd de dia\'s in Brightspace.' }));
    return root;
  }

  /* ---------------- Navigatie en render ---------------- */

  var VIEWS = { overzicht: viewOverview, taken: viewTasks, week: viewWeek, vakken: viewCourses, aantekeningen: viewNotes, lesstof: viewLesstof, instellingen: viewSettings };

  function render() {
    var view = $('view');
    view.textContent = '';
    try {
      append(view, (VIEWS[state.view] || viewOverview)());
    } catch (e) {
      // Laatste vangnet: toon een melding in plaats van een leeg scherm
      console.error(e);
      append(view, emptyBox('Er ging iets mis bij het tonen van dit scherm', 'Je gegevens zijn niet aangepast. Ga naar Instellingen om een back-up te maken.'));
    }
    document.querySelectorAll('#nav a').forEach(function (a) {
      var active = a.getAttribute('data-view') === state.view;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var count = SD.urgentTasks(state.data, now()).length;
    var badge = $('nav-badge');
    badge.hidden = !count;
    badge.textContent = String(count);
    renderBanner();
    document.title = (count ? '(' + count + ') ' : '') + 'Studiedashboard';
  }

  function route() {
    var v = (location.hash || '#overzicht').slice(1);
    state.view = VIEWS[v] ? v : 'overzicht';
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------- Start ---------------- */

  function start() {
    var loaded = SD.loadData(storage);
    if (loaded.status === 'nieuw' && online()) {
      // Via het webadres komen je echte deadlines vanzelf binnen: geen voorbeelden nodig
      state.data = SD.emptyData();
      SD.saveData(storage, state.data);
      startupNotice = 'Welkom! Je deadlines uit Brightspace worden automatisch toegevoegd. Vakken, cijfers en aantekeningen voeg je zelf toe.';
    } else if (loaded.status === 'nieuw') {
      state.data = SD.exampleData();
      SD.saveData(storage, state.data);
      startupNotice = 'Welkom! Er staan een paar voorbeelden (blauw label "Voorbeeld") in je dashboard. Verwijder ze via Instellingen zodra je ze niet meer nodig hebt.';
    } else {
      state.data = loaded.data;
      if (loaded.message) startupNotice = loaded.message;
      if (loaded.status === 'reservekopie' || loaded.status === 'hersteld') SD.saveData(storage, state.data);
    }

    // Vraag de browser om de gegevens niet zelf op te ruimen (waar ondersteund)
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* negeren */ }

    applyTheme();
    $('theme-toggle').addEventListener('click', function () {
      var order = ['auto', 'licht', 'donker'];
      var s = state.data.settings;
      s.theme = order[(order.indexOf(s.theme) + 1) % order.length];
      applyTheme();
      commit();
    });

    // Gegevens gewijzigd in een ander tabblad: opnieuw laden
    window.addEventListener('storage', function (e) {
      if (e.key !== SD.STORAGE_KEY) return;
      var r = SD.loadData(storage);
      if (r.data) { state.data = r.data; applyTheme(); render(); }
    });

    window.addEventListener('hashchange', route);
    // Elke minuut verversen, zodat 'urgent' en 'te laat' kloppen als de app openstaat
    setInterval(function () {
      var a = document.activeElement;
      var typing = a && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
      if (!(hasDialog && dialog.open) && !typing) render();
    }, 60000);

    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(tag) || (hasDialog && dialog.open)) return;
      if (e.key === 'n') { e.preventDefault(); openTaskDialog(null); }
    });

    route();

    // Nieuwe deadlines ophalen bij openen, en als je de app terughaalt na een tijdje
    if (state.data.settings.autoImport) fetchFeed(false);
    var lastFetch = Date.now();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.data.settings.autoImport && Date.now() - lastFetch > 30 * 60000) {
        lastFetch = Date.now();
        fetchFeed(false);
      }
    });

    // Offline werken als de app via een webadres draait (bijv. op de iPhone)
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* app werkt ook zonder */ });
    }
  }

  try {
    start();
  } catch (e) {
    console.error(e);
    var v = document.getElementById('view');
    if (v) v.textContent = 'Het dashboard kon niet starten. Kijk in README.md bij "Problemen oplossen".';
  }
})();
