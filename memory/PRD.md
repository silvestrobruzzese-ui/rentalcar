# RE.LE.CO. GROUP / SOVERATO RENTAL - Sistema Gestione Noleggio Auto

## Funzionalità Implementate

### Email Alert via Brevo SMTP (21/04/2026)
- **Alert automatico 5 ore prima della riconsegna** del veicolo
- Background task controlla ogni 15 minuti le prenotazioni attive
- Email HTML professionale con dettagli veicolo, data/ora riconsegna, luogo
- Log email nel database (evita duplicati)
- Endpoint test: `POST /api/email/test-reminder/{prenotazione_id}`
- Endpoint log: `GET /api/email/log`
- Configurazione: Brevo SMTP in backend/.env

### Tariffe Stagionali Dinamiche
- Frontend cliente + contratto con tariffa stagionale
- Modifica durata contratto con ricalcolo automatico

### Contratto Editabile Completo (5 pagine)
- V-BIS editabile (rientro + addebiti → saldo)
- Coperture assicurative escludibili dal totale
- IV. Durata editabile con aggiornamento calendario

### Calendario con Sfumature Uniche
- Ogni stato mantiene colore base, ogni booking ha sfumatura unica HSL

## Credenziali
- Admin: admin@relecogroup.it / admin123
- Cliente: mario.rossi.test@email.com / password123

## Configurazione Email (Brevo)
- SMTP: smtp-relay.brevo.com:587
- Login: a8cf09001@smtp-brevo.com
- Mittente: relecogroup@libero.it

## Backlog P1
- [ ] Firma digitale nel contratto PDF
- [ ] Dashboard ricavi / Statistiche
