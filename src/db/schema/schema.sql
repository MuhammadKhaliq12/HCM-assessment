-- SQLite schema for ReadyOn Time-Off microservice.

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employeeId TEXT NOT NULL,
  locationId TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (employeeId, locationId)
);

CREATE TABLE IF NOT EXISTS timeOffBalances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employeeId TEXT NOT NULL,
  locationId TEXT NOT NULL,
  type TEXT NOT NULL,
  days REAL NOT NULL,
  lastSyncedAt TEXT NULL,
  hcmVersion TEXT NULL,
  UNIQUE (employeeId, locationId, type)
);

CREATE TABLE IF NOT EXISTS timeOffRequests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employeeId TEXT NOT NULL,
  locationId TEXT,
  leaveType TEXT NOT NULL DEFAULT 'ANNUAL',
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  days REAL NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requestedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS balanceSyncLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employeeId TEXT NOT NULL,
  before REAL NOT NULL,
  after REAL NOT NULL,
  reason TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hcmWebhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  externalEventId TEXT UNIQUE,
  processedAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS corpusIngestLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotencyKey TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
