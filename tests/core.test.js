/*
 * Tests voor de kernfuncties en de opslag.
 * Draai ze door tests/tests.html te openen, of met: node tests/run-tests.js
 */
(function (root) {
  'use strict';
  var SD = typeof require === 'function' && typeof module === 'object' ? require('../app/core.js') : root.SD;
  var TR = typeof require === 'function' && typeof module === 'object' ? require('./test-runner.js') : root.TR;
  var test = TR.test, assert = TR.assert;

  var NOW = new Date(2026, 10, 21, 12, 0); // za 21 nov 2026, 12:00

  function task(over) {
    var base = { title: 'Taak', due: null, done: false, priority: 'normaal' };
    Object.keys(over || {}).forEach(function (k) { base[k] = over[k]; });
    var r = SD.validateTask(base, []);
    if (!r.ok) throw new Error('Testtaak ongeldig: ' + JSON.stringify(r.errors));
    return r.value;
  }

  /* ---------- Invoer lezen ---------- */

  test('parseDue: datum zonder tijd wordt einde van de dag', function () {
    var d = SD.parseDue('2026-11-27');
    assert.equal(d.getHours(), 23);
    assert.equal(d.getMinutes(), 59);
  });
  test('parseDue: datum met tijd', function () {
    assert.equal(SD.normalizeDue('2026-11-27T09:00'), '2026-11-27T09:00');
  });
  test('parseDue: ongeldige datums geven null', function () {
    ['2026-02-31', '2026-13-01', 'morgen', '27-11-2026', '2026-11-27T25:00', '', null, undefined, 42].forEach(function (v) {
      assert.equal(SD.parseDue(v), null, 'invoer ' + v);
    });
  });
  test('parseGrade: komma en punt', function () {
    assert.equal(SD.parseGrade('7,5').value, 7.5);
    assert.equal(SD.parseGrade('8.25').value, 8.3);
    assert.equal(SD.parseGrade('10').value, 10);
    assert.equal(SD.parseGrade('').value, null);
  });
  test('parseGrade: ongeldige cijfers worden geweigerd', function () {
    ['0', '11', 'goed', '-3', '7,5,5', '1e1'].forEach(function (v) {
      assert.equal(SD.parseGrade(v).ok, false, 'invoer ' + v);
    });
  });
  test('parseEcts: geldig en ongeldig', function () {
    assert.equal(SD.parseEcts('7,5').value, 7.5);
    assert.equal(SD.parseEcts('').value, 0);
    assert.equal(SD.parseEcts('-1').ok, false);
    assert.equal(SD.parseEcts('veel').ok, false);
    assert.equal(SD.parseEcts('999').ok, false);
  });

  /* ---------- Validatie ---------- */

  test('validateTask: naam is verplicht', function () {
    var r = SD.validateTask({ title: '   ' }, []);
    assert.equal(r.ok, false);
    assert.ok(r.errors.title);
  });
  test('validateTask: foute datum geeft foutmelding bij het datumveld', function () {
    var r = SD.validateTask({ title: 'X', due: '2026-02-30' }, []);
    assert.equal(r.ok, false);
    assert.ok(r.errors.due);
  });
  test('validateTask: onbekend vak wordt losgekoppeld, taak blijft', function () {
    var r = SD.validateTask({ title: 'X', courseId: 'bestaat-niet' }, [{ id: 'a' }]);
    assert.equal(r.ok, true);
    assert.equal(r.value.courseId, null);
  });
  test('validateTask: te lange titel wordt ingekort, onbekende prioriteit wordt normaal', function () {
    var r = SD.validateTask({ title: new Array(500).join('a'), priority: 'superhoog' }, []);
    assert.equal(r.value.title.length, 200);
    assert.equal(r.value.priority, 'normaal');
  });
  test('validateTask: geen object geeft nette fout', function () {
    assert.equal(SD.validateTask(null).ok, false);
    assert.equal(SD.validateTask('tekst').ok, false);
    assert.equal(SD.validateTask([1, 2]).ok, false);
  });
  test('validateCourse: cijfer en EC\'s worden gecontroleerd', function () {
    var r = SD.validateCourse({ name: 'Vak', ects: 'vijf', grade: '12' }, []);
    assert.equal(r.ok, false);
    assert.ok(r.errors.ects);
    assert.ok(r.errors.grade);
    var ok = SD.validateCourse({ name: 'Vak', ects: '5', grade: '6,8' }, []);
    assert.equal(ok.ok, true);
    assert.equal(ok.value.grade, 6.8);
    assert.equal(ok.value.ects, 5);
  });
  test('validateCourse: ongeldige kleur krijgt standaardkleur', function () {
    var r = SD.validateCourse({ name: 'Vak', color: 'red; background:url(x)' }, []);
    assert.ok(/^#[0-9a-f]{6}$/.test(r.value.color));
  });
  test('validateNote: titel of tekst nodig', function () {
    assert.equal(SD.validateNote({ title: '', body: '' }, []).ok, false);
    var r = SD.validateNote({ title: '', body: 'alleen tekst' }, []);
    assert.equal(r.ok, true);
    assert.equal(r.value.title, 'Zonder titel');
  });
  test('validateSettings: rare waarden worden standaard', function () {
    var s = SD.validateSettings({ theme: 'roze', urgentDays: 'veel', passGrade: '99', backupReminderDays: -5 });
    assert.deepEqual(s, SD.defaultSettings());
  });

  /* ---------- Status en sortering ---------- */

  test('taskStatus: te laat, urgent (3 dagen), binnenkort, later, af, geen datum', function () {
    assert.equal(SD.taskStatus(task({ due: '2026-11-20T09:00' }), NOW, 3), 'te-laat');
    assert.equal(SD.taskStatus(task({ due: '2026-11-23T09:00' }), NOW, 3), 'urgent');
    assert.equal(SD.taskStatus(task({ due: '2026-11-27T09:00' }), NOW, 3), 'binnenkort');
    assert.equal(SD.taskStatus(task({ due: '2027-01-11T09:00' }), NOW, 3), 'later');
    assert.equal(SD.taskStatus(task({ due: '2026-11-20T09:00', done: true }), NOW, 3), 'af');
    assert.equal(SD.taskStatus(task({}), NOW, 3), 'geen-datum');
  });
  test('taskStatus: urgentiegrens is instelbaar', function () {
    var t = task({ due: '2026-11-27T09:00' });
    assert.equal(SD.taskStatus(t, NOW, 7), 'urgent');
    assert.equal(SD.taskStatus(t, NOW, 3), 'binnenkort');
  });
  test('sortTasks: open eerst, vroegste deadline eerst, zonder datum achteraan', function () {
    var list = [
      task({ title: 'C', due: '2026-12-01' }),
      task({ title: 'Geen datum' }),
      task({ title: 'A', due: '2026-11-23T09:00' }),
      task({ title: 'Af', due: '2026-11-01', done: true }),
      task({ title: 'B', due: '2026-11-27T09:00' })
    ];
    assert.deepEqual(SD.sortTasks(list).map(function (t) { return t.title; }), ['A', 'B', 'C', 'Geen datum', 'Af']);
  });
  test('sortTasks: verandert de originele lijst niet', function () {
    var list = [task({ title: 'B', due: '2026-12-01' }), task({ title: 'A', due: '2026-11-01' })];
    SD.sortTasks(list);
    assert.equal(list[0].title, 'B');
  });
  test('sortTasks: op prioriteit', function () {
    var list = [task({ title: 'laag', priority: 'laag', due: '2026-11-22' }), task({ title: 'hoog', priority: 'hoog', due: '2026-12-22' })];
    assert.equal(SD.sortTasks(list, 'prioriteit')[0].title, 'hoog');
  });
  test('filterTasks: op status, vak en zoektekst', function () {
    var list = [
      task({ title: 'Spaans WA', courseId: null, due: '2026-11-23T09:00' }),
      task({ title: 'Verslag', due: '2026-12-20' }),
      task({ title: 'Oud', done: true })
    ];
    assert.equal(SD.filterTasks(list, { show: 'open' }, NOW, 3).length, 2);
    assert.equal(SD.filterTasks(list, { show: 'af' }, NOW, 3).length, 1);
    assert.equal(SD.filterTasks(list, { show: 'urgent' }, NOW, 3).length, 1);
    assert.equal(SD.filterTasks(list, { query: 'spaans' }, NOW, 3).length, 1);
  });
  test('urgentTasks en upcomingTasks op de startpagina', function () {
    var d = SD.emptyData();
    d.tasks = [
      task({ title: 'te laat', due: '2026-11-19' }),
      task({ title: 'urgent', due: '2026-11-23T09:00' }),
      task({ title: 'later', due: '2026-12-10' }),
      task({ title: 'af', due: '2026-11-22', done: true })
    ];
    assert.deepEqual(SD.urgentTasks(d, NOW).map(function (t) { return t.title; }), ['te laat', 'urgent']);
    assert.deepEqual(SD.upcomingTasks(d, NOW).map(function (t) { return t.title; }), ['later']);
  });

  /* ---------- Vakken, EC's en cijfers ---------- */

  test("ectsSummary: alleen gehaalde vakken tellen mee", function () {
    var d = SD.emptyData();
    d.courses = [
      SD.validateCourse({ name: 'A', ects: 5, grade: '7' }).value,
      SD.validateCourse({ name: 'B', ects: 5, grade: '5,4' }).value,
      SD.validateCourse({ name: 'C', ects: 2, passed: 'ja' }).value,
      SD.validateCourse({ name: 'D', ects: 3 }).value
    ];
    var s = SD.ectsSummary(d);
    assert.equal(s.earned, 7);
    assert.equal(s.total, 15);
    assert.equal(s.remaining, 8);
  });
  test('isCoursePassed: 5,5 is voldoende', function () {
    assert.equal(SD.isCoursePassed({ grade: 5.5, passed: 'auto' }, 5.5), true);
    assert.equal(SD.isCoursePassed({ grade: 5.4, passed: 'auto' }, 5.5), false);
    assert.equal(SD.isCoursePassed({ grade: 8, passed: 'nee' }, 5.5), false);
  });
  test("weightedAverage: gewogen naar EC's, null zonder cijfers", function () {
    assert.equal(SD.weightedAverage([{ grade: 8, ects: 3 }, { grade: 6, ects: 1 }]), 7.5);
    assert.equal(SD.weightedAverage([{ grade: null, ects: 3 }]), null);
    assert.equal(SD.weightedAverage([{ grade: 7, ects: 0 }, { grade: 8, ects: 0 }]), 7.5);
  });
  test('courseProgress: percentage taken af', function () {
    var d = SD.emptyData();
    d.tasks = [task({ courseId: null })];
    d.tasks[0].courseId = 'v';
    d.tasks.push(Object.assign(task({}), { courseId: 'v', done: true }));
    var p = SD.courseProgress(d, 'v');
    assert.equal(p.total, 2);
    assert.equal(p.pct, 50);
    assert.equal(SD.courseProgress(d, 'leeg').pct, 0);
  });
  test('deleteCourse: taken en aantekeningen blijven, zonder vak', function () {
    var d = SD.exampleData();
    var before = d.tasks.length;
    SD.deleteCourse(d, 'vb-vak-project');
    assert.equal(d.tasks.length, before);
    assert.ok(d.tasks.every(function (t) { return t.courseId !== 'vb-vak-project'; }));
    assert.ok(d.notes.every(function (n) { return n.courseId !== 'vb-vak-project'; }));
  });

  /* ---------- Week en datums ---------- */

  test('weekDays: maandag t/m zondag', function () {
    var days = SD.weekDays(NOW);
    assert.equal(days.length, 7);
    assert.equal(days[0].getDay(), 1);
    assert.equal(days[0].getDate(), 16);
    assert.equal(days[6].getDate(), 22);
  });
  test('isoWeek: 21 nov 2026 is week 47, 1 jan 2027 is week 53', function () {
    assert.equal(SD.isoWeek(NOW), 47);
    assert.equal(SD.isoWeek(new Date(2027, 0, 1)), 53);
  });
  test('relativeDue in gewone taal', function () {
    assert.equal(SD.relativeDue('2026-11-21', NOW), 'vandaag');
    assert.equal(SD.relativeDue('2026-11-22', NOW), 'morgen');
    assert.equal(SD.relativeDue('2026-11-23', NOW), 'over 2 dagen');
    assert.equal(SD.relativeDue('2026-11-18', NOW), '3 dagen te laat');
    assert.equal(SD.relativeDue('2026-11-21T09:00', NOW), 'vandaag verlopen');
  });
  test('formatDue in het Nederlands', function () {
    assert.equal(SD.formatDue('2026-11-27T09:00'), 'vr 27 nov 2026, 09:00');
    assert.equal(SD.formatDue('2026-11-27'), 'vr 27 nov 2026');
    assert.equal(SD.formatDue(null), 'Geen deadline');
  });

  /* ---------- Opslag ---------- */

  test('opslag: eerste keer openen geeft status nieuw', function () {
    var r = SD.loadData(TR.memoryStorage());
    assert.equal(r.status, 'nieuw');
  });
  test('opslag: opslaan en opnieuw laden geeft dezelfde gegevens', function () {
    var st = TR.memoryStorage();
    var d = SD.exampleData();
    d.tasks[0].done = true;
    d.tasks[0].doneAt = '2026-11-21T10:00:00.000Z';
    d.settings.theme = 'donker';
    assert.equal(SD.saveData(st, d).ok, true);
    var r = SD.loadData(st);
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.data, d);
  });
  test('opslag: vorige versie wordt als reservekopie bewaard', function () {
    var st = TR.memoryStorage();
    var d = SD.emptyData();
    d.tasks.push(task({ title: 'Eerste' }));
    SD.saveData(st, d);
    d.tasks.push(task({ title: 'Tweede' }));
    SD.saveData(st, d);
    var backup = JSON.parse(st.getItem(SD.BACKUP_KEY));
    assert.equal(backup.tasks.length, 1);
  });
  test('opslag: beschadigd bestand crasht niet en zet reservekopie terug', function () {
    var good = SD.emptyData();
    good.tasks.push(task({ title: 'Bewaard' }));
    var init = {};
    init[SD.STORAGE_KEY] = '{"version":1,"tasks":[{"title":"hal';
    init[SD.BACKUP_KEY] = JSON.stringify(good);
    var st = TR.memoryStorage(init);
    var r;
    assert.throwsNot(function () { r = SD.loadData(st); });
    assert.equal(r.status, 'reservekopie');
    assert.equal(r.data.tasks[0].title, 'Bewaard');
    var kept = Object.keys(st._data).filter(function (k) { return k.indexOf(SD.CORRUPT_PREFIX) === 0; });
    assert.equal(kept.length, 1, 'kapotte versie apart bewaard');
  });
  test('opslag: beschadigd zonder reservekopie geeft lege start', function () {
    var init = {};
    init[SD.STORAGE_KEY] = 'dit is geen json';
    var r = SD.loadData(TR.memoryStorage(init));
    assert.equal(r.status, 'beschadigd');
    assert.equal(r.data.tasks.length, 0);
    assert.ok(r.message.length > 0);
  });
  test('opslag: JSON van het verkeerde type (array, getal, null) crasht niet', function () {
    ['[]', '42', 'null', '"tekst"', 'true'].forEach(function (raw) {
      var init = {};
      init[SD.STORAGE_KEY] = raw;
      var r;
      assert.throwsNot(function () { r = SD.loadData(TR.memoryStorage(init)); }, 'invoer ' + raw);
      assert.ok(r.data && Array.isArray(r.data.tasks), 'invoer ' + raw);
    });
  });
  test('opslag: losse kapotte onderdelen worden overgeslagen, rest blijft', function () {
    var raw = {
      version: 1,
      settings: { theme: 'donker' },
      courses: [{ name: 'Goed', ects: 5 }, { name: '', ects: 5 }, 'rommel'],
      tasks: [{ title: 'Goed' }, { title: 'Foute datum', due: '2026-99-99' }, null, 7],
      notes: [{ title: 'Notitie' }, { nope: true }]
    };
    var init = {};
    init[SD.STORAGE_KEY] = JSON.stringify(raw);
    var r = SD.loadData(TR.memoryStorage(init));
    assert.equal(r.status, 'hersteld');
    assert.equal(r.data.courses.length, 1);
    assert.equal(r.data.tasks.length, 1);
    assert.equal(r.data.notes.length, 1);
    assert.equal(r.data.settings.theme, 'donker');
  });
  test('opslag: dubbele id\'s worden uniek gemaakt', function () {
    var s = SD.sanitizeData({ tasks: [{ id: 'x', title: 'a' }, { id: 'x', title: 'b' }] });
    assert.ok(s.data.tasks[0].id !== s.data.tasks[1].id);
  });
  test('opslag: geblokkeerde opslag crasht niet', function () {
    var r = SD.loadData(TR.memoryStorage({}, { throwOnGet: true }));
    assert.equal(r.status, 'geen-opslag');
    assert.ok(r.data);
  });
  test('opslag: volle opslag geeft een nette foutmelding', function () {
    var r = SD.saveData(TR.memoryStorage({}, { quota: true }), SD.emptyData());
    assert.equal(r.ok, false);
    assert.ok(/vol/.test(r.error));
  });

  /* ---------- Back-up ---------- */

  test('back-up: exporteren en importeren geeft dezelfde gegevens', function () {
    var d = SD.exampleData();
    var r = SD.importData(SD.exportData(d, NOW));
    assert.equal(r.ok, true);
    assert.deepEqual(r.data, d);
  });
  test('back-up: ongeldige bestanden worden netjes geweigerd', function () {
    ['', '   ', 'geen json', '{"iets":"anders"}', '[]', '{"data":"tekst"}'].forEach(function (txt) {
      var r;
      assert.throwsNot(function () { r = SD.importData(txt); }, 'invoer ' + txt);
      assert.equal(r.ok, false, 'invoer ' + txt);
      assert.ok(r.error);
    });
    assert.equal(SD.importData(null).ok, false);
  });
  test('back-up: oude/kale export zonder omhulsel werkt ook', function () {
    var r = SD.importData(JSON.stringify({ tasks: [{ title: 'Los' }] }));
    assert.equal(r.ok, true);
    assert.equal(r.data.tasks[0].title, 'Los');
  });
  test('back-up: HTML in tekst blijft gewone tekst', function () {
    var r = SD.importData(JSON.stringify({ tasks: [{ title: '<img src=x onerror=alert(1)>' }] }));
    assert.equal(r.data.tasks[0].title, '<img src=x onerror=alert(1)>');
  });
  test('backupDue: herinnering uit, nooit gemaakt, en na de termijn', function () {
    var s = SD.defaultSettings();
    assert.equal(SD.backupDue(s, NOW), false, 'standaard uit');
    s.backupReminderDays = 7;
    assert.equal(SD.backupDue(s, NOW), true, 'nooit gemaakt');
    s.lastBackup = new Date(2026, 10, 19).toISOString();
    assert.equal(SD.backupDue(s, NOW), false);
    s.lastBackup = new Date(2026, 10, 1).toISOString();
    assert.equal(SD.backupDue(s, NOW), true);
  });

  /* ---------- Voorbeeldgegevens ---------- */

  test('voorbeelden: alle items zijn gemarkeerd en geldig', function () {
    var d = SD.exampleData();
    var s = SD.sanitizeData(JSON.parse(JSON.stringify(d)));
    assert.equal(s.dropped, 0);
    assert.ok(d.tasks.length > 0 && d.tasks.every(function (t) { return t.example; }));
    assert.ok(d.courses.every(function (c) { return c.example; }));
  });
  test('voorbeelden: in één keer verwijderen, eigen items blijven', function () {
    var d = SD.exampleData();
    var own = task({ title: 'Eigen taak' });
    own.courseId = 'vb-vak-project';
    d.tasks.push(own);
    var clean = SD.removeExamples(d);
    assert.equal(SD.countExamples(clean), 0);
    assert.equal(clean.tasks.length, 1);
    assert.equal(clean.tasks[0].courseId, null);
  });
  /* ---------- Automatische deadlines (feed) ---------- */

  function feed(tasks, courses) {
    return { app: 'studiedashboard-feed', updatedAt: '2026-11-22T07:39:00+01:00', courses: courses || [], tasks: tasks };
  }

  test('feed: nieuwe deadlines worden toegevoegd met vak en link', function () {
    var d = SD.emptyData();
    var r = SD.mergeFeed(d, feed([
      { id: 'dropbox-1', title: 'Flip the Classroom', due: '2026-11-27T09:00', course: 'Project Partner Selection', url: 'https://brightspace.avans.nl/x' }
    ]));
    assert.equal(r.ok, true);
    assert.equal(r.added, 1);
    assert.equal(r.data.tasks[0].source, 'brightspace');
    assert.equal(r.data.tasks[0].url, 'https://brightspace.avans.nl/x');
    assert.equal(r.data.courses.length, 1);
    assert.equal(r.data.tasks[0].courseId, r.data.courses[0].id);
    assert.equal(r.data.settings.feedUpdatedAt, '2026-11-22T07:39:00+01:00');
    assert.equal(d.tasks.length, 0, 'origineel niet aangepast');
  });
  test('feed: tweede keer dezelfde feed verandert niets', function () {
    var f = feed([{ id: 'a', title: 'A', due: '2026-11-27T09:00' }]);
    var r1 = SD.mergeFeed(SD.emptyData(), f);
    var r2 = SD.mergeFeed(r1.data, f);
    assert.equal(r2.added, 0);
    assert.equal(r2.updated, 0);
    assert.equal(r2.data.tasks.length, 1);
  });
  test('feed: nieuwe datum wordt bijgewerkt, afgevinkt en eigen notities blijven', function () {
    var r1 = SD.mergeFeed(SD.emptyData(), feed([{ id: 'a', title: 'A', due: '2026-11-27T09:00' }]));
    var t = r1.data.tasks[0];
    t.done = true; t.doneAt = '2026-11-21T10:00:00.000Z'; t.notes = 'mijn notitie'; t.priority = 'hoog';
    var r2 = SD.mergeFeed(r1.data, feed([{ id: 'a', title: 'A (verschoven)', due: '2026-11-30T09:00' }]));
    var t2 = r2.data.tasks[0];
    assert.equal(r2.updated, 1);
    assert.equal(t2.due, '2026-11-30T09:00');
    assert.equal(t2.title, 'A (verschoven)');
    assert.equal(t2.done, true);
    assert.equal(t2.notes, 'mijn notitie');
    assert.equal(t2.priority, 'hoog');
    assert.equal(t2.id, t.id);
  });
  test('feed: zelf verwijderde deadline komt niet terug', function () {
    var r1 = SD.mergeFeed(SD.emptyData(), feed([{ id: 'a', title: 'A' }]));
    var d = r1.data;
    SD.rememberDismissed(d, d.tasks[0]);
    d.tasks = [];
    var r2 = SD.mergeFeed(d, feed([{ id: 'a', title: 'A' }]));
    assert.equal(r2.data.tasks.length, 0);
  });
  test('feed: bestaand vak wordt op naam gekoppeld (hoofdletters maakt niet uit)', function () {
    var d = SD.exampleData();
    var r = SD.mergeFeed(d, feed([{ id: 'x', title: 'X', course: 'personal professional development' }]));
    assert.equal(r.data.courses.length, d.courses.length);
    assert.equal(r.data.tasks[r.data.tasks.length - 1].courseId, 'vb-vak-ppd');
  });
  test('feed: ongeldige feed en ongeldige items crashen niet', function () {
    [null, 'tekst', {}, { app: 'iets', tasks: [] }, { app: 'studiedashboard-feed' }].forEach(function (f) {
      var r;
      assert.throwsNot(function () { r = SD.mergeFeed(SD.emptyData(), f); });
      assert.equal(r.ok, false);
    });
    var r = SD.mergeFeed(SD.emptyData(), feed([null, 5, { title: 'geen id' }, { id: 'b', title: '' }, { id: 'c', title: 'Goed', due: 'morgen' }, { id: 'd', title: 'Goed' }]));
    assert.equal(r.ok, true);
    assert.equal(r.data.tasks.length, 1);
    assert.equal(r.skipped, 5);
  });
  test('feed: alleen https-links worden bewaard', function () {
    var r = SD.mergeFeed(SD.emptyData(), feed([
      { id: 'a', title: 'A', url: 'javascript:alert(1)' },
      { id: 'b', title: 'B', url: 'http://onveilig.nl' }
    ]));
    assert.equal(r.data.tasks[0].url, null);
    assert.equal(r.data.tasks[1].url, null);
  });
  test('feed: instellingen blijven bewaard na opslaan en laden', function () {
    var st = TR.memoryStorage();
    var r = SD.mergeFeed(SD.emptyData(), feed([{ id: 'a', title: 'A' }]));
    SD.rememberDismissed(r.data, r.data.tasks[0]);
    SD.saveData(st, r.data);
    var l = SD.loadData(st);
    assert.deepEqual(l.data.settings.feedDismissed, ['bs:a']);
    assert.equal(l.data.tasks[0].externalId, 'bs:a');
  });

  test('feed: eigen aanpassing van naam of datum blijft staan', function () {
    var f = feed([{ id: 'a', title: 'A', due: '2026-11-27T09:00' }]);
    var d = SD.mergeFeed(SD.emptyData(), f).data;
    d.tasks[0].title = 'Mijn eigen naam';
    d.tasks[0].due = '2026-11-26T12:00';
    var r = SD.mergeFeed(d, f);
    assert.equal(r.updated, 0);
    assert.equal(r.data.tasks[0].title, 'Mijn eigen naam');
    assert.equal(r.data.tasks[0].due, '2026-11-26T12:00');
    // Brightspace verschuift de datum later toch: dan wint de nieuwe datum
    var r2 = SD.mergeFeed(r.data, feed([{ id: 'a', title: 'A', due: '2026-12-01T09:00' }]));
    assert.equal(r2.updated, 1);
    assert.equal(r2.data.tasks[0].due, '2026-12-01T09:00');
    assert.equal(r2.data.tasks[0].title, 'Mijn eigen naam');
  });
  test('feed: hernoemd vak wordt niet opnieuw aangemaakt', function () {
    var f = feed([{ id: 'a', title: 'A', course: 'IBC Spanish (LO3)' }], [{ name: 'IBC Spanish (LO3)', ects: 4 }]);
    var d = SD.mergeFeed(SD.emptyData(), f).data;
    d.courses[0].name = 'Spaans';
    var r = SD.mergeFeed(d, f);
    assert.equal(r.data.courses.length, 1);
    assert.equal(r.data.tasks[0].courseId, d.courses[0].id);
  });
  test('feed: verwijderd vak komt niet terug', function () {
    var f = feed([{ id: 'a', title: 'A', course: 'PPD (LO2)' }], [{ name: 'PPD (LO2)' }]);
    var d = SD.mergeFeed(SD.emptyData(), f).data;
    SD.rememberDismissed(d, d.courses[0]);
    SD.deleteCourse(d, d.courses[0].id);
    var r = SD.mergeFeed(d, f);
    assert.equal(r.data.courses.length, 0);
    assert.equal(r.data.tasks[0].courseId, null);
  });
  test('feed: oude taken zonder geheugen worden niet onnodig aangepast', function () {
    var d = SD.mergeFeed(SD.emptyData(), feed([{ id: 'a', title: 'A', due: '2026-11-27T09:00' }])).data;
    d.tasks[0].feed = null; // zoals opgeslagen door de vorige versie van de app
    var r = SD.mergeFeed(d, feed([{ id: 'a', title: 'A', due: '2026-11-27T09:00' }]));
    assert.equal(r.updated, 0);
    assert.ok(r.data.tasks[0].feed && r.data.tasks[0].feed.title === 'A');
  });
  test('instellingen: thema blijft bewaard na opslaan en laden', function () {
    ['licht', 'donker', 'auto'].forEach(function (th) {
      var st = TR.memoryStorage();
      var d = SD.emptyData();
      d.settings.theme = th;
      SD.saveData(st, d);
      assert.equal(SD.loadData(st).data.settings.theme, th);
    });
  });

  test('feed: uitleg bij een opdracht wordt bewaard en bijgewerkt', function () {
    var r1 = SD.mergeFeed(SD.emptyData(), feed([{ id: 'a', title: 'A', instructions: 'Maak X' }]));
    assert.equal(r1.data.tasks[0].feed.instructions, 'Maak X');
    var r2 = SD.mergeFeed(r1.data, feed([{ id: 'a', title: 'A', instructions: 'Maak Y' }]));
    assert.equal(r2.data.tasks[0].feed.instructions, 'Maak Y');
    assert.equal(r2.updated, 0);
    var r3 = SD.mergeFeed(SD.emptyData(), feed([{ id: 'b', title: 'B', instructions: 5 }]));
    assert.equal(r3.data.tasks[0].feed.instructions, '');
  });
  test('upsert: toevoegen en vervangen', function () {
    var list = [{ id: 'a', v: 1 }];
    SD.upsert(list, { id: 'a', v: 2 });
    SD.upsert(list, { id: 'b', v: 3 });
    assert.equal(list.length, 2);
    assert.equal(list[0].v, 2);
  });
})(typeof self !== 'undefined' ? self : this);
