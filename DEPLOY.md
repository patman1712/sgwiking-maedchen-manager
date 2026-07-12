# Railway Deployment

## 1. Projekt hochladen
- Repository zu GitHub pushen
- In Railway `New Project` waehlen
- `Deploy from GitHub repo` auswaehlen

## 2. Volume fuer SQLite anlegen
- Im Railway-Projekt einen `Volume` erstellen
- Mount Path auf `/app/data` setzen

## 3. Environment-Variablen setzen
- `DATA_DIR=/app/data`
- `NODE_ENV=production`

`PORT` wird von Railway automatisch gesetzt und muss normalerweise nicht manuell gepflegt werden.

## 4. Build und Start
Die App ist bereits vorbereitet:
- Build: `npm run build`
- Start: `npm run start`

Railway erkennt das ueber `nixpacks.toml` und `Procfile`.

## 5. Nach dem ersten Start
- Deployment abwarten
- Im Browser die Railway-URL aufrufen
- Mit dem Admin-Demo-Zugang anmelden:
  - `admin@wiking-verein.de`
  - `admin123`

## 6. Wichtig fuer spaetere Updates
- Ohne Volume waere die SQLite-Datei nach Redeployments nicht dauerhaft sicher
- Mit Volume bleiben Benutzer, Teams und Nachrichten erhalten
