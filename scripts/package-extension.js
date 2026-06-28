import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const baseManifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const version = packageJson.version;
const stagingRoot = join(root, ".extension-package");
const distDir = join(root, "dist");
const fixedTimestamp = new Date("2000-01-01T00:00:00Z");

const entries = [
    "manifest.json",
    "src",
    "assets"
];
const localOnlyEntries = [
    "assets/images/local-image.jpg"
];

const targets = [
    {
        name: "chromium",
        manifest: createChromiumManifest(baseManifest)
    },
    {
        name: "firefox",
        manifest: createFirefoxManifest(baseManifest)
    }
];

rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const target of targets) {
    const stagingDir = join(stagingRoot, target.name);
    const zipPath = join(distDir, `site-blocker-${target.name}-v${version}.zip`);

    mkdirSync(stagingDir, { recursive: true });
    rmSync(zipPath, { force: true });

    for (const entry of entries) {
        if (entry === "manifest.json") continue;

        const source = join(root, entry);

        if (!existsSync(source)) {
            throw new Error(`Missing package entry: ${entry}`);
        }

        cpSync(source, join(stagingDir, entry), {
            recursive: true,
            preserveTimestamps: false
        });
    }

    for (const entry of localOnlyEntries) {
        rmSync(join(stagingDir, entry), { force: true });
    }

    await writeFile(
        join(stagingDir, "manifest.json"),
        `${JSON.stringify(target.manifest, null, 2)}\n`
    );

    touchTree(stagingDir);

    const result = spawnSync("zip", ["-X", "-q", "-r", zipPath, ...entries], {
        cwd: stagingDir,
        stdio: "inherit"
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`zip exited with status ${result.status}`);
    }

    console.log(`Created ${zipPath}`);
}

rmSync(stagingRoot, { recursive: true, force: true });

function createChromiumManifest(manifest) {
    return {
        ...manifest,
        background: {
            service_worker: manifest.background.service_worker,
            type: "module"
        }
    };
}

function createFirefoxManifest(manifest) {
    return {
        ...manifest,
        background: {
            scripts: [manifest.background.service_worker],
            type: "module",
            preferred_environment: ["document"]
        }
    };
}

function touchTree(path) {
    const stats = statSync(path);

    if (stats.isDirectory()) {
        for (const child of readdirSync(path).sort()) {
            touchTree(join(path, child));
        }
    }

    utimesSync(path, fixedTimestamp, fixedTimestamp);
}
