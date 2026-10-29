/*
  STEP 4 - run ONLY AFTER the new build is deployed to every App Service slot.
  The previous build still reads and writes these columns and will fail without them.
*/
IF COL_LENGTH(N'projectprocess.Map', N'settings_json') IS NOT NULL
    ALTER TABLE projectprocess.Map DROP COLUMN settings_json;
GO
IF COL_LENGTH(N'projectprocess.Node', N'fx') IS NOT NULL
    ALTER TABLE projectprocess.Node DROP COLUMN fx;
GO
IF COL_LENGTH(N'projectprocess.Node', N'fy') IS NOT NULL
    ALTER TABLE projectprocess.Node DROP COLUMN fy;
GO
