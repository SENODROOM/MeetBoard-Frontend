const { test, expect } = require("@playwright/test");

test.describe("Health / API surface", () => {
  const API = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

  test("health + lti + sfu stubs respond", async ({ request }) => {
    const health = await request.get(`${API}/api/health`);
    // May be 200 or 503 if DB down locally — both prove routing
    expect([200, 503]).toContain(health.status());

    const lti = await request.get(`${API}/api/lti/config`);
    expect(lti.ok()).toBeTruthy();
    const ltiJson = await lti.json();
    expect(ltiJson.version).toBe("1.3");

    const sfu = await request.get(`${API}/api/sfu/health`);
    expect(sfu.ok()).toBeTruthy();
  });
});
