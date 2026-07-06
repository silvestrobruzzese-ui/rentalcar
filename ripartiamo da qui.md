# Rental Car - Stato del Progetto

**Data ultimo aggiornamento:** 6 Luglio 2026, ore 23:15

---

## STATO ATTUALE

L'app è stata deployata su Railway. Il backend funziona, il frontend funziona ma **manca l'utente admin nel database**.

---

## URL DELLA WEBAPP

| Servizio | URL |
|----------|-----|
| **Frontend** | https://abundant-connection-production-c94f.up.railway.app |
| **Backend** | https://rentalcar-production.up.railway.app |
| **GitHub Repo** | https://github.com/silvestrobruzzese-ui/rentalcar |
| **MongoDB Atlas** | https://cloud.mongodb.com |

---

## CREDENZIALI ADMIN (DA CREARE)

- **Email:** giannibruzzese@gmail.com
- **Password:** admi123

**IMPORTANTE:** L'utente admin NON è ancora stato inserito nel database!

---

## COSA FARE DOMANI (Prima di tutto)

### 1. Inserire l'utente admin su MongoDB Atlas

1. Vai su https://cloud.mongodb.com e accedi
2. Clicca sul Cluster → "Browse Collections"
3. Seleziona il database → collection "users"
4. Clicca "INSERT DOCUMENT"
5. Incolla questo documento:

```json
{
  "id": "706f7d6b-591d-4590-a6c9-46271eb16a1d",
  "email": "giannibruzzese@gmail.com",
  "password_hash": "$2b$12$57XAdQknr0TajP.i0uqmEeBSSXdssvPId5jY2HYZc5t6NVWlbk39a",
  "role": "admin",
  "nome": "Gianni",
  "cognome": "Bruzzese",
  "registrazione_completa": true,
  "created_at": "2026-07-06T23:12:11.333466"
}
```

6. Clicca "Insert"
7. Vai sulla webapp e fai login con le credenziali sopra

---

## COSA È STATO FATTO

### Rimozioni effettuate:
- [x] Rimosso servizio email Brevo (SMTP)
- [x] Rimosso servizio email Resend
- [x] Rimossi tutti i riferimenti a "Soverato"
- [x] Rimossi tutti i riferimenti a "RE.LE.CO. GROUP"
- [x] Rebrandizzato tutto in "RENTAL CAR"

### Deploy su Railway:
- [x] Creato repository GitHub: silvestrobruzzese-ui/rentalcar
- [x] Backend deployato (servizio: rentalcar)
- [x] Frontend deployato (servizio: abundant-connection)
- [x] Configurate variabili d'ambiente backend (MONGO_URL, DB_NAME, JWT_SECRET)
- [x] Configurata variabile frontend (REACT_APP_BACKEND_URL)
- [x] Generati domini pubblici per entrambi i servizi

### Problemi risolti durante il deploy:
- [x] Conflitto yarn vs npm → creato Dockerfile per forzare npm
- [x] Conflitti dipendenze (date-fns, eslint) → downgrade versioni + legacy-peer-deps
- [x] ESLint warnings trattati come errori → aggiunto DISABLE_ESLINT_PLUGIN=true
- [x] Porta sbagliata → configurata porta 8080
- [x] Errore "r.map is not a function" → aggiunto controllo Array.isArray()

---

## CONFIGURAZIONE RAILWAY

### Backend (rentalcar)
- **Root Directory:** /backend
- **Builder:** Nixpacks
- **Porta:** 8000
- **Variabili:**
  - MONGO_URL = (stringa connessione MongoDB Atlas)
  - DB_NAME = (nome database)
  - JWT_SECRET = (chiave segreta)

### Frontend (abundant-connection)
- **Root Directory:** /frontend
- **Builder:** Dockerfile
- **Porta:** 8080
- **Variabili:**
  - REACT_APP_BACKEND_URL = https://rentalcar-production.up.railway.app

---

## STRUTTURA DEL PROGETTO

```
rental-car-definitivo-main/
├── backend/
│   ├── server.py          # FastAPI backend
│   ├── requirements.txt   # Dipendenze Python
│   ├── Procfile          # Comando start Railway
│   └── railway.json      # Config Railway backend
│
├── frontend/
│   ├── src/
│   │   ├── pages/        # Pagine React
│   │   ├── components/   # Componenti UI
│   │   └── context/      # Auth context
│   ├── Dockerfile        # Build container
│   ├── railway.json      # Config Railway frontend
│   ├── nixpacks.toml     # Config Nixpacks
│   ├── .npmrc            # Force legacy-peer-deps
│   └── package.json
│
└── ripartiamo da qui.md  # Questo file
```

---

## FUNZIONALITÀ DELL'APP

### Lato Admin:
- Gestione veicoli (CRUD)
- Gestione prenotazioni
- Gestione clienti
- Calendario prenotazioni
- Generazione contratti PDF
- Impostazioni agenzia

### Lato Cliente:
- Registrazione con dati personali
- Visualizzazione veicoli disponibili
- Prenotazione veicoli
- Visualizzazione contratti
- Area personale

---

## NOTE TECNICHE

- **Backend:** FastAPI (Python)
- **Frontend:** React 19 + TailwindCSS + Radix UI
- **Database:** MongoDB Atlas
- **Auth:** JWT tokens
- **Password hash:** bcrypt

---

## POSSIBILI PROBLEMI E SOLUZIONI

### Se il frontend non carica:
1. Controlla che il backend sia online su Railway
2. Verifica la variabile REACT_APP_BACKEND_URL nel frontend
3. Fai Redeploy se hai cambiato variabili

### Se il login non funziona:
1. Verifica che l'utente admin sia stato inserito su MongoDB Atlas
2. Controlla che email e password siano corretti
3. Verifica nei log del backend se ci sono errori

### Se vedi errori nella console del browser:
1. Apri F12 → Console
2. Cerca errori rossi
3. Se dice "CORS" → problema di comunicazione frontend/backend
4. Se dice "map is not a function" → il backend non restituisce un array

---

## COMANDI UTILI

### Deploy manuale:
```bash
cd "/Users/gianni/Desktop/rental-car-definitivo-main"
git add -A
git commit -m "Descrizione modifiche"
git push
```
Railway farà automaticamente il redeploy.

### Test backend locale:
```bash
cd backend
pip install -r requirements.txt
python server.py
```

### Test frontend locale:
```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

---

## PROSSIMI PASSI (Opzionali)

- [ ] Testare tutte le funzionalità dell'app
- [ ] Aggiungere veicoli dal pannello admin
- [ ] Configurare i dati dell'agenzia nelle impostazioni
- [ ] Testare il flusso di prenotazione completo
- [ ] Eventuale dominio personalizzato

---

**Buon lavoro domani!**
