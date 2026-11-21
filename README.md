# Studiedashboard

Een persoonlijk dashboard voor je studie aan de hogeschool: deadlines, taken, vakken, cijfers, EC's en aantekeningen op één plek. Het draait helemaal op je eigen Mac, zonder internet, server of account.

> Dit is een eigen hulpmiddel en **geen officiële app van Avans Hogeschool**. Controleer deadlines altijd in Brightspace.

---

## 1. Starten (Mac)

1. Zet de map `studiedashboard` op een vaste plek, bijvoorbeeld in je map **Documenten**.
2. Open de map en **dubbelklik op `Studiedashboard.html`**.
3. De app opent in je browser (Safari of Chrome). Klaar.

Tip: zet het dashboard in je Dock. Sleep `Studiedashboard.html` naar de rechterkant van het Dock (naast de prullenmand). Of voeg de pagina in Safari toe als bladwijzer (`⌘ + D`).

Opent het bestand in een ander programma (bijvoorbeeld Teksteditor)? Klik dan met de rechtermuisknop op `Studiedashboard.html`, kies **Open met** en dan **Safari**.

---

## 2. Hoe werkt het?

| Scherm | Wat zie je |
|---|---|
| **Overzicht** | De startpagina. Bovenaan wat **nu belangrijk** is: taken die te laat zijn of binnen 3 dagen moeten. Daaronder de deadlines daarna, de voortgang per vak, je EC's en gemiddelde. |
| **Taken** | Al je deadlines en opdrachten. Vink af wat klaar is. Filter op *Open*, *Urgent*, *Af* of *Alle*, op vak, of zoek. Sorteer op deadline, prioriteit of naam. |
| **Week** | Je deadlines per dag, van maandag tot en met zondag. Blader met *Vorige* en *Volgende*. Klik op **+** onder een dag om daar een taak te plannen. |
| **Vakken & cijfers** | Per vak: cijfer, EC's, en hoeveel taken af zijn. EC's tellen mee zodra je een **5,5 of hoger** hebt, of als je *Gehaald* handmatig aanzet (voor vakken met "voldaan"). |
| **Aantekeningen** | Afspraken, feedback en ideeën. Koppel ze aan een vak en pin belangrijke vast op de startpagina. |
| **Lesstof** | Per week en per vak een uitleg van wat er in de lessen behandeld is (samenvatting van de dia's). Wordt elke week aangevuld via `app/lesstof.js`. |
| **Instellingen** | Licht/donker, wanneer iets "urgent" is, back-up maken en terugzetten, voorbeelden verwijderen. |

**Toevoegen, aanpassen, verwijderen**
- Toevoegen: de rode knop rechtsboven (of druk op de toets `n` voor een nieuwe taak).
- Aanpassen: klik op het potloodje ✎, op een vak (*Bewerken*) of op een aantekening.
- Verwijderen: het prullenbakje 🗑 of de knop *Verwijderen* in het venster. Direct daarna kun je nog op **Ongedaan maken** klikken.

**Kleuren van een taak**
- Rood *Te laat*: de deadline is voorbij.
- Rood *Urgent*: deadline binnen 3 dagen (aan te passen in Instellingen).
- Geel *Binnenkort*: binnen 2 weken.
- Groen *Af*.

**Licht of donker**: klik linksonder op *Weergave*. *Automatisch* volgt je Mac.

### Voorbeeldgegevens
De eerste keer staan er een paar voorbeelden in, met een blauw label **Voorbeeld**. Ze zijn gebaseerd op blok 2 (Partner Selection), maar **de EC's en datums zijn niet gecontroleerd**. Pas ze aan of verwijder ze allemaal in één keer via **Instellingen → Verwijder voorbeelden**.

---

## 3. Je gegevens bewaren en een back-up maken

**Automatisch bewaren.** Alles wat je invult wordt meteen bewaard in je browser op deze Mac. Sluit je de app en open je hem later weer, dan staat alles er nog. Je hoeft nooit op "opslaan" te drukken.

**Belangrijk om te weten**
- Je gegevens horen bij **de browser** waarin je de app opent. Open je de app in Safari, dan staan ze in Safari. In Chrome zie je ze dan niet. Kies dus één browser.
- Verplaats of hernoem de map `studiedashboard` liever niet. Safari kan de gegevens dan niet meer terugvinden. Moet het toch? Maak eerst een back-up en zet hem daarna terug.
- Als je in Safari **Geschiedenis wissen** of **Websitedata verwijderen** gebruikt, kan het dashboard leeg raken. Een back-up voorkomt dat je iets kwijtraakt.
- In een **privévenster** wordt niets bewaard. De app laat dan een rode melding zien.

**Back-up maken (aanrader: elke week of na veel wijzigingen)**
1. Ga naar **Instellingen**.
2. Klik op **Download back-up**.
3. Er komt een bestand in je map **Downloads**, bijvoorbeeld `studiedashboard-backup-2026-11-21.json`.
4. Zet dat bestand op een veilige plek, bijvoorbeeld in **iCloud Drive** of **OneDrive**.

**Back-up terugzetten** (na een nieuwe Mac, andere browser of als er iets mis is)
1. Ga naar **Instellingen**.
2. Klik bij *Back-up terugzetten* op **Bestand kiezen…** en kies je back-upbestand.
3. De app laat zien wat erin staat. Klik op **Terugzetten**.

Wil je een melding als het tijd is voor een back-up? Zet dan bij **Instellingen → Herinnering** een termijn aan (standaard staat dit uit).

**Ingebouwde veiligheid**
- Bij elke wijziging bewaart de app ook de vorige versie als reservekopie.
- Is het opslagbestand beschadigd geraakt, dan zet de app automatisch die vorige versie terug en meldt dat bovenaan. De kapotte versie wordt apart bewaard.
- Onleesbare onderdelen worden overgeslagen. De rest blijft gewoon werken.
- Foute invoer (zoals een cijfer van 12 of 31 februari) wordt geweigerd met een duidelijke melding bij het veld.

---

## 4. Op je iPhone

De iPhone kan geen bestand van je Mac openen als app. Daarom staat het dashboard op een eigen webadres (via GitHub Pages, gratis). Dat adres laad je één keer, daarna zet je het als app op je beginscherm. Het werkt dan ook zonder internet.

**Installeren**
1. Open het webadres van je dashboard in **Safari** op je iPhone (bijvoorbeeld `https://ji358mmy.github.io/Studiedashboard/`).
2. Tik onderin op het **deel-icoon** (vierkantje met pijl omhoog).
3. Kies **Zet op beginscherm** en tik op **Voeg toe**.
4. Open het dashboard voortaan via het rode icoon **Studie** op je beginscherm.

**Updates gaan vanzelf.** Een nieuwe versie van de app komt automatisch binnen de volgende keer dat je hem met internet opent.

**Deadlines komen vanzelf binnen.** Elke ochtend wordt Brightspace gecontroleerd en worden je deadlines in de lijst `deadlines.json` gezet. Zodra je de app opent, worden nieuwe deadlines toegevoegd (label **Brightspace**) en worden verschoven datums bijgewerkt. Wat je zelf afvinkt, je prioriteit en je notities blijven van jou, net als een naam of datum die je zelf hebt aangepast. Verandert Brightspace later toch de datum, dan krijg je die nieuwe datum. Een deadline of vak dat je verwijdert, komt niet terug, en een vak mag je gewoon een andere naam geven. Je kunt dit uitzetten via **Instellingen → Automatische deadlines**. Let op: deze lijst staat openbaar op GitHub (alleen de namen en datums van opdrachten, geen cijfers of aantekeningen).

**Synchroniseert het met je Mac? Nee.** Je iPhone en je Mac hebben elk hun eigen gegevens. Wat je op de ene invult, zie je niet vanzelf op de andere. Overzetten doe je met een back-up:
1. Op het apparaat met de nieuwste gegevens: **Instellingen → Download back-up**. Op de iPhone kies je in het menu **Bewaar in Bestanden** en dan **iCloud Drive**.
2. Op het andere apparaat: **Instellingen → Bestand kiezen…** en kies dat back-upbestand.

Tip: kies één apparaat als "hoofdapparaat" (bijvoorbeeld je iPhone) en gebruik het andere vooral om te kijken.

**Let op op de iPhone**
- Open het dashboard altijd via het icoon op je beginscherm. Gegevens in de app op het beginscherm staan los van gewone Safari-tabbladen.
- Verwijder je het icoon van je beginscherm, dan verdwijnen ook de gegevens op je iPhone. Maak eerst een back-up.
- Je gegevens staan alleen op je iPhone, niet online. Op het webadres staat alleen de (lege) app.

---

## 5. Problemen oplossen

| Probleem | Oplossing |
|---|---|
| Het dashboard is leeg, maar ik had gegevens. | Kijk of je dezelfde browser gebruikt als eerst, en of de map niet verplaatst is. Zet anders je laatste back-up terug. |
| Er staat een rode melding "Opslaan is mislukt". | Klik op *Back-up maken*. Herstart daarna de browser. Werkt het nog niet, verwijder dan oude aantekeningen. |
| Het bestand opent als tekst/code. | Rechtermuisklik → *Open met* → *Safari*. |
| Het scherm blijft wit. | Zet JavaScript aan: Safari → Instellingen → Beveiliging → *JavaScript inschakelen*. |
| Ik wil helemaal opnieuw beginnen. | Instellingen → *Alles wissen…* (maak eerst een back-up). |

---

## 6. Tests

De rekenregels, de opslag en het automatisch ophalen zijn getest (62 tests): sorteren, urgentie, EC's, gemiddelde, invoercontrole, opslaan en herladen, beschadigde opslag, volle opslag en back-ups.

- **Zonder programmeerkennis:** dubbelklik op `tests/tests.html`. Je ziet een groene balk "Alle 62 tests geslaagd". Je eigen gegevens worden daarbij niet gebruikt.
- **Met Node.js (optioneel):** open Terminal in de map en typ `node tests/run-tests.js`.

---

## 7. Voor wie verder wil bouwen (technisch)

**Bestandsstructuur**
```
studiedashboard/
├── Studiedashboard.html   ← dubbelklik om te starten
├── README.md              ← deze uitleg
├── index.html             ← stuurt door naar Studiedashboard.html (voor het webadres)
├── manifest.webmanifest   ← naam en icoon voor "Zet op beginscherm"
├── sw.js                  ← zorgt dat de iPhone-app ook offline werkt
├── deadlines.json         ← deadlines uit Brightspace (wordt automatisch bijgewerkt)
├── app/
│   ├── core.js            ← logica: validatie, opslag, sorteren, berekeningen (geen schermcode)
│   ├── app.js             ← schermen, formulieren en bediening
│   ├── styles.css         ← opmaak, licht en donker thema, iPhone-indeling
│   └── icons/             ← app-iconen
└── tests/
    ├── tests.html         ← tests in de browser
    ├── run-tests.js       ← tests in de terminal (Node.js)
    ├── test-runner.js     ← mini-testrunner, zonder afhankelijkheden
    └── core.test.js       ← de tests
```

**Keuzes**
- Gewone HTML, CSS en JavaScript, zonder framework, zonder bouwstap en zonder internetverbinding. Daardoor start het met een dubbelklik en blijft het jaren werken.
- Opslag in `localStorage` onder de sleutel `studiedashboard.data.v1`, met reservekopie `studiedashboard.data.v1.vorige`. Bij beschadiging wordt de kapotte inhoud bewaard onder `studiedashboard.beschadigd.<tijd>`.
- Alle gegevens gaan bij laden en importeren door `sanitizeData` in `core.js`. Ongeldige onderdelen worden overgeslagen, zodat de app nooit crasht op een vreemd bestand.
- Tekst van de gebruiker wordt altijd als tekst (`textContent`) getoond en nooit als HTML. Een back-upbestand kan dus geen code uitvoeren.
- Back-upformaat: `{ "app": "studiedashboard", "exportedAt": "...", "data": { "version": 1, "settings": {...}, "courses": [...], "tasks": [...], "notes": [...] } }`.
- Op het webadres werkt een service worker (`sw.js`): eerst netwerk, zonder internet de bewaarde kopie. Verhoog `VERSION` in `sw.js` na een wijziging.
- `deadlines.json` heeft het formaat `{ "app": "studiedashboard-feed", "updatedAt", "courses": [{ "name", "code", "ects" }], "tasks": [{ "id", "title", "due": "YYYY-MM-DDTHH:mm", "course", "url", "notes", "instructions" }] }`. `instructions` is de uitleg van de opdracht (wat je moet maken), wordt bij elke update overschreven en staat onder "Wat moet je maken?" bij de taak. `id` moet per opdracht altijd hetzelfde blijven. Samenvoegen gebeurt in `mergeFeed` in `core.js`.
- Back-up op iPhone/iPad gaat via het deelmenu (`navigator.share`), op de Mac via een download.
- Automatisch getest in Chromium, ook op iPhone-formaat en offline (licht, donker, smal scherm). Gebouwd met functies die Safari 15.4 of nieuwer, Chrome, Edge en Firefox ondersteunen.
