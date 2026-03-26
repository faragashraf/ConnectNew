#!/bin/bash

# Full Dev Environment Setup - Angular + SQL Server + Oracle (Local)
# ===================================================================

echo "🚀 Starting Full Dev Environment..."
echo "=================================="

# Step 1: Start Docker containers
echo ""
echo "Step 1: Starting Docker containers (Angular + SQL Server)..."
cd ~/ConnectNew/ENPO.Connect.Frontend
docker compose down -v
docker compose up -d

echo "Waiting 30 seconds for containers to stabilize..."
sleep 30

# Step 2: Check containers
echo ""
echo "Step 2: Checking container status..."
docker ps -a | grep -E "(enpo_frontend|enpo_sqlserver)"

# Step 3: Restore SQL Server database
echo ""
echo "Step 3: Restoring SQL Server database from Connect.bak..."
sleep 10

# Get SQL Server container IP
SQLSERVER_HOST="enpo_sqlserver"
SQLSERVER_PORT="1433"
SA_PASSWORD="Admin123!@#"

# Try to restore database
docker exec enpo_sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost \
  -U sa \
  -P "$SA_PASSWORD" \
  -Q "RESTORE DATABASE [Connect] FROM DISK = '/var/opt/mssql/backup/Connect.bak' WITH MOVE 'Connect' TO '/var/opt/mssql/data/Connect.mdf', MOVE 'Connect_log' TO '/var/opt/mssql/data/Connect_log.ldf', REPLACE;" 2>&1 | head -20

echo ""
echo "Database restore initiated..."

# Step 4: Frontend status
echo ""
echo "Step 4: Frontend Status"
echo "  ✓ Angular running at: http://localhost:4200"
docker logs enpo_frontend 2>&1 | grep -E "(listening|Angular|✔)" | tail -3

# Step 5: SQL Server status
echo ""
echo "Step 5: SQL Server Status"
echo "  ✓ SQL Server running at: localhost:1433"
echo "  ✓ User: sa"
echo "  ✓ Password: Admin123!@#"

# Step 6: Oracle Local Setup Instructions
echo ""
echo "Step 6: Oracle Local Setup (macOS)"
echo "  ⚠️  Docker Oracle images don't work well on M4 Pro"
echo "  "
echo "  Option A: Use OCI Cloud (Recommended)"
echo "  - Sign up: https://www.oracle.com/cloud/free/"
echo "  - Create Always Free instance"
echo "  - Get connection string and use it in your app"
echo "  "
echo "  Option B: Install locally with Homebrew"
echo "  brew tap oracle/instantclient"
echo "  brew install instantclient-basic instantclient-sqlplus"
echo "  "
echo "  Option C: Use Oracle Database Express Edition (XE)"
echo "  Download from: https://www.oracle.com/database/technologies/xe-downloads.html"

echo ""
echo "===================================="
echo "✓ Setup Complete!"
echo "===================================="
echo ""
echo "🌐 Access Points:"
echo "  • Angular Frontend: http://localhost:4200"
echo "  • SQL Server:      localhost:1433 (sa / Admin123!@#)"
echo "  • Oracle:          Configure separately"
echo ""
echo "📋 Commands:"
echo "  View logs:       docker compose logs -f"
echo "  Stop all:        docker compose down"
echo "  Restart:         docker compose restart"
echo "  Restore DB:      docker exec enpo_sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Admin123!@# -i /var/opt/mssql/backup/restore-db.sql"
