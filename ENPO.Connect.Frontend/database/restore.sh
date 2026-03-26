#!/bin/bash
set -e

echo "Waiting for SQL Server to be ready..."
sleep 30

echo "Restoring database from backup..."

SQLCMD_BIN="$(command -v sqlcmd || true)"
if [ -z "$SQLCMD_BIN" ]; then
  for p in /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd; do
    if [ -x "$p" ]; then
      SQLCMD_BIN="$p"
      break
    fi
  done
fi

if [ -z "$SQLCMD_BIN" ]; then
  echo "sqlcmd not found. Expected it in PATH, /opt/mssql-tools18/bin, or /opt/mssql-tools/bin."
  exit 1
fi

SQLCMD_TRUST_FLAG=""
if "$SQLCMD_BIN" -? 2>&1 | grep -q -- " -C "; then
  SQLCMD_TRUST_FLAG="-C"
fi

"$SQLCMD_BIN" $SQLCMD_TRUST_FLAG -S localhost -U sa -P "${SA_PASSWORD:-Admin123!@#}" -Q "
RESTORE DATABASE [Connect] 
FROM DISK = '/var/opt/mssql/backup/Connect.bak'
WITH MOVE 'Connect' TO '/var/opt/mssql/data/Connect.mdf',
     MOVE 'Connect_log' TO '/var/opt/mssql/data/Connect_log.ldf'
"

echo "Database restore completed!"
