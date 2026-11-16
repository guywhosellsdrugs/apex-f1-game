const fs = require("fs");
const path = require("path");

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== "dist") {
        walk(full, fileList);
      }
    } else if (file.endsWith(".tsx")) {
      fileList.push(full);
    }
  }
  return fileList;
}

const allTsx = walk("./src");

for (const file of allTsx) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    // Look for exact pattern: <tag ...>{expression}</tag> or <tag>{expression}</tag>
    const m = line.match(/<([A-Za-z0-9_.-]+)[^>]*>\s*\{([^}]+)\}\s*<\/\1>/);
    if (m) {
      const tag = m[1];
      const expr = m[2].trim();
      // Filter out obvious string constants or string templates
      if (
        !expr.startsWith("`") &&
        !expr.startsWith('"') &&
        !expr.startsWith("'") &&
        !expr.includes(".map") &&
        !expr.includes(".filter") &&
        !expr.includes("format") &&
        !expr.includes("toFixed") &&
        !expr.includes("toLocaleString")
      ) {
        console.log(`${file}:${idx + 1} <${tag}>{${expr}}</${tag}>`);
      }
    }
  });
}
