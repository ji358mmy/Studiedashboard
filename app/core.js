/*
 * Studiedashboard - kernlogica
 * ----------------------------------------------------------------
 * Dit bestand bevat alle logica zonder schermcode: gegevens valideren,
 * opslaan, laden, sorteren en berekenen. Daardoor is alles los te testen
 * (zie tests/). Werkt in de browser (als window.SD) en in Node (require).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.SD = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var STORAGE_KEY = 'studiedashboard.data.v1';
  var BACKUP_KEY = 'studiedashboard.data.v1.vorige';
  var CORRUPT_PREFIX = 'studiedashboard.beschadigd.';

  var PRIORITIES = ['laag', 'normaal', 'hoog'];
  var THEMES = ['auto', 'licht', 'donker'];
  var COURSE_COLORS = ['#c6002a', '#1d4ed8', '#0f766e', '#7c3aed', '#b45309', '#15803d', '#0369a1', '#a16207'];

  var MAX_TITLE = 200;
  var MAX_TEXT = 20000;

  /* ---------------- Hulpfuncties ---------------- */

  function uid() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function cleanText(v, max) {
    if (v === null || v === undefined) return '';
    var s = String(v).replace(/\u0000/g, '').trim();
    return s.length > max ? s.slice(0, max) : s;
  }

  /** Alleen gewone https-links, anders leeg (voorkomt rare of gevaarlijke links). */
  function cleanUrl(v) {
    if (typeof v !== 'string') return null;
    var s = v.trim();
    if (!/^https:\/\/[^\s<>"]+$/i.test(s) || s.length > 2000) return null;
    return s;
  }

  /** Wat de deadlinelijst de vorige keer over een taak zei (om eigen wijzigingen te herkennen). */
  function cleanFeedSnapshot(v) {
    if (!isObject(v)) return null;
    return {
      title: cleanText(v.title, MAX_TITLE),
      due: normalizeDue(v.due),
      url: cleanUrl(v.url),
      course: cleanText(v.course, MAX_TITLE)
    };
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** Datum + tijd als lokale string 'YYYY-MM-DDTHH:mm' */
  function toLocalDateTime(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function toLocalDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /**
   * Leest een deadline. Accepteert 'YYYY-MM-DD' (dan 23:59) of
   * 'YYYY-MM-DDTHH:mm'. Geeft een Date terug of null bij ongeldige invoer.
   */
  function parseDue(value) {
    if (value === null || value === undefined || value === '') return null;
    var s = String(value).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var h = m[4] !== undefined ? +m[4] : 23;
    var mi = m[5] !== undefined ? +m[5] : 59;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
    var date = new Date(y, mo - 1, d, h, mi, 0, 0);
    // Vangt datums als 31 februari af
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date;
  }

  /** Normaliseert een geldige deadline naar 'YYYY-MM-DDTHH:mm'. */
  function normalizeDue(value) {
    var d = parseDue(value);
    return d ? toLocalDateTime(d) : null;
  }

  /**
   * Leest een cijfer, ook met komma ('7,5'). Geeft
   * { ok: true, value: number|null } of { ok: false, error }.
   */
  function parseGrade(value) {
    if (value === null || value === undefined) return { ok: true, value: null };
    var s = String(value).trim().replace(',', '.');
    if (s === '') return { ok: true, value: null };
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) {
      return { ok: false, error: 'Vul een cijfer in tussen 1 en 10, bijvoorbeeld 7,5.' };
    }
    var n = parseFloat(s);
    if (n < 1 || n > 10) return { ok: false, error: 'Een cijfer ligt tussen 1 en 10.' };
    return { ok: true, value: Math.round(n * 10) / 10 };
  }

  function parseEcts(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
      return { ok: true, value: 0 };
    }
    var s = String(value).trim().replace(',', '.');
    if (!/^\d{1,3}(\.\d)?$/.test(s)) return { ok: false, error: "Vul een aantal EC's in, bijvoorbeeld 5." };
    var n = parseFloat(s);
    if (n < 0 || n > 240) return { ok: false, error: "Het aantal EC's ligt tussen 0 en 240." };
    return { ok: true, value: n };
  }

  /* ---------------- Standaardgegevens ---------------- */

  function defaultSettings() {
    return {
      theme: 'auto',
      urgentDays: 3,
      passGrade: 5.5,
      backupReminderDays: 0,
      lastBackup: null,
      autoImport: true,
      feedUpdatedAt: null,
      feedDismissed: []
    };
  }

  function emptyData() {
    return {
      version: SCHEMA_VERSION,
      settings: defaultSettings(),
      courses: [],
      tasks: [],
      notes: []
    };
  }

  /* ---------------- Validatie per onderdeel ---------------- */

  /**
   * Valideert invoer voor een taak. Geeft { ok, value, errors } terug.
   * errors is een object per veld, zodat het formulier de fout bij
   * het juiste veld kan tonen.
   */
  function validateTask(input, courses) {
    var errors = {};
    if (!isObject(input)) return { ok: false, errors: { _: 'Ongeldige taak.' } };
    var title = cleanText(input.title, MAX_TITLE);
    if (!title) errors.title = 'Geef de taak een naam.';

    var due = null;
    if (input.due !== undefined && input.due !== null && String(input.due).trim() !== '') {
      due = normalizeDue(input.due);
      if (!due) errors.due = 'Deze datum klopt niet.';
    }

    var courseId = input.courseId ? String(input.courseId) : null;
    if (courseId && Array.isArray(courses) && !courses.some(function (c) { return c.id === courseId; })) {
      courseId = null; // vak bestaat niet (meer): taak blijft wel bestaan
    }

    var priority = PRIORITIES.indexOf(input.priority) >= 0 ? input.priority : 'normaal';

    if (Object.keys(errors).length) return { ok: false, errors: errors };
    var done = input.done === true;
    return {
      ok: true,
      errors: {},
      value: {
        id: typeof input.id === 'string' && input.id ? input.id : uid(),
        title: title,
        courseId: courseId,
        due: due,
        priority: priority,
        done: done,
        doneAt: done ? (typeof input.doneAt === 'string' ? input.doneAt : new Date().toISOString()) : null,
        notes: cleanText(input.notes, MAX_TEXT),
        example: input.example === true,
        source: input.source === 'brightspace' ? 'brightspace' : null,
        externalId: input.source === 'brightspace' && typeof input.externalId === 'string' ? cleanText(input.externalId, 200) : null,
        url: cleanUrl(input.url),
        feed: input.source === 'brightspace' ? cleanFeedSnapshot(input.feed) : null,
        createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString()
      }
    };
  }

  function validateCourse(input, existing) {
    var errors = {};
    if (!isObject(input)) return { ok: false, errors: { _: 'Ongeldig vak.' } };
    var name = cleanText(input.name, MAX_TITLE);
    if (!name) errors.name = 'Geef het vak een naam.';

    var ects = parseEcts(input.ects);
    if (!ects.ok) errors.ects = ects.error;

    var grade = parseGrade(input.grade);
    if (!grade.ok) errors.grade = grade.error;

    var color = typeof input.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color)
      ? input.color.toLowerCase()
      : COURSE_COLORS[(Array.isArray(existing) ? existing.length : 0) % COURSE_COLORS.length];

    if (Object.keys(errors).length) return { ok: false, errors: errors };
    return {
      ok: true,
      errors: {},
      value: {
        id: typeof input.id === 'string' && input.id ? input.id : uid(),
        name: name,
        code: cleanText(input.code, 40),
        period: cleanText(input.period, 60),
        ects: ects.value,
        grade: grade.value,
        // 'auto' = gehaald als cijfer >= voldoende; 'ja'/'nee' = handmatig
        passed: ['auto', 'ja', 'nee'].indexOf(input.passed) >= 0 ? input.passed : 'auto',
        color: color,
        feedName: typeof input.feedName === 'string' && input.feedName.trim() ? cleanText(input.feedName, MAX_TITLE) : null,
        example: input.example === true
      }
    };
  }

  function validateNote(input, courses) {
    var errors = {};
    if (!isObject(input)) return { ok: false, errors: { _: 'Ongeldige aantekening.' } };
    var title = cleanText(input.title, MAX_TITLE);
    var body = cleanText(input.body, MAX_TEXT);
    if (!title && !body) errors.title = 'Schrijf een titel of tekst.';
    var courseId = input.courseId ? String(input.courseId) : null;
    if (courseId && Array.isArray(courses) && !courses.some(function (c) { return c.id === courseId; })) {
      courseId = null;
    }
    if (Object.keys(errors).length) return { ok: false, errors: errors };
    return {
      ok: true,
      errors: {},
      value: {
        id: typeof input.id === 'string' && input.id ? input.id : uid(),
        title: title || 'Zonder titel',
        body: body,
        courseId: courseId,
        pinned: input.pinned === true,
        example: input.example === true,
        updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString()
      }
    };
  }

  function validateSettings(input) {
    var s = defaultSettings();
    if (!isObject(input)) return s;
    if (THEMES.indexOf(input.theme) >= 0) s.theme = input.theme;
    var u = parseInt(input.urgentDays, 10);
    if (u >= 1 && u <= 60) s.urgentDays = u;
    var p = parseGrade(input.passGrade);
    if (p.ok && p.value !== null) s.passGrade = p.value;
    var b = parseInt(input.backupReminderDays, 10);
    if (b >= 0 && b <= 90) s.backupReminderDays = b;
    if (typeof input.lastBackup === 'string' && !isNaN(Date.parse(input.lastBackup))) s.lastBackup = input.lastBackup;
    if (input.autoImport === false) s.autoImport = false;
    if (typeof input.feedUpdatedAt === 'string' && input.feedUpdatedAt.length < 60) s.feedUpdatedAt = input.feedUpdatedAt;
    if (Array.isArray(input.feedDismissed)) {
      s.feedDismissed = input.feedDismissed.filter(function (x) { return typeof x === 'string' && x.length <= 200; }).slice(-2000);
    }
    return s;
  }

  /**
   * Repareert een volledig gegevensobject. Ongeldige onderdelen worden
   * weggelaten in plaats van dat de app crasht. Geeft { data, dropped }.
   */
  function sanitizeData(raw) {
    var data = emptyData();
    var dropped = 0;
    if (!isObject(raw)) return { data: data, dropped: 0, valid: false };

    data.settings = validateSettings(raw.settings);

    var seen = {};
    function uniq(item) {
      if (seen[item.id]) item.id = uid();
      seen[item.id] = true;
      return item;
    }

    (Array.isArray(raw.courses) ? raw.courses : []).forEach(function (c) {
      var r = validateCourse(c, data.courses);
      if (r.ok) data.courses.push(uniq(r.value)); else dropped++;
    });
    (Array.isArray(raw.tasks) ? raw.tasks : []).forEach(function (t) {
      var r = validateTask(t, data.courses);
      if (r.ok) data.tasks.push(uniq(r.value)); else dropped++;
    });
    (Array.isArray(raw.notes) ? raw.notes : []).forEach(function (n) {
      var r = validateNote(n, data.courses);
      if (r.ok) data.notes.push(uniq(r.value)); else dropped++;
    });
    return { data: data, dropped: dropped, valid: true };
  }

  /* ---------------- Opslag ---------------- */

  /**
   * Laadt de gegevens uit opslag (localStorage of een vervanger in tests).
   * status: 'nieuw' | 'ok' | 'hersteld' | 'reservekopie' | 'beschadigd' | 'geen-opslag'
   * Crasht nooit: bij een beschadigd bestand wordt de kapotte versie apart
   * bewaard en wordt de vorige goede versie of een lege start gebruikt.
   */
  function loadData(storage) {
    var raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (e) {
      return { data: emptyData(), status: 'geen-opslag', message: 'De browser staat opslaan niet toe. Wijzigingen blijven niet bewaard.' };
    }
    if (raw === null || raw === undefined) {
      return { data: null, status: 'nieuw', message: '' };
    }

    var parsed = tryParse(raw);
    if (parsed.ok) {
      var s = sanitizeData(parsed.value);
      if (s.valid) {
        return {
          data: s.data,
          status: s.dropped ? 'hersteld' : 'ok',
          message: s.dropped ? s.dropped + ' onleesbaar onderdeel/onderdelen overgeslagen. De rest is geladen.' : ''
        };
      }
    }

    // Hoofdopslag kapot: bewaar kopie en probeer de reservekopie
    var corruptKey = CORRUPT_PREFIX + Date.now();
    try { storage.setItem(corruptKey, String(raw).slice(0, 2000000)); } catch (e) { /* negeren */ }

    var backupRaw = null;
    try { backupRaw = storage.getItem(BACKUP_KEY); } catch (e) { /* negeren */ }
    var b = backupRaw ? tryParse(backupRaw) : { ok: false };
    if (b.ok) {
      var sb = sanitizeData(b.value);
      if (sb.valid) {
        return {
          data: sb.data,
          status: 'reservekopie',
          message: 'Het opslagbestand was beschadigd. De vorige goede versie is teruggezet.'
        };
      }
    }
    return {
      data: emptyData(),
      status: 'beschadigd',
      message: 'Het opslagbestand was beschadigd en kon niet worden hersteld. Zet een back-up terug via Instellingen.'
    };
  }

  function tryParse(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      return { ok: false };
    }
  }

  /**
   * Slaat op. De vorige versie blijft als reservekopie bewaard.
   * Geeft { ok: true } of { ok: false, error }.
   */
  function saveData(storage, data) {
    var text;
    try {
      text = JSON.stringify(data);
    } catch (e) {
      return { ok: false, error: 'Gegevens konden niet worden omgezet.' };
    }
    try {
      var previous = storage.getItem(STORAGE_KEY);
      if (previous && tryParse(previous).ok) storage.setItem(BACKUP_KEY, previous);
      storage.setItem(STORAGE_KEY, text);
      return { ok: true };
    } catch (e) {
      var full = e && (e.name === 'QuotaExceededError' || e.code === 22);
      return {
        ok: false,
        error: full
          ? 'De opslag is vol. Maak een back-up en verwijder oude aantekeningen.'
          : 'Opslaan is mislukt. Maak een back-up via Instellingen.'
      };
    }
  }

  /** Maakt de tekst voor een back-upbestand. */
  function exportData(data, now) {
    var out = {
      app: 'studiedashboard',
      exportedAt: (now || new Date()).toISOString(),
      data: data
    };
    return JSON.stringify(out, null, 2);
  }

  /**
   * Leest een back-upbestand. Accepteert ook een 'kale' data-export.
   * Geeft { ok, data, dropped } of { ok: false, error }.
   */
  function importData(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Het bestand is leeg.' };
    var p = tryParse(text);
    if (!p.ok) return { ok: false, error: 'Dit is geen geldig back-upbestand (geen leesbare JSON).' };
    var payload = isObject(p.value) && isObject(p.value.data) ? p.value.data : p.value;
    if (!isObject(payload) || (!Array.isArray(payload.tasks) && !Array.isArray(payload.courses) && !Array.isArray(payload.notes))) {
      return { ok: false, error: 'Dit bestand bevat geen studiedashboard-gegevens.' };
    }
    var s = sanitizeData(payload);
    return { ok: true, data: s.data, dropped: s.dropped };
  }

  /* ---------------- Berekeningen ---------------- */

  /**
   * Status van een taak ten opzichte van 'nu':
   * 'af' | 'te-laat' | 'urgent' | 'binnenkort' | 'later' | 'geen-datum'
   */
  function taskStatus(task, now, urgentDays) {
    if (task.done) return 'af';
    var d = parseDue(task.due);
    if (!d) return 'geen-datum';
    var diff = d.getTime() - now.getTime();
    var day = 24 * 60 * 60 * 1000;
    if (diff < 0) return 'te-laat';
    if (diff <= (urgentDays || 3) * day) return 'urgent';
    if (diff <= 14 * day) return 'binnenkort';
    return 'later';
  }

  /**
   * Sorteert taken: open taken eerst, dan op deadline (vroegste eerst),
   * taken zonder datum achteraan. Bij 'prioriteit' eerst op prioriteit.
   * Geeft een nieuwe lijst terug.
   */
  function sortTasks(tasks, mode) {
    var prio = { hoog: 0, normaal: 1, laag: 2 };
    return tasks.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (mode === 'prioriteit' && prio[a.priority] !== prio[b.priority]) {
        return prio[a.priority] - prio[b.priority];
      }
      if (mode === 'titel') return a.title.localeCompare(b.title, 'nl');
      var da = a.due ? parseDue(a.due) : null;
      var db = b.due ? parseDue(b.due) : null;
      if (da && db && da.getTime() !== db.getTime()) {
        // Afgeronde taken: meest recente bovenaan
        return a.done ? db - da : da - db;
      }
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.title.localeCompare(b.title, 'nl');
    });
  }

  /** Filtert taken op status/vak/zoektekst. */
  function filterTasks(tasks, f, now, urgentDays) {
    f = f || {};
    var q = (f.query || '').toLowerCase().trim();
    return tasks.filter(function (t) {
      if (f.courseId && t.courseId !== f.courseId) return false;
      if (f.show === 'open' && t.done) return false;
      if (f.show === 'af' && !t.done) return false;
      if (f.show === 'urgent') {
        var st = taskStatus(t, now, urgentDays);
        if (st !== 'urgent' && st !== 'te-laat') return false;
      }
      if (q && (t.title + ' ' + t.notes).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  /** Taken die nu aandacht vragen: te laat of binnen de urgentiegrens. */
  function urgentTasks(data, now) {
    var days = data.settings.urgentDays;
    return sortTasks(data.tasks.filter(function (t) {
      var s = taskStatus(t, now, days);
      return s === 'te-laat' || s === 'urgent';
    }));
  }

  /** Eerstvolgende open taken met een deadline (na de urgente). */
  function upcomingTasks(data, now, limit) {
    var days = data.settings.urgentDays;
    return sortTasks(data.tasks.filter(function (t) {
      return taskStatus(t, now, days) === 'binnenkort' || taskStatus(t, now, days) === 'later';
    })).slice(0, limit || 5);
  }

  function isCoursePassed(course, passGrade) {
    if (course.passed === 'ja') return true;
    if (course.passed === 'nee') return false;
    return typeof course.grade === 'number' && course.grade >= (passGrade || 5.5);
  }

  /** Voortgang van een vak op basis van zijn taken. */
  function courseProgress(data, courseId) {
    var list = data.tasks.filter(function (t) { return t.courseId === courseId; });
    var done = list.filter(function (t) { return t.done; }).length;
    return {
      total: list.length,
      done: done,
      open: list.length - done,
      pct: list.length ? Math.round((done / list.length) * 100) : 0
    };
  }

  /** EC-overzicht: behaald, nog te halen, totaal. */
  function ectsSummary(data) {
    var pass = data.settings.passGrade;
    var earned = 0, total = 0;
    data.courses.forEach(function (c) {
      total += c.ects;
      if (isCoursePassed(c, pass)) earned += c.ects;
    });
    earned = Math.round(earned * 10) / 10;
    total = Math.round(total * 10) / 10;
    return { earned: earned, total: total, remaining: Math.round((total - earned) * 10) / 10 };
  }

  /** Gewogen gemiddelde (naar EC's) van vakken met een cijfer. null als er geen zijn. */
  function weightedAverage(courses) {
    var sum = 0, weight = 0, count = 0, plain = 0;
    courses.forEach(function (c) {
      if (typeof c.grade !== 'number') return;
      count++;
      plain += c.grade;
      var w = c.ects > 0 ? c.ects : 0;
      sum += c.grade * w;
      weight += w;
    });
    if (!count) return null;
    var avg = weight > 0 ? sum / weight : plain / count;
    return Math.round(avg * 100) / 100;
  }

  /** De zeven dagen (maandag t/m zondag) van de week waarin 'date' valt. */
  function weekDays(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var dow = (d.getDay() + 6) % 7; // maandag = 0
    d.setDate(d.getDate() - dow);
    var out = [];
    for (var i = 0; i < 7; i++) {
      out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
    }
    return out;
  }

  /** ISO-weeknummer */
  function isoWeek(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  function tasksOnDay(tasks, day) {
    var key = toLocalDate(day);
    return sortTasks(tasks.filter(function (t) { return t.due && t.due.slice(0, 10) === key; }));
  }

  function backupDue(settings, now) {
    if (!settings.backupReminderDays) return false;
    if (!settings.lastBackup) return true;
    var last = Date.parse(settings.lastBackup);
    if (isNaN(last)) return true;
    return now.getTime() - last >= settings.backupReminderDays * 86400000;
  }

  /* ---------------- Opmaak ---------------- */

  var DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  var DAYS_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  function formatDue(due) {
    var d = parseDue(due);
    if (!d) return 'Geen deadline';
    var time = pad(d.getHours()) + ':' + pad(d.getMinutes());
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() +
      (time === '23:59' ? '' : ', ' + time);
  }

  /** 'vandaag', 'morgen', 'over 3 dagen', '2 dagen te laat' */
  function relativeDue(due, now) {
    var d = parseDue(due);
    if (!d) return '';
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var days = Math.round((b - a) / 86400000);
    if (d < now && days === 0) return 'vandaag verlopen';
    if (days === 0) return 'vandaag';
    if (days === 1) return 'morgen';
    if (days === -1) return 'gisteren verlopen';
    if (days < 0) return (-days) + ' dagen te laat';
    if (days < 7) return 'over ' + days + ' dagen';
    var w = Math.round(days / 7);
    return 'over ' + w + (w === 1 ? ' week' : ' weken');
  }

  function formatGrade(g) {
    return typeof g === 'number' ? g.toFixed(1).replace('.', ',') : '–';
  }

  function formatNumber(n) {
    return String(Math.round(n * 10) / 10).replace('.', ',');
  }

  /* ---------------- Automatische deadlines (Brightspace-feed) ---------------- */

  /**
   * Voegt deadlines uit een feedbestand (deadlines.json) samen met je eigen gegevens.
   * Regels:
   *  - Nieuwe deadline: wordt toegevoegd als taak met label 'Brightspace'.
   *  - Bestaande deadline: naam, datum, link en vak worden bijgewerkt.
   *    Of je hem hebt afgevinkt, je prioriteit en je eigen notities blijven altijd van jou.
   *  - Een deadline die je zelf hebt verwijderd, komt niet terug.
   *  - Vakken worden op naam gekoppeld; een onbekend vak wordt aangemaakt.
   * Feedformaat: { app: 'studiedashboard-feed', updatedAt, courses: [{ name, code, ects }],
   *               tasks: [{ id, title, due, course, url, notes }] }
   * Geeft { ok, data, added, updated, error } en wijzigt de invoer niet.
   */
  function mergeFeed(data, feed) {
    if (!isObject(feed) || feed.app !== 'studiedashboard-feed' || !Array.isArray(feed.tasks)) {
      return { ok: false, error: 'Geen geldig deadlinebestand.' };
    }
    var out = JSON.parse(JSON.stringify(data));
    var added = 0, updated = 0, skipped = 0;
    var dismissed = {};
    out.settings.feedDismissed.forEach(function (k) { dismissed[k] = true; });

    function key(name) { return String(name || '').trim().toLowerCase(); }

    function courseName(id) {
      for (var i = 0; i < out.courses.length; i++) if (out.courses[i].id === id) return out.courses[i].feedName || out.courses[i].name;
      return '';
    }

    /* Zoekt het vak bij een naam uit de lijst. Eerst op de oorspronkelijke
       Brightspace-naam (zodat hernoemen mag), dan op naam of code. */
    function findCourse(name) {
      var n = key(name);
      if (!n) return null;
      var i;
      for (i = 0; i < out.courses.length; i++) if (out.courses[i].feedName && key(out.courses[i].feedName) === n) return out.courses[i];
      for (i = 0; i < out.courses.length; i++) {
        var c = out.courses[i];
        if (!c.feedName && (key(c.name) === n || (c.code && key(c.code) === n))) { c.feedName = cleanText(name, MAX_TITLE); return c; }
      }
      return null;
    }

    function ensureCourse(name, extra) {
      if (!key(name)) return null;
      var c = findCourse(name);
      if (c || dismissed['course:' + key(name)]) return c;
      extra = extra || {};
      var r = validateCourse({ name: name, code: extra.code, period: extra.period, ects: extra.ects, feedName: name }, out.courses);
      if (!r.ok) return null;
      out.courses.push(r.value);
      return r.value;
    }

    (Array.isArray(feed.courses) ? feed.courses : []).forEach(function (c) {
      if (isObject(c)) ensureCourse(c.name, c);
    });

    feed.tasks.slice(0, 1000).forEach(function (ft) {
      if (!isObject(ft) || typeof ft.id !== 'string' || !ft.id.trim()) { skipped++; return; }
      var extId = 'bs:' + cleanText(ft.id, 190);
      if (dismissed[extId]) return;

      var incoming = cleanFeedSnapshot({ title: ft.title, due: ft.due, url: ft.url, course: ft.course });
      if (!incoming.title || (ft.due && !incoming.due)) { skipped++; return; }
      var course = ensureCourse(incoming.course);

      var existing = null;
      for (var i = 0; i < out.tasks.length; i++) {
        if (out.tasks[i].externalId === extId) { existing = out.tasks[i]; break; }
      }

      if (!existing) {
        var rn = validateTask({
          title: incoming.title, due: incoming.due, url: incoming.url, courseId: course ? course.id : null,
          priority: 'normaal', done: false, notes: cleanText(ft.notes, MAX_TEXT),
          source: 'brightspace', externalId: extId, feed: incoming
        }, out.courses);
        if (!rn.ok) { skipped++; return; }
        out.tasks.push(rn.value);
        added++;
        return;
      }

      // Alleen wat Brightspace sinds de vorige keer veranderde, wordt overgenomen.
      // Wat je zelf aanpaste (naam, datum, vak), blijft dus staan.
      var prev = existing.feed || { title: existing.title, due: existing.due, url: existing.url, course: courseName(existing.courseId) };
      var task = JSON.parse(JSON.stringify(existing));
      var changed = false;
      if (incoming.title !== prev.title && incoming.title !== task.title) { task.title = incoming.title; changed = true; }
      if (incoming.due !== prev.due && incoming.due !== task.due) { task.due = incoming.due; changed = true; }
      if (incoming.url !== prev.url && incoming.url !== task.url) { task.url = incoming.url; changed = true; }
      if (key(incoming.course) !== key(prev.course)) {
        var cid = course ? course.id : null;
        if (cid !== task.courseId) { task.courseId = cid; changed = true; }
      }
      task.feed = incoming;
      var r = validateTask(task, out.courses);
      if (!r.ok) { skipped++; return; }
      upsert(out.tasks, r.value);
      if (changed) updated++;
    });
    if (typeof feed.updatedAt === 'string') out.settings.feedUpdatedAt = cleanText(feed.updatedAt, 50);
    return { ok: true, data: out, added: added, updated: updated, skipped: skipped };
  }

  /** Onthoudt dat je een Brightspace-taak of -vak zelf verwijderd hebt, zodat het niet terugkomt. */
  function rememberDismissed(data, item) {
    var k = null;
    if (item && item.externalId) k = item.externalId;
    else if (item && item.feedName) k = 'course:' + String(item.feedName).trim().toLowerCase();
    if (k && data.settings.feedDismissed.indexOf(k) < 0) data.settings.feedDismissed.push(k);
    return data;
  }

  /* ---------------- Voorbeeldgegevens ---------------- */

  /**
   * Een paar duidelijk gemarkeerde voorbeelden (example: true), gebaseerd op
   * blok 2 (Partner Selection). Controleer de data altijd zelf in Brightspace.
   */
  function exampleData() {
    var data = emptyData();
    var project = { id: 'vb-vak-project', name: 'Project Partner Selection', code: 'Groep 5 · Brand Masters', period: 'Jaar 2, blok 2', ects: 9, grade: null, passed: 'auto', color: '#c6002a', example: true };
    var ppd = { id: 'vb-vak-ppd', name: 'Personal Professional Development', code: 'LO2', period: 'Jaar 2, blok 2', ects: 2, grade: null, passed: 'auto', color: '#7c3aed', example: true };
    var ibc = { id: 'vb-vak-ibc', name: 'International Business Communication (Spaans)', code: 'IBC', period: 'Jaar 2, blok 2', ects: 4, grade: null, passed: 'auto', color: '#b45309', example: true };
    var vorig = { id: 'vb-vak-vorig', name: 'Voorbeeld: afgerond vak', code: 'VOORBEELD', period: 'Jaar 2, blok 1', ects: 15, grade: 7.5, passed: 'auto', color: '#1d4ed8', example: true };
    data.courses = [project, ppd, ibc, vorig];

    function t(id, title, courseId, due, priority, done, notes) {
      return { id: id, title: title, courseId: courseId, due: due, priority: priority, done: done, doneAt: done ? '2026-11-20T09:00:00.000Z' : null, notes: notes || '', example: true, source: null, externalId: null, url: null, createdAt: '2026-11-21T12:00:00.000Z' };
    }
    data.tasks = [
      t('vb-t1', 'Spaans weekopdracht (WA) #3 inleveren', 'vb-vak-ibc', '2026-11-23T09:00', 'hoog', false, 'Zelf schrijven, volgens de opdracht.'),
      t('vb-t2', 'Flip the Classroom: stappen 1 t/m 3', 'vb-vak-project', '2026-11-27T09:00', 'hoog', false, 'Met de projectgroep afstemmen wie wat doet.'),
      t('vb-t3', 'COIL-sessie voorbereiden', 'vb-vak-project', '2026-12-02T10:00', 'normaal', false, 'Voorbeeld: vul de echte datum in.'),
      t('vb-t4', 'PPD-portfolio inleveren (week 6)', 'vb-vak-ppd', '2026-12-14T09:00', 'normaal', false, 'Week 6: 14 t/m 18 december. Exacte datum nog checken in Brightspace.'),
      t('vb-t5', 'PPD-gesprek voorbereiden (week 8)', 'vb-vak-ppd', '2027-01-11T09:00', 'normaal', false, 'Assessmentgesprek in week 8 (11 t/m 15 januari).'),
      t('vb-t6', 'Projectplan inleveren', 'vb-vak-project', '2026-11-20T09:00', 'hoog', true, '')
    ];
    data.notes = [
      { id: 'vb-n1', title: 'Zo werken aantekeningen', body: 'Dit is een voorbeeld. Schrijf hier afspraken met je groep, feedback van docenten of dingen die je niet wilt vergeten.\n\nKoppel een aantekening aan een vak, dan zie je hem ook bij dat vak terug.\n\nVerwijder alle voorbeelden in één keer via Instellingen.', courseId: 'vb-vak-project', pinned: true, example: true, updatedAt: '2026-11-21T12:00:00.000Z' }
    ];
    // Door de validatie halen, zodat voorbeelden precies dezelfde vorm hebben als eigen gegevens
    return sanitizeData(data).data;
  }

  function removeExamples(data) {
    var copy = JSON.parse(JSON.stringify(data));
    var removedCourses = {};
    copy.courses = copy.courses.filter(function (c) {
      if (c.example) { removedCourses[c.id] = true; return false; }
      return true;
    });
    copy.tasks = copy.tasks.filter(function (t) { return !t.example; }).map(function (t) {
      if (t.courseId && removedCourses[t.courseId]) t.courseId = null;
      return t;
    });
    copy.notes = copy.notes.filter(function (n) { return !n.example; }).map(function (n) {
      if (n.courseId && removedCourses[n.courseId]) n.courseId = null;
      return n;
    });
    return copy;
  }

  function countExamples(data) {
    return data.courses.filter(function (c) { return c.example; }).length +
      data.tasks.filter(function (t) { return t.example; }).length +
      data.notes.filter(function (n) { return n.example; }).length;
  }

  /** Verwijdert een vak. Taken en aantekeningen blijven bestaan zonder vak. */
  function deleteCourse(data, courseId) {
    data.courses = data.courses.filter(function (c) { return c.id !== courseId; });
    data.tasks.forEach(function (t) { if (t.courseId === courseId) t.courseId = null; });
    data.notes.forEach(function (n) { if (n.courseId === courseId) n.courseId = null; });
    return data;
  }

  /** Voegt toe of vervangt (op id). */
  function upsert(list, item) {
    var i = list.findIndex(function (x) { return x.id === item.id; });
    if (i >= 0) list[i] = item; else list.push(item);
    return list;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    BACKUP_KEY: BACKUP_KEY,
    CORRUPT_PREFIX: CORRUPT_PREFIX,
    PRIORITIES: PRIORITIES,
    COURSE_COLORS: COURSE_COLORS,
    DAYS_LONG: DAYS_LONG,
    MONTHS: MONTHS,
    uid: uid,
    parseDue: parseDue,
    normalizeDue: normalizeDue,
    parseGrade: parseGrade,
    parseEcts: parseEcts,
    toLocalDate: toLocalDate,
    toLocalDateTime: toLocalDateTime,
    emptyData: emptyData,
    defaultSettings: defaultSettings,
    validateTask: validateTask,
    validateCourse: validateCourse,
    validateNote: validateNote,
    validateSettings: validateSettings,
    sanitizeData: sanitizeData,
    loadData: loadData,
    saveData: saveData,
    exportData: exportData,
    importData: importData,
    taskStatus: taskStatus,
    sortTasks: sortTasks,
    filterTasks: filterTasks,
    urgentTasks: urgentTasks,
    upcomingTasks: upcomingTasks,
    isCoursePassed: isCoursePassed,
    courseProgress: courseProgress,
    ectsSummary: ectsSummary,
    weightedAverage: weightedAverage,
    weekDays: weekDays,
    isoWeek: isoWeek,
    tasksOnDay: tasksOnDay,
    backupDue: backupDue,
    formatDue: formatDue,
    relativeDue: relativeDue,
    formatGrade: formatGrade,
    formatNumber: formatNumber,
    exampleData: exampleData,
    removeExamples: removeExamples,
    countExamples: countExamples,
    deleteCourse: deleteCourse,
    mergeFeed: mergeFeed,
    rememberDismissed: rememberDismissed,
    upsert: upsert
  };
});
