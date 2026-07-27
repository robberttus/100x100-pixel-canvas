# 100x100 Collaborative Pixel Grid 🎨

Een real-time, interactieve webpagina waarop iedereen online om de 5 minuten 1 pixel kan inkleuren op een raster van 100x100 pixels (10.000 pixels totaal).

---

## 🚀 Handleiding: Stap-voor-stap je website gratis live zetten!

Omdat je aangaf een "codeer noob" te zijn, is deze handleiding zo eenvoudig mogelijk geschreven. Volg deze stappen exact om je website gratis op internet te publiceren via **GitHub** en **Render.com**.

---

### Deel 1: Lokaal uitproberen op je eigen computer

1. Open het programma **PowerShell** of je Terminal in de map van dit project (`c:\Users\robbe\Documents\antigravity\100x100`).
2. Typ het volgende commando om de benodigde onderdelen te installeren:
   ```bash
   npm install
   ```
3. Start de server met:
   ```bash
   npm start
   ```
4. Open je internetbrowser en ga naar: `http://localhost:3000`
5. Je ziet nu je werkende 100x100 pixel grid!

---

### Deel 2: De code op GitHub zetten

1. Ga naar [GitHub.com](https://github.com) en log in met je account.
2. Klik rechtsboven op de plusknop **`+`** en kies **New repository**.
3. Vul de volgende gegevens in:
   - **Repository name**: `100x100-pixel-canvas`
   - Kies **Public**.
   - Laat alle vinkjes (*Add a README file*, etc.) **UIT** staan (niet aanvinken).
   - Klik op de groene knop **Create repository**.
4. Je ziet nu instructies op je scherm om bestaande code te uploaden. Typ in je terminal/PowerShell in deze map de volgende commando's achter elkaar (vervang `JOUW-GEBRUIKERSNAAM` door je eigen GitHub gebruikersnaam):

   ```bash
   git init
   git add .
   git commit -m "Initial commit of 100x100 pixel grid app"
   git branch -M main
   git remote add origin https://github.com/JOUW-GEBRUIKERSNAAM/100x100-pixel-canvas.git
   git push -u origin main
   ```

   *(Als je GitHub Desktop gebruikt, kun je deze map ook simpelweg toevoegen via "Add Existing Repository" en klikken op "Publish Repository").*

---

### Deel 3: Gratis PostgreSQL Database aanmaken op Render.com

Render.com heeft een ingebouwde gratis database waarin we alle ingekleurde pixels permanent bewaren.

1. Ga naar [Render.com](https://dashboard.render.com) en meld je aan.
2. Klik rechtsboven op de blauwe knop **New +** en kies **PostgreSQL**.
3. Vul het formulier in:
   - **Name**: `pixel-db`
   - **Database**: `pixeldb`
   - **User**: `pixeluser`
   - **Region**: Kies de dichtstbijzijnde (bijv. Frankfurt / Europe).
   - **Instance Type**: Kies **Free** ($0/month).
4. Klik onderaan op **Create Database**.
5. Wacht 1 à 2 minuten tot de database de status **Available** krijgt.
6. Scroll op de pagina van de database naar het kopje **Connections**.
7. Zoek naar **Internal Database URL** en klik op het kopieer-icoon (het ziet er uit zoals `postgres://pixeluser:password@dpg-xxx-a:5432/pixeldb`). Bewaar deze link even!

---

### Deel 4: Je Web Service aanmaken op Render.com

Nu gaan we de Node.js server live zetten die de website toont.

1. Klik in Render.com rechtsboven op **New +** en kies **Web Service**.
2. Kies de optie **Build and deploy from a Git repository** en klik op **Next**.
3. Koppel je GitHub account als dat nog niet gebeurd is, en selecteer je repository **`100x100-pixel-canvas`**.
4. Vul de instellingen als volgt in:
   - **Name**: `100x100-pixel-canvas` (of een naam naar keuze).
   - **Region**: Frankfurt (of dezelfde als je database).
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free** ($0/month).
5. Scroll naar beneden naar het kopje **Environment Variables** (Omgevingsvariabelen):
   - Klik op **Add Environment Variable**.
   - Bij **Key**: vul in `DATABASE_URL`
   - Bij **Value**: plak hier de **Internal Database URL** die je in Deel 3 gekopieerd hebt.
6. Klik onderaan op **Create Web Service**.

---

### Deel 5: Gefeliciteerd! Je site is Live! 🎉

Render gaat nu automatisch je code bouwen. Na circa 2-3 minuten zie je bovenaan je scherm in het groen **Live** staan, met een unieke URL (bijvoorbeeld: `https://100x100-pixel-canvas.onrender.com`).

- Klik op die link of open hem op je telefoon en computer.
- Iedereen die naar deze link surft ziet **exact hetzelfde canvas** en kan **om de 5 minuten 1 pixel aanpassen**.
- Alles wordt live gesynchroniseerd en 100% permanent opgeslagen!

---

## 🛠️ Functionaliteiten in de app

- **100x100 Grid (10.000 pixels)**: Begint volledig wit met een strak zwart randje.
- **Engelse UI**:
  - Popup bij eerste bezoek met uitleg.
  - Vaste kleurenbalk onderaan met 11 kleuren (rood, oranje, geel, groen, blauw, roze, paars, zwart, wit).
  - Cooldown-timer van 5 minuten per apparaat/IP-adres.
- **Bediening Computer**:
  - Scrollen om in/uit te zoomen.
  - Ingedrukt houden en slepen om de grid te verplaatsen.
- **Bediening Telefoon**:
  - Pinch-to-zoom (2 vingers) om in/uit te zoomen.
  - Vinger slepen om de grid te verplaatsen.
  - Horizontaal scrollbare kleurenbalk op smalle schermen.
