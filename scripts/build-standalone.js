const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function safeScript(value) {
  return value
    .replace(/<\/script/gi, "<\\/script")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function safeStyle(value) {
  return value.replace(/<\/style/gi, "<\\/style");
}

const html = read("index.html");
const css = read("styles.css");
const data = read("data/events-2026.js");
const app = read("app.js");
const favicon = Buffer.from(read("favicon.svg")).toString("base64");

const standalone = html
  .replace(
    '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
    `<link rel="icon" href="data:image/svg+xml;base64,${favicon}" type="image/svg+xml">`,
  )
  .replace(
    /<link rel="stylesheet" href="styles\.css(?:\?v=\d+)?">/,
    `<style>\n${safeStyle(css)}\n</style>`,
  )
  .replace(
    /<script src="data\/events-2026\.js(?:\?v=\d+)?"><\/script>/,
    `<script>\n${safeScript(data)}\n</script>`,
  )
  .replace(
    /<script src="app\.js(?:\?v=\d+)?"><\/script>/,
    `<script>\n${safeScript(app)}\n</script>`,
  );

fs.writeFileSync(path.join(root, "car-show-calendar.html"), standalone);
console.log("Built car-show-calendar.html");
