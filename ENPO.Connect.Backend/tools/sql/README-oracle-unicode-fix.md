Run the Unicode hotfix script with SQL*Plus:

```powershell
sqlplus gpa_user/gpa@HOST:1521/SERVICE @tools/sql/oracle-unicode-fix.sql
```

What it does:
- Prints `NLS_CHARACTERSET` and `NLS_NCHAR_CHARACTERSET`.
- Converts key Arabic text columns in `LTRA_REGISTRATION` to `NVARCHAR2`.
- Converts `TRACKING.DESCRIPTION` to `NCLOB`.
- Prints post-conversion column types for verification.

Important:
- Take a full database backup before running.
- Existing values already stored as `????` cannot be recovered from the same rows.
- This is a tactical fix for `WE8MSWIN1252`; strategic fix remains full DB migration to `AL32UTF8`.
