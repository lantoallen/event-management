// Working name. Change it here and it updates everywhere.
export const APP_NAME = "Events";

export const SITE_URL =
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `http://localhost:${process.env.PORT || 3000}`);

export const AUTHOR = { name: "Allen Lanto", url: "https://lantoallen.vercel.app" };
export const REPO_URL = "https://github.com/lantoallen/events-app";
