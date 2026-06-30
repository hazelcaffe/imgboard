import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dataDir = path.resolve(__dirname, "..", "data");
const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);

export function resolveDataPath(file: string) {
    const resolved = path.resolve(dataDir, file);

    if (resolved !== dataDir && !resolved.startsWith(dataDir + path.sep)) {
        return null;
    }

    return resolved;
}

export function toDataPath(file: string) {
    return path.relative(dataDir, file).split(path.sep).join("/");
}

export function isImageFile(file: string) {
    return imageExtensions.has(path.extname(file).toLowerCase());
}

export async function listFiles(dir = dataDir): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return listFiles(fullPath);
        }

        if (entry.isFile() && isImageFile(entry.name)) {
            return [toDataPath(fullPath)];
        }

        return [];
    }));

    return files.flat().sort();
}
