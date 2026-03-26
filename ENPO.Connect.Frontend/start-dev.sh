#!/bin/bash

# ============================================================
# COMPLETE DEV ENVIRONMENT START SCRIPT
# Angular 15 + SQL Server + Oracle
# ============================================================

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  FULL STACK DEV ENVIRONMENT - Angular + SQL + Oracle  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Start Docker Environment
echo -e "${BLUE}[1/5] Starting Docker Containers...${NC}"
cd ~/ConnectNew/ENPO.Connect.Frontend
docker compose down -v 2>/dev/null
docker compose up -d

sleep 30

# Step 2: Check Container Status
echo -e "${BLUE}[2/5] Verifying Containers...${NC}"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep enpo
echo ""

# Step 3: Verify Angular
echo -e "${BLUE}[3/5] Checking Angular Frontend...${NC}"
if curl -s http://localhost:4200 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Angular running at http://localhost:4200${NC}"
else
    echo -e "${YELLOW}⏳ Angular still starting (npm install in progress)...${NC}"
    echo "   Wait 2-3 minutes and refresh http://localhost:4200"
fi
echo ""

# Step 4: Verify SQL Server
echo -e "${BLUE}[4/5] Checking SQL Server...${NC}"
if docker exec enpo_sqlserver bash -c "ps aux | grep sqlservr | grep -v grep" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SQL Server running at localhost:1433${NC}"
    echo "   User: sa"
    echo "   Password: Admin123!@#"
else
    echo -e "${YELLOW}⏳ SQL Server still starting...${NC}"
fi
echo ""

# Step 5: Show Next Steps
echo -e "${BLUE}[5/5] Setup Complete!${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ DEVELOPMENT ENVIRONMENT READY${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "📱 ACCESS POINTS:"
echo "   • Frontend:  ${BLUE}http://localhost:4200${NC}"
echo "   • SQL Server: ${BLUE}localhost:1433${NC}"
echo "     - User: sa"
echo "     - Password: Admin123!@#"
echo ""
echo "📖 COMMANDS:"
echo "   View logs:     ${BLUE}docker compose logs -f${NC}"
echo "   View frontend: ${BLUE}docker compose logs -f enpo_frontend${NC}"
echo "   View SQL:      ${BLUE}docker compose logs -f enpo_sqlserver${NC}"
echo "   Stop all:      ${BLUE}docker compose down${NC}"
echo "   Restart:       ${BLUE}docker compose restart${NC}"
echo ""
echo "🍊 ORACLE SETUP:"
echo "   Cloud (Recommended): Sign up at https://oracle.com/cloud/free"
echo "   Local: Download Oracle XE from https://oracle.com/database/xe"
echo ""
echo "📁 Your Project:"
echo "   ~/ConnectNew/ENPO.Connect.Frontend"
echo "   • /src         - Angular source code"
echo "   • /database    - Connect.bak backup file"
echo ""
echo -e "${YELLOW}⏳ FIRST TIME SETUP:${NC}"
echo "   Angular npm packages are installing..."
echo "   Refresh http://localhost:4200 in 2-3 minutes"
echo ""
