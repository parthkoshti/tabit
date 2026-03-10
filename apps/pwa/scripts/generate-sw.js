const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const cacheBuster = process.env.NEXT_PUBLIC_QUERY_CACHE_BUSTER ?? "v1";

const templatePath = join(__dirname, "../public/sw.template.js");
const outputPath = join(__dirname, "../public/sw.js");

const template = readFileSync(templatePath, "utf-8");
const output = template.replace(/__CACHE_BUSTER__/g, cacheBuster);

writeFileSync(outputPath, output);
