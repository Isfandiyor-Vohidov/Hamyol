// Приложение «Мекка и Медина» — отдельная страница /mecca внутри Safar.
// Свой интерфейс и данные (mecca.html, js/mk-*.js, css/mecca.css, data/mk-*.js); узбекское приложение (/) не затрагивается.
const fsp = require("fs/promises");
const path = require("path");
const env = require("./env");
const { send } = require("./http");

const FILE = path.join(env.ROOT, "mecca.html");

async function page(req, res) {
  try {
    send(req, res, 200, await fsp.readFile(FILE), "text/html; charset=utf-8", "no-cache");
  } catch {
    send(req, res, 404, "Not found", "text/plain; charset=utf-8");
  }
}

const routes = [
  ["GET", "/mecca", page],
  ["GET", "/mecca/", (req, res) => { res.writeHead(301, { Location: "/mecca" }); res.end(); }]
];

module.exports = { routes };
