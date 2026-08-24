import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = new URL("../dist/", import.meta.url);
const projectRoot = new URL("../", import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all([
  cp(new URL("index.html", projectRoot), new URL("index.html", outputDirectory)),
  cp(new URL("css", projectRoot), new URL("css", outputDirectory), { recursive: true }),
  cp(new URL("js", projectRoot), new URL("js", outputDirectory), { recursive: true }),
  cp(new URL("vendor", projectRoot), new URL("vendor", outputDirectory), { recursive: true })
]);

console.log("Static site prepared in dist/");
