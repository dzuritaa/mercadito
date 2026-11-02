# HTTPS with Caddy

Use HTTPS whenever the app is reachable from outside your computer, and always if it is reachable from the internet. This setup adds [Caddy](https://caddyserver.com/) in front of the app; Caddy handles certificates for you.

## 1. Choose the address

In `.env`, add `SITE_ADDRESS`:

| You want | `SITE_ADDRESS` | Certificate |
|---|---|---|
| A public domain, e.g. `food.example.com` | `food.example.com` | Trusted, from Let's Encrypt, automatic. The domain must point to this machine and ports 80 and 443 must reach it. |
| Your home network only | the computer's IP, e.g. `192.168.1.20` | Caddy's own local certificate. Browsers show a warning until you trust Caddy's root certificate (see below). |
| Just this computer | `localhost` | Same as above. |

Keep `BIND_ADDRESS=127.0.0.1` in `.env`: Caddy reaches the app inside Docker, so port 3000 does not need to be open to the network.

## 2. Start with Caddy

From the project folder:

```sh
docker compose -f docker-compose.yml -f deploy/docker-compose.https.yml up -d --build
```

Open `https://<SITE_ADDRESS>`. Use the same command (with both `-f` files) for future updates.

If ports 80 or 443 are taken on your machine, set `HTTP_PORT` and `HTTPS_PORT` in `.env` (for example `8080` and `8443`) and open `https://<SITE_ADDRESS>:8443`.

## Trusting the local certificate (home network only)

For an IP address or `localhost`, Caddy creates its own certificate authority. Copy its root certificate out of the container:

```sh
docker compose -f docker-compose.yml -f deploy/docker-compose.https.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
```

Install `caddy-root.crt` as a trusted root certificate on each device (on phones this is under the security or certificate settings). Until you do, the browser warns that the connection is not private, although traffic is still encrypted.

## Files

- [`deploy/Caddyfile`](../deploy/Caddyfile) — the Caddy configuration.
- [`deploy/docker-compose.https.yml`](../deploy/docker-compose.https.yml) — adds the Caddy service.
