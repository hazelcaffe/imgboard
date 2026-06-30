import express from "express";
import { anonymizeDataDir, scanDirectory, watchDataDir } from "./anon.js";
import { dataDir, listFiles, resolveDataPath } from "./data.js";

const app = express();

app.use(express.static("public"));

app.get("/data", async (_req, res) => {
    res.json(await listFiles());
});

app.get(/^\/data\/(.+)$/, (req, res) => {
    const requested = req.params[0];
    const file = resolveDataPath(requested);

    if (!file) {
        return res.status(403).send("Forbidden");
    }

    res.sendFile(file, err => {
        if (err) {
            res.status(404).end();
        }
    });
});

await anonymizeDataDir();
await scanDirectory(dataDir);
watchDataDir();

app.listen(3000, () => {
    console.log("Listening on port 3000");
});
