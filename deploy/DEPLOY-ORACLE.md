# Deploy su Oracle Cloud (Always Free)

Guida passo-passo per mettere online il Manuale Staff **gratis**.

## Cosa posso fare io vs cosa fai tu

| Io (automatico) | Tu (5–10 minuti) |
|-----------------|------------------|
| Script installazione server | Creare account Oracle Cloud |
| Config nginx + PM2 | Creare la VM |
| `.env` generato sulla VM | Aprire porte firewall Oracle |
| Avvio automatico al reboot | Caricare i file del progetto |

**Non posso accedere al tuo account Oracle** — ma dopo i passi sotto, lo script fa quasi tutto da solo.

---

## Parte 1 — Crea la VM su Oracle (tu)

1. Vai su [cloud.oracle.com](https://cloud.oracle.com) → registrati (carta richiesta, **non ti addebitano** se resti nel free tier)

2. **Create a VM instance**
   - Name: `manuale-staff`
   - Image: **Ubuntu 22.04** (o 24.04)
   - Shape: **Ampere A1** → **VM.Standard.A1.Flex** → 1 OCPU, 6 GB RAM (free)
   - Networking: lascia default, **assegna IP pubblico**
   - SSH keys: **Generate a key pair** → scarica la chiave privata (`.key`)

3. **Apri le porte** (Networking → VCN → Security List → Ingress Rules):
   - Porta **22** (SSH) — Source `0.0.0.0/0`
   - Porta **80** (HTTP) — Source `0.0.0.0/0`
   - Porta **443** (HTTPS, opzionale) — Source `0.0.0.0/0`

4. Annota l’**IP pubblico** della VM (es. `123.45.67.89`)

---

## Parte 2 — Carica il progetto sulla VM

### Opzione A — Da GitHub (consigliata)

1. Crea un repo GitHub e carica la cartella `Sito Manuale Staff` (senza `node_modules/` e senza `.env`)
2. SSH nella VM:

```bash
ssh -i percorso/chiave.key ubuntu@IP_PUBBLICO
```

3. Esegui lo script:

```bash
sudo REPO_URL=https://github.com/TUOUSER/manuale-staff.git bash -c "$(curl -fsSL https://raw.githubusercontent.com/TUOUSER/manuale-staff/main/deploy/setup-oracle.sh)"
```

Oppure, se hai già clonato manualmente:

```bash
cd /opt/manuale-staff
sudo bash deploy/setup-oracle.sh
```

### Opzione B — Copia da Windows (senza GitHub)

Da PowerShell sul tuo PC:

```powershell
scp -i "C:\percorso\chiave.key" -r "C:\Users\admin\Desktop\Sito Manuale Staff\*" ubuntu@IP_PUBBLICO:/tmp/manuale-staff/
```

Poi sulla VM:

```bash
sudo mkdir -p /opt/manuale-staff
sudo cp -r /tmp/manuale-staff/* /opt/manuale-staff/
sudo chown -R ubuntu:ubuntu /opt/manuale-staff
cd /opt/manuale-staff
sudo bash deploy/setup-oracle.sh
```

---

## Parte 3 — Credenziali admin

Dopo l’installazione, sulla VM:

```bash
cat /opt/manuale-staff/.env | grep ADMIN
```

Vedrai username e password admin generate automaticamente.

Apri nel browser: **http://IP_PUBBLICO**

---

## HTTPS gratuito (opzionale)

Sulla VM, se hai un dominio che punta all’IP:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d tuodominio.it
```

---

## Comandi utili

```bash
# Stato app
pm2 status

# Log
pm2 logs manuale-staff

# Riavvio
pm2 restart manuale-staff

# Aggiornare dopo modifiche al codice
cd /opt/manuale-staff && git pull && npm install --omit=dev && pm2 restart manuale-staff
```

---

## Se mi dai l’IP e l’accesso SSH

Quando hai creato la VM, scrivimi:
- **IP pubblico**
- Se usi **Opzione B** (scp), posso guidarti comando per comando da qui

Con GitHub + script, in molti casi basta un solo comando dopo la creazione della VM.
