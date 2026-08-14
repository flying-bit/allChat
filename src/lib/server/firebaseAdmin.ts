// Server-only. The Admin SDK bypasses database.rules.json entirely (that's
// its purpose - a trusted server context), which is exactly what the
// scheduled cleanup route needs to delete old data regardless of who sent
// it. Never import this from client code.
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env var - generate a service account key in " +
        "Firebase Console > Project Settings > Service Accounts, base64-encode the downloaded " +
        "JSON file, and set it as this env var."
    );
  }
  const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  app = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
  return app;
}

export function adminDb() {
  return getDatabase(getAdminApp());
}
