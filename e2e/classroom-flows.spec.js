const { test, expect } = require("@playwright/test");

/**
 * API-level classroom / meetings flow stubs (KR4.5 light).
 * Does not require Mongo for routing smoke; 503 allowed where DB needed.
 */
test.describe("Classroom / meetings API surface", () => {
  const API = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

  test("health exposes mesh + region", async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body.features?.media).toBe("mesh");
    expect(body.features?.deploy).toBe("vercel-serverless");
  });

  test("ICE + media policy", async ({ request }) => {
    const ice = await request.get(`${API}/api/ice`);
    expect(ice.ok()).toBeTruthy();
    const iceJson = await ice.json();
    expect(Array.isArray(iceJson.iceServers)).toBeTruthy();

    const media = await request.get(`${API}/api/sfu/health`);
    expect(media.ok()).toBeTruthy();
    expect((await media.json()).policy).toBe("mesh_only");
  });

  test("LTI config + growth features", async ({ request }) => {
    const lti = await request.get(`${API}/api/lti/config`);
    expect(lti.ok()).toBeTruthy();
    expect((await lti.json()).version).toBe("1.3");

    const feat = await request.get(`${API}/api/growth/features`);
    expect(feat.ok()).toBeTruthy();
    const f = await feat.json();
    expect(f.mediaPolicy).toBe("mesh_only");
  });

  test("cost snapshot endpoint", async ({ request }) => {
    const res = await request.get(`${API}/api/growth/cost/mau`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("formula");
  });

  test("call quality metrics", async ({ request }) => {
    const post = await request.post(`${API}/api/metrics/call-quality`, {
      data: { event: "join_ok" },
    });
    expect(post.ok()).toBeTruthy();
    const get = await request.get(`${API}/api/metrics/call-quality`);
    expect(get.ok()).toBeTruthy();
    expect((await get.json()).joinOk).toBeGreaterThanOrEqual(1);
  });
});
