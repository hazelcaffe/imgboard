import { randomUUID } from "node:crypto";
import { existsSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { open, readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { dataDir, isImageFile, listFiles, resolveDataPath, toDataPath } from "./data.js";

const anonymousNamePattern = /^[0-9a-f]{8}(?:\.[a-z0-9]+)?$/i;
const watchers = new Map<string, FSWatcher>();
let reconcileTimer: NodeJS.Timeout | undefined;
let reconcileRunning = false;

function isAnonymousName(file: string) {
    return anonymousNamePattern.test(path.basename(file));
}

function isHiddenPath(file: string) {
    return file.split(/[\\/]/).some(part => part.startsWith("."));
}

async function isAppleDesktopStore(file: string) {
    if (path.basename(file) === ".DS_Store") {
        return true;
    }

    if (path.extname(file)) {
        return false;
    }

    const handle = await open(file, "r").catch(() => null);

    if (!handle) {
        return false;
    }

    try {
        const header = Buffer.alloc(8);
        await handle.read(header, 0, header.length, 0);

        return header.equals(Buffer.from([0x00, 0x00, 0x00, 0x01, 0x42, 0x75, 0x64, 0x31]));
    } finally {
        await handle.close();
    }
}

async function createAnonymousPath(dir: string, ext: string) {
    while (true) {
        const file = `${randomUUID().split("-")[0]}${ext}`;
        const target = path.join(dir, file);

        if (!existsSync(target)) {
            return target;
        }
    }
}

export async function anonymizeFile(file: string) {
    if (!file) {
        return;
    }

    const source = resolveDataPath(file);

    if (!source) {
        return;
    }

    const info = await stat(source).catch(() => null);

    if (!info?.isFile()) {
        return;
    }

    if (await isAppleDesktopStore(source)) {
        await unlink(source);
        return;
    }

    if (isHiddenPath(file)) {
        return;
    }

    if (isAnonymousName(file) || !isImageFile(file)) {
        return;
    }

    const target = await createAnonymousPath(path.dirname(source), path.extname(file).toLowerCase());

    await rename(source, target);
}

export async function anonymizeDataDir() {
    const files = await listFiles();
    await Promise.all(files.map(file => anonymizeFile(file)));
}

export async function scanDirectory(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });

    await Promise.all(entries.map(async entry => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            watchDataDir(fullPath);
            await scanDirectory(fullPath);
            return;
        }

        if (entry.isFile()) {
            await anonymizeFile(toDataPath(fullPath));
        }
    }));
}

export function watchDataDir(dir = dataDir) {
    if (watchers.has(dir)) {
        return;
    }

    const watcher = watch(dir, { persistent: true }, () => {
        scheduleReconcile();
    });

    watchers.set(dir, watcher);
}

function scheduleReconcile() {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => {
        reconcileDataDir().catch(err => {
            console.error("Error reconciling data directory:", err);
        });
    }, 500);
}

async function reconcileDataDir() {
    if (reconcileRunning) {
        scheduleReconcile();
        return;
    }

    reconcileRunning = true;

    try {
        await scanDirectory(dataDir);
    } finally {
        reconcileRunning = false;
    }
}
