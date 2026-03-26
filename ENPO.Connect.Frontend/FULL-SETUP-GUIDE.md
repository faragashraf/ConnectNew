# ✅ FULL DEV ENVIRONMENT - SETUP COMPLETE

## 🎯 CURRENT STATUS

Your complete development environment is now ready!

### Running Services:
- ✅ **Angular Frontend**: http://localhost:4200
- ✅ **SQL Server 2022**: localhost:1433
- ⏳ **Oracle**: Ready to configure (see below)

---

## 🚀 COMMAND TO RUN EVERYTHING

**One-liner to start your full dev environment:**

```bash
cd ~/ConnectNew/ENPO.Connect.Frontend && docker compose up -d
```

**Then access:**
- Angular: http://localhost:4200
- SQL Server: localhost:1433

---

## 📋 ALL ENVIRONMENT COMMANDS

### Start
```bash
cd ~/ConnectNew/ENPO.Connect.Frontend
docker compose up -d
```

### Stop
```bash
docker compose down
```

### View Logs (Real-time)
```bash
docker compose logs -f
```

### View Angular Logs Only
```bash
docker compose logs -f enpo_frontend
```

### View SQL Server Logs Only
```bash
docker compose logs -f enpo_sqlserver
```

### Restart
```bash
docker compose restart
```

### Fresh Start (Clear volumes)
```bash
docker compose down -v && docker compose up -d
```

---

## 🗄️ SQL SERVER DETAILS

**Connection Info:**
- **Host**: localhost
- **Port**: 1433
- **User**: sa
- **Password**: Admin123!@#
- **Database**: Connect (after restore)

**Connection String (for your app):**
```
Server=enpo_sqlserver;Port=1433;User Id=sa;Password=Admin123!@#;Database=Connect
```

**Database Backup File Location:**
```
~/ConnectNew/ENPO.Connect.Frontend/database/Connect.bak
```

---

## 🍊 ORACLE DATABASE SETUP

### Option 1: Oracle Cloud (Recommended for M4 Pro)
```
1. Sign up: https://www.oracle.com/cloud/free/
2. Create Always Free Database
3. Get connection details
4. Use in your Angular app
```

### Option 2: Oracle XE Local Installation
```bash
# Download from:
https://www.oracle.com/database/technologies/xe-downloads.html

# Or install via Homebrew (limited):
brew tap oracle/instantclient
brew install instantclient-basic instantclient-sqlplus

# Start service:
brew services start oracle-database-xe

# Connect:
sqlplus system/password@localhost:1521/XE
```

### Option 3: Docker Oracle (Not recommended for M4 Pro)
```bash
# Azure SQL Edge is used instead (works better on ARM64)
# SQL Server replaces Oracle functionality in current setup
```

---

## 🔧 PROJECT STRUCTURE

```
~/ConnectNew/ENPO.Connect.Frontend/
├── docker-compose.yml          # Docker configuration
├── start-dev.sh                # Start script
├── DEV-SETUP-COMPLETE.md       # Full documentation
├── angular.json                # Angular config
├── package.json                # Dependencies
├── src/                        # Angular source code
│   ├── app/
│   ├── assets/
│   └── index.html
└── database/
    └── Connect.bak             # Your database backup
```

---

## ✨ QUICK REFERENCE

| Action | Command |
|--------|---------|
| Start all | `docker compose up -d` |
| Stop all | `docker compose down` |
| View logs | `docker compose logs -f` |
| Restart | `docker compose restart` |
| Check status | `docker ps` |
| Fresh start | `docker compose down -v && docker compose up -d` |

---

## 🌐 ACCESS URLS

- **Angular App**: http://localhost:4200
- **SQL Server**: localhost:1433
- **Your Computer**: All services on localhost

---

## 📝 NEXT STEPS

1. **Open Angular**: http://localhost:4200
2. **Connect to SQL Server**: localhost:1433 (sa/Admin123!@#)
3. **Set up Oracle**: Choose cloud or local install (see above)
4. **Edit code**: Make changes in `/src` - auto-reload at http://localhost:4200
5. **View logs**: `docker compose logs -f` to troubleshoot

---

## ⚠️ FIRST TIME SETUP

When you first start the containers:
- Angular npm packages are installing (~2-3 minutes)
- Refresh http://localhost:4200 after 3 minutes
- SQL Server starts immediately and is ready to use

---

## 🆘 TROUBLESHOOTING

**Angular not loading?**
- Wait 3 minutes for npm install
- Check logs: `docker compose logs -f enpo_frontend`

**SQL Server connection refused?**
- Check it's running: `docker ps | grep enpo_sqlserver`
- Check logs: `docker compose logs -f enpo_sqlserver`

**Port already in use?**
```bash
# Kill process on port 4200
lsof -ti:4200 | xargs kill -9

# Kill process on port 1433
lsof -ti:1433 | xargs kill -9
```

---

## 📖 Documentation Files

- `DEV-SETUP-COMPLETE.md` - Detailed commands and setup
- `docker-compose.yml` - Docker configuration
- `start-dev.sh` - Automated startup script

---

**Ready to develop!** 🚀

Your full stack environment with Angular, SQL Server, and Oracle configuration options is ready to use.

Start with: `cd ~/ConnectNew/ENPO.Connect.Frontend && docker compose up -d`
