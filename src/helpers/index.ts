import http from "http";
import http2, { constants as H2 } from "http2";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  PathLike,
  readdirSync,
  statSync,
} from "fs";
import path, { join } from "path";
import { pipeline } from "stream";
import { rm } from "fs/promises";

// MODULE'S VARS
const {
  HTTP2_HEADER_CACHE_CONTROL,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_POST,
  HTTP_STATUS_METHOD_NOT_ALLOWED,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} = H2;

const MIME = new Map([
  ["bin", "application/octet-stream"],
  ["css", "text/css"],
  ["gif", "image/gif"],
  ["htm", "text/html"],
  ["html", "text/html"],
  ["ico", "image/vnd.microsoft.icon"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["js", "text/javascript"],
  ["json", "application/json"],
  ["mjs", "text/javascript"],
  ["mp3", "audio/mpeg"],
  ["mp4", "video/mp4"],
  ["pdf", "application/pdf"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["txt", "text/plain"],
  ["woff", "font/woff"],
  ["woff2", "font/woff2"],
  ["xml", "text/xml"],
]);

const FILE_ICON = "favicon.ico";
const FILE_INDEX = "index.html";
const HEAD_FILENAME = "upload-filename";
const SSE_CLOSE = "close";
const URL_REMOVE = "/remove/";
const URL_SSE = "/sse/";
const URL_UPLOAD = "/upload/";

const getMimeType = (filename: string): string => {
  const ext = filename.substring(filename.lastIndexOf(".") + 1);
  const norm: string = typeof ext === "string" ? ext.toLowerCase() : "";

  return MIME.get(norm) ?? MIME.get("bin")!;
};

const processRemove = (
  req: http.IncomingMessage | http2.Http2ServerRequest,
  res: http.ServerResponse | http2.Http2ServerResponse,
  root: string
) => {
  const chunks: any = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const json = Buffer.concat(chunks).toString();
    const body = JSON.parse(json);
    let total = 0;
    for (const filename of body.files) {
      const fullPath = join(root, filename);

      if (fullPath.startsWith(root) && existsSync(fullPath)) {
        await rm(fullPath);
        total++;
      }
    }
    res.writeHead(HTTP_STATUS_OK, {
      [HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
    });
    res.end(`Total removed: ${total} files.`);
  });
};

const processServerEvents = (res: http.ServerResponse, root: PathLike) => {
  res.writeHead(HTTP_STATUS_OK, {
    [HTTP2_HEADER_CONTENT_TYPE]: "text/event-stream",
    [HTTP2_HEADER_CACHE_CONTROL]: "no-cache",
  });

  const list = readdirSync(root);
  const total = list.length;
  let i = 0;
  (function sendEvent() {
    if (i < total) {
      const name = list[i];
      res.write(`data: ${name}\n\n`);
      i++;
      setTimeout(sendEvent, 200);
    } else {
      res.end(`data: ${SSE_CLOSE}\n\n`);
    }
  })();
};

const processStatic = (
  res: http.ServerResponse | http2.Http2ServerResponse,
  path: string,
  root: string
) => {
  const fullPath = join(root, path);
  if (
    fullPath.startsWith(root) &&
    existsSync(fullPath) &&
    statSync(fullPath).isFile()
  ) {
    // return file content
    const readStream = createReadStream(fullPath);
    const mimeType = getMimeType(fullPath);
    res.writeHead(HTTP_STATUS_OK, {
      [HTTP2_HEADER_CONTENT_TYPE]: mimeType,
    });
    pipeline(readStream, res, (err: any) => {
      if (err) console.dir(err);
    });
  } else {
    respond404(res);
  }
};

const processUpload = (
  req: http.IncomingMessage | http2.Http2ServerRequest,
  res: http.ServerResponse | http2.Http2ServerResponse,
  root: string
) => {
  const encoded: string = req.headers[HEAD_FILENAME] as string;
  const filename = Buffer.from(encoded, "base64").toString();
  const fullPath = join(root, filename);
  if (
    fullPath.startsWith(root) &&
    filename !== FILE_INDEX &&
    filename !== FILE_ICON
  ) {
    const ws = createWriteStream(fullPath);
    req.pipe(ws);
  }
  res.writeHead(HTTP_STATUS_OK, {
    [HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
  });

  res.end("Загружено.");
};

const respond404 = (res: http.ServerResponse | http2.Http2ServerResponse) => {
  res.writeHead(HTTP_STATUS_NOT_FOUND, {
    [HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
  });
  res.end("Запрошенный ресурс не найден.");
};

const respond405 = (res: http.ServerResponse | http2.Http2ServerResponse) => {
  res.writeHead(HTTP_STATUS_METHOD_NOT_ALLOWED, {
    [HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
  });
  res.end("Разрешены только методы GET и POST.");
};

export const onRequest = (
  req: http.IncomingMessage | http2.Http2ServerRequest,
  res: http.ServerResponse
) => {
  const { method, url } = req;
  console.log(`${new Date().toISOString()}: ${method} ${url}`);
  if (url) {
    if (method === HTTP2_METHOD_GET) {
      if (url === URL_SSE) {
        processServerEvents(res, path.join(__dirname, "../../pub/"));
      } else {
        processStatic(res, url, path.join(__dirname, "../../static/"));
      }
    } else if (method === HTTP2_METHOD_POST) {
      if (url === URL_UPLOAD) {
        processUpload(req, res, path.join(__dirname, "../../pub/"));
      } else if (url === URL_REMOVE) {
        processRemove(req, res, path.join(__dirname, "../../pub/"));
      }
    } else {
      respond404(res);
    }
  } else {
    respond405(res);
  }
};
