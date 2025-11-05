// Monkey-patch fetch to log request/response for debugging.
const origFetch = global.fetch;
if (typeof origFetch === "function") {
  global.fetch = async (input: any, init?: RequestInit) => {
    const start = Date.now();
    try {
      const res = await origFetch(input, init);
      const dur = Date.now() - start;
      console.log("HTTP", typeof input === "string" ? input : input?.url, res.status, dur + "ms");
      return res;
    } catch (e) {
      console.error("HTTP ERROR", typeof input === "string" ? input : input?.url, e);
      throw e;
    }
  };
}
