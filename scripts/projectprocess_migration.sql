/*
  projectprocess schema migration for atg-requirements.
  Run each step in order, as a database admin, against database [atg-requirements].
  Everything here is safe while the current build is still deployed.
  After the new build is deployed, run projectprocess_migration_post_deploy.sql.
*/

/* ---------------------------------------------------------------------------
   STEP 1 - Add columns (additive, idempotent)
--------------------------------------------------------------------------- */
IF COL_LENGTH(N'projectprocess.Node', N'updated_rev') IS NULL
    ALTER TABLE projectprocess.Node ADD updated_rev bigint NOT NULL
        CONSTRAINT DF_projectprocess_Node_rev DEFAULT (0);
GO
IF COL_LENGTH(N'projectprocess.Node', N'updated_client') IS NULL
    ALTER TABLE projectprocess.Node ADD updated_client nvarchar(64) NULL;
GO
IF COL_LENGTH(N'projectprocess.Link', N'version') IS NULL
    ALTER TABLE projectprocess.Link ADD version int NOT NULL
        CONSTRAINT DF_projectprocess_Link_ver DEFAULT (1);
GO
IF COL_LENGTH(N'projectprocess.Link', N'updated_rev') IS NULL
    ALTER TABLE projectprocess.Link ADD updated_rev bigint NOT NULL
        CONSTRAINT DF_projectprocess_Link_rev DEFAULT (0);
GO
IF COL_LENGTH(N'projectprocess.Link', N'updated_client') IS NULL
    ALTER TABLE projectprocess.Link ADD updated_client nvarchar(64) NULL;
GO

/* ---------------------------------------------------------------------------
   STEP 2 - Indexes (idempotent)
--------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_Link_ends' AND object_id = OBJECT_ID(N'projectprocess.Link'))
    CREATE INDEX IX_projectprocess_Link_ends ON projectprocess.Link (source_id, target_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_Node_rev' AND object_id = OBJECT_ID(N'projectprocess.Node'))
    CREATE INDEX IX_projectprocess_Node_rev ON projectprocess.Node (updated_rev);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_Link_rev' AND object_id = OBJECT_ID(N'projectprocess.Link'))
    CREATE INDEX IX_projectprocess_Link_rev ON projectprocess.Link (updated_rev);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_ChangeLog_rev' AND object_id = OBJECT_ID(N'projectprocess.ChangeLog'))
    CREATE INDEX IX_projectprocess_ChangeLog_rev ON projectprocess.ChangeLog (revision);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_ChangeLog_at' AND object_id = OBJECT_ID(N'projectprocess.ChangeLog'))
    CREATE INDEX IX_projectprocess_ChangeLog_at ON projectprocess.ChangeLog (changed_at);
GO

/* ---------------------------------------------------------------------------
   STEP 3 - Grant the App Service managed identity read/write
   Replace the name with the identity's exact Entra display name
   (App Service > Identity > User assigned). Existing database users:
       SELECT name, type_desc FROM sys.database_principals WHERE type IN ('E', 'X');
--------------------------------------------------------------------------- */
IF DATABASE_PRINCIPAL_ID(N'id-primereq-prototype-project-process') IS NULL
    CREATE USER [id-primereq-prototype-project-process] FROM EXTERNAL PROVIDER;
GO
ALTER ROLE db_datareader ADD MEMBER [id-primereq-prototype-project-process];
ALTER ROLE db_datawriter ADD MEMBER [id-primereq-prototype-project-process];
GO

/* Verify steps 1-3: expect 5 new columns and both roles listed. */
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = N'projectprocess'
  AND COLUMN_NAME IN (N'version', N'updated_rev', N'updated_client')
ORDER BY TABLE_NAME, COLUMN_NAME;

SELECT r.name AS role_name, m.name AS member_name
FROM sys.database_role_members AS rm
JOIN sys.database_principals AS r ON r.principal_id = rm.role_principal_id
JOIN sys.database_principals AS m ON m.principal_id = rm.member_principal_id
WHERE m.name = N'id-primereq-prototype-project-process';
GO
