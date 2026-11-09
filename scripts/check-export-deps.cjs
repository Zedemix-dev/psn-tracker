// Fails (non-zero exit) if the Plat Wall PNG export cannot load what it needs.
// Usage: node check-export-deps.cjs [appRoot]   (default /app)
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(process.argv[2] || "/app");
const modules = path.join(root, ".next", "node_modules");

function only(prefix) {
  const found = fs.readdirSync(modules).filter((n) => n.startsWith(prefix));
  if (found.length !== 1) {
    throw new Error(`expected exactly one "${prefix}*" in ${modules}, found: ${JSON.stringify(found)}`);
  }
  return path.join(modules, found[0]);
}

// The app loads these through ESM `import` (Turbopack's e.y), so resolve the package
// "exports" with the node + import conditions and import that file, as the route does.
function entryOf(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  let target = pkg.exports && (pkg.exports["."] || pkg.exports);
  while (target && typeof target === "object") {
    target = target.node || target.import || target.default;
  }
  return path.join(dir, target || pkg.module || pkg.main);
}
async function load(prefix) {
  const mod = await import(pathToFileURL(entryOf(only(prefix))).href);
  return mod.default && Object.keys(mod).length === 1 ? mod.default : mod;
}

async function main() {
  const sharp = await load("sharp-");
  const png = await sharp(
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
  )
    .png()
    .toBuffer();
  if (!png.length) throw new Error("sharp produced an empty PNG");

  const fontkit = await load("fontkit-");
  const create = fontkit.create || (fontkit.default && fontkit.default.create);
  const font = create(fs.readFileSync(path.join(root, "public", "fonts", "Sora-Variable.ttf")));
  font.getVariation({ wght: 700 }).layout("A");
  console.log("export deps OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
