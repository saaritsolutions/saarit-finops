# SSL Setup — demobank.saaritsolutions.com (Hetzner VPS)

## Prerequisites
- Domain `demobank.saaritsolutions.com` A record pointing to this server's IP
- Hetzner firewall: ports 80 and 443 open
- Docker and Docker Compose v2 installed on the server

## Step 1 — Install Docker on the Hetzner server (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # re-login after this
```

## Step 2 — Get SSL certificate via certbot (run BEFORE docker-compose up)

Nothing should be listening on port 80 when you run this.

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d demobank.saaritsolutions.com
```

Certificates are written to:
- `/etc/letsencrypt/live/demobank.saaritsolutions.com/fullchain.pem`
- `/etc/letsencrypt/live/demobank.saaritsolutions.com/privkey.pem`

The `nginx` container mounts `/etc/letsencrypt` read-only, so these paths are automatically available.

## Step 3 — Configure secrets

```bash
cd /path/to/saar-core-banking-services
cp .env.example .env
nano .env          # fill in POSTGRES_PASSWORD and OPENAI_API_KEY
```

## Step 4 — Start the stack

```bash
docker compose up -d --build
```

Check all containers are running:

```bash
docker compose ps
```

Check nginx logs if the site doesn't load:

```bash
docker compose logs nginx
```

## Step 5 — Verify

- `https://demobank.saaritsolutions.com` → React app loads
- `https://demobank.saaritsolutions.com/api/LoanOrigination/form-schema/personal_loan` → JSON response
- `https://demobank.saaritsolutions.com/api/Expressions` → Expression list

## Certificate Auto-renewal

Add to root crontab (`sudo crontab -e`):

```
0 0,12 * * * certbot renew --quiet && docker compose -f /path/to/saar-core-banking-services/docker-compose.yml restart nginx
```

## Troubleshooting

| Problem | Fix |
|---|---|
| nginx: SSL cert not found | Run certbot step first; confirm path `/etc/letsencrypt/live/demobank.saaritsolutions.com/` exists |
| Service not responding | `docker compose logs <servicename>` — check for DB connection errors |
| CORS errors in browser | Ensure `CORS_ALLOWED_ORIGINS=https://demobank.saaritsolutions.com` is in `.env` |
| DB migration error on startup | `docker compose logs customerservice` — if schema mismatch, run `docker compose exec customerservice dotnet ef database update` |
| Build fails (OOM) | Increase Docker memory limit or use a Hetzner server with ≥4 GB RAM |
