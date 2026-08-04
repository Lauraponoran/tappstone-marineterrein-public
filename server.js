import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4001;

// Placeholder proxy layer — add public-safe endpoints here that fetch from
// your internal API/DB, returning only what's safe to expose publicly.
// Example:
// app.get("/api/public/sound/hourly", async (req, res) => {
//   const data = await fetch("http://localhost:<internal-port>/api/sound/hourly");
//   res.json(await data.json());
// });

app.use(express.static(path.join(__dirname, "dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Public dashboard running on port ${PORT}`);
});
