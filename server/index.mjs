import { createApp } from "./app.mjs";

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
const app = createApp({ production: process.argv.includes("--production") });
app.listen(port, host, () =>
  console.log(`澄言服务已启动：http://${host}:${port}`),
);
