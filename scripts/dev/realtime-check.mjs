import { createClient } from "@supabase/supabase-js";
const url = "http://127.0.0.1:54321",
  key = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const topic = "menu:00000000-0000-4000-8000-000000000001";
const listener = createClient(url, key),
  attacker = createClient(url, key);
const got = [];
const ch = listener
  .channel(topic, { config: { private: true } })
  .on("broadcast", { event: "availability" }, (m) => got.push(m.payload));
await new Promise((res) =>
  ch.subscribe((s, e) => {
    console.log("listener:", s, e?.message ?? "");
    if (s === "SUBSCRIBED") res();
  }),
);
const ach = attacker.channel(topic, { config: { private: true } });
await new Promise((res) =>
  ach.subscribe((s, e) => {
    console.log("attacker:", s, e?.message ?? "");
    if (s !== "SUBSCRIBED" && s !== "CLOSED") res();
    if (s === "SUBSCRIBED") res();
  }),
);
const r = await ach.send({
  type: "broadcast",
  event: "availability",
  payload: { id: "FAKE", availability: "unavailable" },
});
console.log("attacker send result:", r);
await new Promise((r) => setTimeout(r, 8000));
console.log("received:", JSON.stringify(got));
process.exit(0);
