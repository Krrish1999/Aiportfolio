-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "resume_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "file_format" TEXT NOT NULL,
    "processing_status" TEXT NOT NULL,
    "parsed_data" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "resume_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "customizations" TEXT,
    "deployment_url" TEXT,
    "is_published" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "portfolios_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "resume_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parsing_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "confidence_score" REAL NOT NULL,
    "was_edited" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "parsing_metrics_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "resume_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_resume_sessions_user_id" ON "resume_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_portfolios_user_id" ON "portfolios"("user_id");

-- CreateIndex
CREATE INDEX "idx_portfolios_session_id" ON "portfolios"("session_id");

-- CreateIndex
CREATE INDEX "idx_parsing_metrics_session_id" ON "parsing_metrics"("session_id");
