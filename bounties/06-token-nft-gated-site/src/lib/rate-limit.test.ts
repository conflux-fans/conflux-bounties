describe("consumeLoginLimit", () => {
  const prevRedis = process.env.REDIS_URL;
  const prevMax = process.env.RATE_LIMIT_LOGIN_MAX;
  const prevWin = process.env.RATE_LIMIT_LOGIN_WINDOW_SEC;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.RATE_LIMIT_LOGIN_MAX;
    delete process.env.RATE_LIMIT_LOGIN_WINDOW_SEC;
    jest.resetModules();
  });

  afterEach(() => {
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevMax === undefined) delete process.env.RATE_LIMIT_LOGIN_MAX;
    else process.env.RATE_LIMIT_LOGIN_MAX = prevMax;
    if (prevWin === undefined) delete process.env.RATE_LIMIT_LOGIN_WINDOW_SEC;
    else process.env.RATE_LIMIT_LOGIN_WINDOW_SEC = prevWin;
  });

  it("allows requests under default memory limit", async () => {
    const { consumeLoginLimit: consume } = await import("./rate-limit");
    await expect(consume("ip:test-key-a")).resolves.toBeUndefined();
  });

  it("throws rate_limited after exceeding points", async () => {
    process.env.RATE_LIMIT_LOGIN_MAX = "3";
    process.env.RATE_LIMIT_LOGIN_WINDOW_SEC = "60";
    const { consumeLoginLimit: consume } = await import("./rate-limit");
    const key = `ip:burst-${Date.now()}`;
    await consume(key);
    await consume(key);
    await consume(key);
    await expect(consume(key)).rejects.toThrow("rate_limited");
  });
});
