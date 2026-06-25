# Manuale Sanzioni Staff

Sito condiviso per il manuale sanzioni dello staff, con registrazione account e approvazione accessi.

## Avvio rapido

```bash
npm install
npm start
```

Apri [http://localhost:4000](http://localhost:4000)

## Account admin

Al primo avvio viene creato automaticamente l'admin configurato in `.env`:

| Campo | Descrizione |
|-------|-------------|
| `ADMIN_USERNAME` | Username admin (default: `admin`) |
| `ADMIN_PASSWORD` | Password admin |
| `ADMIN_NAME` | Nome visualizzato |

## Come funziona

1. **Registrazione** — lo staff crea un account con username e password
2. **In attesa** — i nuovi utenti restano in pending finché un admin non li approva
3. **Admin** — può approvare/negare accessi dal pulsante **👥 Accessi**
4. **Manuale condiviso** — le modifiche salvate vanno nel database SQLite (`data/manuale.db`)

Il **primo utente registrato** diventa admin automaticamente (se non esiste già l'admin da `.env`).

## Configurazione `.env`

| Variabile | Descrizione |
|-----------|-------------|
| `PORT` | Porta del server (default `4000`) |
| `JWT_SECRET` | Chiave segreta per le sessioni |
| `ADMIN_USERNAME` | Username admin predefinito |
| `ADMIN_PASSWORD` | Password admin predefinito |
| `ADMIN_USERNAMES` | Altri username che diventano admin alla registrazione |

## Comandi

| Comando | Descrizione |
|---------|-------------|
| `npm start` | Avvia il server |
| `npm run dev` | Avvia con auto-reload |
