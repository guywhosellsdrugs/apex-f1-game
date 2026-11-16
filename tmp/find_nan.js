const fs = require("fs");
const path = require("path");

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git") {
        walk(path.join(dir, file), fileList);
      }
    } else if (file.endsWith(".tsx")) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const allTsx = walk("./src");

for (const file of allTsx) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    const regex = />([^<]*\{[^}]+\}[^<]*)</g;
    let m;
    while ((m = regex.exec(line)) !== null) {
      const matchText = m[1].trim();
      const exprMatch = matchText.match(/\{([^}]+)\}/);
      if (exprMatch) {
        const expr = exprMatch[1].trim();
        if (
          (expr.includes("Math.") || expr.includes("/") || expr.includes("*") || expr.includes("-") || expr.includes("+") || expr.includes("Number(") || expr.includes("parseInt(") || expr.includes("parseFloat(")) &&
          !expr.startsWith("`") &&
          !expr.startsWith("\"") &&
          !expr.startsWith("'") &&
          !expr.includes("&&") &&
          !expr.includes("||") &&
          !expr.includes(".map") &&
          !expr.includes(".filter") &&
          !expr.includes(".join")
        ) {
          console.log(`${file}:${idx + 1}: ${line.trim()}`);
        }
      }
    }
  });
}
