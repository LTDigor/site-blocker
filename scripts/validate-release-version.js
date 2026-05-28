import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const tag = process.env.GITHUB_REF_NAME || process.argv[2] || "";
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));

if (!tag) {
    fail("Missing release tag. Pass a tag argument or set GITHUB_REF_NAME.");
}

if (!tag.startsWith("v")) {
    fail(`Release tag must start with "v": ${tag}`);
}

const tagVersion = tag.slice(1);

if (!/^\d+\.\d+\.\d+$/.test(tagVersion)) {
    fail(`Release tag must use SemVer format like v1.2.0: ${tag}`);
}

if (packageJson.version !== tagVersion) {
    fail(`package.json version ${packageJson.version} does not match tag ${tag}.`);
}

if (manifest.version !== tagVersion) {
    fail(`manifest.json version ${manifest.version} does not match tag ${tag}.`);
}

console.log(`Release version validated: ${tagVersion}`);

function fail(message) {
    console.error(message);
    process.exit(1);
}
