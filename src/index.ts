import { createServer } from "http";
import { onRequest } from "./helpers";

const server = createServer();
server.listen(3000, () => {
  console.log("Server run http://localhost:3000/");
  console.log("Client run http://localhost:3000/index.html");
});
server.on("error", (err) => console.dir(err));
server.on("request", onRequest);
