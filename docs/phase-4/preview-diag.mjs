import { lookup } from "node:dns/promises";
const start = Date.now();
try {
  const res = await Promise.race([
    lookup("localhost", { family: 4 }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 5000)),
  ]);
  console.log("localhost v4 ->", JSON.stringify(res), Date.now() - start + "ms");
} catch (e) {
  console.log("localhost v4 ->", e.message, Date.now() - start + "ms");
}
process.exit(0);
