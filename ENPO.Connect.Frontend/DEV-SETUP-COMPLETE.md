# ============================================================
# FULL DEV ENVIRONMENT - COMPLETE COMMAND REFERENCE
# Angular + SQL Server + Oracle (Local)
# ============================================================

# 🚀 QUICK START - RUN THIS IN TERMINAL:
# ============================================================

# Option 1: Start Everything (Recommended)
cd ~/ConnectNew/ENPO.Connect.Frontend && docker compose up -d

# Wait for initialization (2-3 minutes)
sleep 180

# ============================================================
# 📊 ACCESS POINTS
# ============================================================

# Angular Frontend
# URL: http://localhost:4200
# Auto-compiling with hot reload

# SQL Server
# Host: localhost
# Port: 1433
# User: sa
# Password: Admin123!@#
# Database: Connect (after restore)

# ============================================================
# 🗄️  SQL SERVER COMMANDS
# ============================================================

# Restore your database from Connect.bak
docker exec enpo_sqlserver bash -c "
/opt/mssql/bin/sqlservr &
sleep 30
/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Admin123!@# -Q '
RESTORE DATABASE [Connect] 
FROM DISK = '\''/var/opt/mssql/backup/Connect.bak'\''
WITH MOVE '\''Connect'\'' TO '\''/var/opt/mssql/data/Connect.mdf'\'',
     MOVE '\''Connect_log'\'' TO '\''/var/opt/mssql/data/Connect_log.ldf'\'',
     REPLACE;
'
"

# Connect to SQL Server using SSMS
# Host: localhost,1433
# User: sa
# Password: Admin123!@#

# ============================================================
# 🐋 DOCKER MANAGEMENT COMMANDS
# ============================================================

# View all containers
docker ps -a

# View logs
docker compose logs -f

# View Angular logs only
docker compose logs -f enpo_frontend

# View SQL Server logs only
docker compose logs -f enpo_sqlserver

# Stop all containers
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v

# Restart containers
docker compose restart

# Rebuild containers
docker compose up -d --build

# ============================================================
# 🍊 ORACLE DATABASE - Local Installation (macOS)
# ============================================================

# IMPORTANT: Docker Oracle doesn't work well on M4 Pro
# Use one of these options instead:

# Option A: Cloud-Hosted Oracle (Recommended)
# ============================================
# 1. Sign up: https://www.oracle.com/cloud/free/
# 2. Create Always Free Database instance
# 3. Get connection string: hostname:port/service_name
# 4. Use in your Angular app connection settings
# Example: 
#   Host: abc123.regioncode.oraclecloud.com
#   Port: 1521
#   SID: ORCL

# Option B: Oracle Database Express Edition (XE) - Local
# ======================================================
# 1. Download: https://www.oracle.com/database/technologies/xe-downloads.html
# 2. Install on macOS
# 3. Start service: brew services start oracle-database-xe
# 4. Connect: sqlplus system/password@localhost:1521/XE

# Option C: Use Homebrew (Limited)
# ================================
brew tap oracle/instantclient
brew install instantclient-basic instantclient-sqlplus

# Test Oracle connection
sqlplus system/password@localhost:1521/ORCL

# ============================================================
# 🔗 CONNECTION STRINGS FOR YOUR APP
# ============================================================

# SQL Server (in your Angular/Node.js app)
server=localhost
port=1433
username=sa
password=Admin123!@#
database=Connect

# Oracle (example - replace with your actual details)
host=localhost
port=1521
sid=ORCL
username=system
password=your-password

# ============================================================
# ✅ VERIFY SETUP
# ============================================================

# Check Angular is running
curl http://localhost:4200

# Check SQL Server port is open
netstat -an | grep 1433

# Check all Docker containers
docker ps

# ============================================================
# 📋 TROUBLESHOOTING
# ============================================================

# If containers won't start:
docker compose logs enpo_frontend
docker compose logs enpo_sqlserver

# If database restore fails:
# The Connect.bak file is at: ~/ConnectNew/ENPO.Connect.Frontend/database/Connect.bak

# If port 4200 is busy:
# Kill process: lsof -ti:4200 | xargs kill -9

# If port 1433 is busy:
# Kill process: lsof -ti:1433 | xargs kill -9

# ============================================================
# 🎯 FULL DEVELOPMENT WORKFLOW
# ============================================================

# 1. Start environment
cd ~/ConnectNew/ENPO.Connect.Frontend
docker compose up -d

# 2. Open in browser
open http://localhost:4200

# 3. Watch logs in background
docker compose logs -f &

# 4. Edit Angular code - changes auto-reload at http://localhost:4200

# 5. Connect your API backend to SQL Server
# Connection string: Server=enpo_sqlserver;Port=1433;User Id=sa;Password=Admin123!@#;Database=Connect

# 6. Set up Oracle (choose option A, B, or C above)

# 7. Stop when done
docker compose down
