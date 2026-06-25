# Backup interfaccia v1 (originale)

Salvataggio del design precedente — **13 giu 2026**

## Ripristinare

Copia questi file nella cartella `public/`:

```
backup/interface-v1/app.css   → public/css/app.css
backup/interface-v1/index.html → public/index.html
```

Oppure da PowerShell:

```powershell
Copy-Item "public\backup\interface-v1\app.css" "public\css\app.css" -Force
Copy-Item "public\backup\interface-v1\index.html" "public\index.html" -Force
```
