# QNAP NAS Virtual Host Deployment

This project can run from the existing QNAP virtual host path:

- Windows mapped path: `R:\saas\apps\stock-picker-web`
- QNAP path used by cron: `/share/Projects/saas/apps/stock-picker-web`
- External URL: `https://125.229.218.215:614/`

Keep the source repo outside the public web root. The NAS script builds the app and copies only `dist/` into the virtual host directory.

## Recommended Layout

```text
/share/Projects/saas/repos/Stock-picker       source repo, private
/share/Projects/saas/apps/stock-picker-web    virtual host DocumentRoot, public
```

From Windows this maps to:

```text
R:\saas\repos\Stock-picker
R:\saas\apps\stock-picker-web
```

Do not point the virtual host at the source repo. The source repo contains `.git`, scripts, dependencies, and other files that should not be public.

## One-Time Setup On QNAP

```bash
mkdir -p /share/Projects/saas/repos
mkdir -p /share/Projects/saas/apps/stock-picker-web
cd /share/Projects/saas/repos
git clone git@github.com:zerokemx-ui/Stock-picker.git
cd Stock-picker
npm ci
```

If your QNAP share path is different, replace `/share/Projects` with the actual path for the `Projects` share.

## Manual Deploy

```bash
STOCK_PICKER_REPO_DIR=/share/Projects/saas/repos/Stock-picker \
STOCK_PICKER_WEB_DIR=/share/Projects/saas/apps/stock-picker-web \
/bin/bash /share/Projects/saas/repos/Stock-picker/scripts/nas-refresh-data.sh
```

The script will:

```text
git pull
npm ci when needed
npm run build:data
npm run validate:data
npm run build:app
sync dist/ to /share/Projects/saas/apps/stock-picker-web
```

By default it does not commit generated data back to GitHub. To also push refreshed `public/api/*.json`, set:

```bash
STOCK_PICKER_PUSH_DATA=1
```

## Cron Schedule

Add these lines with `crontab -e` on QNAP. Times are Asia/Taipei.

```cron
20 14 * * 1-5 STOCK_PICKER_REPO_DIR=/share/Projects/saas/repos/Stock-picker STOCK_PICKER_WEB_DIR=/share/Projects/saas/apps/stock-picker-web /bin/bash /share/Projects/saas/repos/Stock-picker/scripts/nas-refresh-data.sh >> /share/Projects/saas/repos/Stock-picker/nas-refresh.log 2>&1
40 15 * * 1-5 STOCK_PICKER_REPO_DIR=/share/Projects/saas/repos/Stock-picker STOCK_PICKER_WEB_DIR=/share/Projects/saas/apps/stock-picker-web /bin/bash /share/Projects/saas/repos/Stock-picker/scripts/nas-refresh-data.sh >> /share/Projects/saas/repos/Stock-picker/nas-refresh.log 2>&1
10 16 * * 1-5 STOCK_PICKER_REPO_DIR=/share/Projects/saas/repos/Stock-picker STOCK_PICKER_WEB_DIR=/share/Projects/saas/apps/stock-picker-web /bin/bash /share/Projects/saas/repos/Stock-picker/scripts/nas-refresh-data.sh >> /share/Projects/saas/repos/Stock-picker/nas-refresh.log 2>&1
10 17 * * 1-5 STOCK_PICKER_REPO_DIR=/share/Projects/saas/repos/Stock-picker STOCK_PICKER_WEB_DIR=/share/Projects/saas/apps/stock-picker-web /bin/bash /share/Projects/saas/repos/Stock-picker/scripts/nas-refresh-data.sh >> /share/Projects/saas/repos/Stock-picker/nas-refresh.log 2>&1
10 20 * * 1-5 STOCK_PICKER_REPO_DIR=/share/Projects/saas/repos/Stock-picker STOCK_PICKER_WEB_DIR=/share/Projects/saas/apps/stock-picker-web /bin/bash /share/Projects/saas/repos/Stock-picker/scripts/nas-refresh-data.sh >> /share/Projects/saas/repos/Stock-picker/nas-refresh.log 2>&1
30 23 * * 1-5 STOCK_PICKER_REPO_DIR=/share/Projects/saas/repos/Stock-picker STOCK_PICKER_WEB_DIR=/share/Projects/saas/apps/stock-picker-web /bin/bash /share/Projects/saas/repos/Stock-picker/scripts/nas-refresh-data.sh >> /share/Projects/saas/repos/Stock-picker/nas-refresh.log 2>&1
```

Restart cron if your QNAP model requires it:

```bash
/etc/init.d/crond.sh restart
```

## Verify

```bash
tail -n 80 /share/Projects/saas/repos/Stock-picker/nas-refresh.log
curl -k -s "https://125.229.218.215:614/api/stocks.json?$(date +%s)" | jq '.source,.dataDate,.generatedAt,.count'
```

`curl -k` is only needed if the virtual host uses a self-signed certificate or an IP address certificate mismatch.
