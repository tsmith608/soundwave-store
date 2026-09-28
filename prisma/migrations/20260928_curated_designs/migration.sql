-- Curated designs: artwork spec on orders + first-party analytics events (PostgreSQL)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "artworkSpec" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "listenToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_listenToken_key" ON "Order"("listenToken");

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "eventId" TEXT,
    "sessionId" TEXT,
    "path" TEXT,
    "referrer" TEXT,
    "params" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_event_createdAt_idx" ON "AnalyticsEvent"("event", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

CREATE TABLE IF NOT EXISTS "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "occasion" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_email_key" ON "Subscriber"("email");
