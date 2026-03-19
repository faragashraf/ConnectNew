-- Oracle Unicode hotfix for WE8MSWIN1252 databases.
-- Scope: LTRA_REGISTRATION and TRACKING columns that receive Arabic text.
-- Run as GPA_USER (or schema owner) after taking a database backup.

SET SERVEROUTPUT ON
SET DEFINE OFF

PROMPT ===== NLS CHECK =====
SELECT parameter, value
FROM nls_database_parameters
WHERE parameter IN ('NLS_CHARACTERSET', 'NLS_NCHAR_CHARACTERSET')
ORDER BY parameter;

PROMPT ===== CURRENT COLUMN TYPES =====
COL table_name FORMAT A30
COL column_name FORMAT A30
COL data_type FORMAT A15
SELECT table_name, column_name, data_type, data_length, char_length, char_used
FROM user_tab_columns
WHERE table_name IN ('LTRA_REGISTRATION', 'TRACKING')
  AND column_name IN (
    'AREA_A_NAME',
    'OFFICE_A_NAME',
    'COMPANY_NAME',
    'COMPANY_ADDRESS',
    'REPLY_SUBJECT',
    'RESPONSIBLE_MANAGER',
    'DESCRIPTION'
  )
ORDER BY table_name, column_id;

-- Convert a VARCHAR2 column to NVARCHAR2 while preserving data.
-- This pattern avoids ORA-01439 on non-empty columns.
CREATE OR REPLACE PROCEDURE convert_varchar2_to_nvarchar2 (
    p_table_name  IN VARCHAR2,
    p_column_name IN VARCHAR2,
    p_new_length  IN NUMBER
) IS
    v_data_type VARCHAR2(30);
    v_count     NUMBER;
BEGIN
    SELECT data_type
      INTO v_data_type
      FROM user_tab_columns
     WHERE table_name = UPPER(p_table_name)
       AND column_name = UPPER(p_column_name);

    IF v_data_type = 'NVARCHAR2' THEN
        DBMS_OUTPUT.PUT_LINE('Skip ' || p_table_name || '.' || p_column_name || ' (already NVARCHAR2)');
        RETURN;
    END IF;

    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' ADD (' || p_column_name || '_N NVARCHAR2(' || p_new_length || '))';
    EXECUTE IMMEDIATE 'UPDATE ' || p_table_name || ' SET ' || p_column_name || '_N = TO_NCHAR(' || p_column_name || ')';
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' DROP COLUMN ' || p_column_name;
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' RENAME COLUMN ' || p_column_name || '_N TO ' || p_column_name;

    DBMS_OUTPUT.PUT_LINE('Converted ' || p_table_name || '.' || p_column_name || ' to NVARCHAR2(' || p_new_length || ')');
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('Skip ' || p_table_name || '.' || p_column_name || ' (column not found)');
END;
/

-- Convert CLOB -> NCLOB for Arabic free-text.
CREATE OR REPLACE PROCEDURE convert_clob_to_nclob (
    p_table_name  IN VARCHAR2,
    p_column_name IN VARCHAR2
) IS
    v_data_type VARCHAR2(30);
BEGIN
    SELECT data_type
      INTO v_data_type
      FROM user_tab_columns
     WHERE table_name = UPPER(p_table_name)
       AND column_name = UPPER(p_column_name);

    IF v_data_type = 'NCLOB' THEN
        DBMS_OUTPUT.PUT_LINE('Skip ' || p_table_name || '.' || p_column_name || ' (already NCLOB)');
        RETURN;
    END IF;

    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' ADD (' || p_column_name || '_N NCLOB)';
    EXECUTE IMMEDIATE 'UPDATE ' || p_table_name || ' SET ' || p_column_name || '_N = TO_NCLOB(' || p_column_name || ')';
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' DROP COLUMN ' || p_column_name;
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' RENAME COLUMN ' || p_column_name || '_N TO ' || p_column_name;

    DBMS_OUTPUT.PUT_LINE('Converted ' || p_table_name || '.' || p_column_name || ' to NCLOB');
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('Skip ' || p_table_name || '.' || p_column_name || ' (column not found)');
END;
/

BEGIN
    convert_varchar2_to_nvarchar2('LTRA_REGISTRATION', 'AREA_A_NAME', 500);
    convert_varchar2_to_nvarchar2('LTRA_REGISTRATION', 'OFFICE_A_NAME', 200);
    convert_varchar2_to_nvarchar2('LTRA_REGISTRATION', 'COMPANY_NAME', 1024);
    convert_varchar2_to_nvarchar2('LTRA_REGISTRATION', 'COMPANY_ADDRESS', 512);
    convert_varchar2_to_nvarchar2('LTRA_REGISTRATION', 'REPLY_SUBJECT', 500);
    convert_varchar2_to_nvarchar2('LTRA_REGISTRATION', 'RESPONSIBLE_MANAGER', 256);
    convert_clob_to_nclob('TRACKING', 'DESCRIPTION');
END;
/

DROP PROCEDURE convert_varchar2_to_nvarchar2;
DROP PROCEDURE convert_clob_to_nclob;

COMMIT;

PROMPT ===== POST-CHECK =====
SELECT table_name, column_name, data_type, data_length, char_length, char_used
FROM user_tab_columns
WHERE table_name IN ('LTRA_REGISTRATION', 'TRACKING')
  AND column_name IN (
    'AREA_A_NAME',
    'OFFICE_A_NAME',
    'COMPANY_NAME',
    'COMPANY_ADDRESS',
    'REPLY_SUBJECT',
    'RESPONSIBLE_MANAGER',
    'DESCRIPTION'
  )
ORDER BY table_name, column_id;
