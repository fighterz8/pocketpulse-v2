/**
 * Dev / Beta mode toggle.
 *
 * Set to `true`  — beta-tester checkbox appears on the registration form,
 *                   and accounts registered with it can access dev-only
 *                   features (Test Suite, etc.).
 * Set to `false` — checkbox is hidden; dev-only routes 404; dev-only nav
 *                   links never appear in the sidebar.
 *
 * One change here = fully off everywhere (server + client both import this constant).
 */
export const DEV_MODE_ENABLED = true;
