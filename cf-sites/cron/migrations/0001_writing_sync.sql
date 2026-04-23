-- Writing task sync: site -> project mapping + job cursor
CREATE TABLE IF NOT EXISTS writing_sync (
  siteId TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  lastJobId TEXT,
  updatedAt TEXT NOT NULL
);
