# Active Context

## Aktueller Fokus
- Optimierung und Absicherung des Utility Trackers.
- Integration des Trackers in den geschützten Bereich nach dem Login.

## Jüngste Änderungen
- **Utility Tracker Umzug**: Der Utility Tracker wurde in der `index.html` in die `private-files-section` verschoben.
- **Bugfix RPC Endpoints**: Die RPC-URL für XRP wurde auf einen öffentlichen Endpoint (`https://s1.ripple.com:51234`) umgestellt, da der lokale Endpoint nicht erreichbar war.
- **Stellar (XLM) Integration**: XLM Daten werden nun über die öffentliche Horizon API (`https://horizon.stellar.org`) bezogen.
- **Login-Logik**: Der Tracker wird nun erst beim Login initialisiert und sichtbar geschaltet. Beim Logout wird er versteckt und die Aktualisierungen pausiert.

## Nächste Schritte
- Überprüfung der Datenaktualität der APIs.
- Eventuell weitere Krypto-Assets hinzufügen.
- Design-Feinschliff der Tracker-Kacheln.
