// Filipino for "let's go", what you say when you invite someone along.
// Change it here and it updates everywhere.
export const APP_NAME = "Tara";

export const SITE_URL =
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `http://localhost:${process.env.PORT || 3000}`);

// Demo mode: sample data, one-click sample accounts, and a daily reset that
// wipes everything. Set DEMO_MODE=true or false to choose. When it's unset it's
// only on for local development without a database, so a real deployment can
// never reset itself by accident.
export const DEMO_MODE = process.env.DEMO_MODE
  ? process.env.DEMO_MODE === "true"
  : !process.env.DATABASE_URL && !process.env.VERCEL;

export const AUTHOR = { name: "Allen Lanto", url: "https://lantoallen.vercel.app" };
export const REPO_URL = "https://github.com/lantoallen/tara";
