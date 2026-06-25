# Backup interfaccia v2 (pre-redesign premium)

Salvataggio del 13 giu 2026 — design tech/minimal.

Ripristino:
```powershell
Copy-Item "public\backup\interface-v2\*" "public\" -Recurse -Force
# oppure solo css/html:
Copy-Item "public\backup\interface-v2\app.css" "public\css\app.css" -Force
Copy-Item "public\backup\interface-v2\index.html" "public\index.html" -Force
```
