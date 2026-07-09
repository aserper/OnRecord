import http from "http";

import { app } from "../app";
import { checkBlacklistConsistency, connect } from "../database";
import { fixRunningImportsAtStart } from "../database/queries/importer";
import { dbLoop } from "../spotify/looper";
import { setServerReady } from "../tools/boot";
import { get, getWithDefault } from "../tools/env";
import { logger } from "../tools/logger";

export function startServer() {
  const port = getWithDefault("PORT", 8080);
  app.set("port", port);

  const server = http.createServer(app);

  function onError(error: any) {
    if (error.syscall !== "listen") {
      throw error;
    }

    const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case "EACCES":
        console.error(`${bind} requires elevated privileges`);
        process.exit(1);
        break;
      case "EADDRINUSE":
        console.error(`${bind} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  function onListening() {
    const addr = server.address();
    const bind =
      typeof addr === "string" ? `pipe ${addr}` : `port ${addr?.port}`;
    logger.debug(`Listening on ${bind}`);
  }

  connect()
    .then(async () => {
      server.listen(port);
      server.on("error", onError);
      server.on("listening", onListening);
      const domain = get("CLIENT_ENDPOINT");
      if (domain.toLowerCase().includes("spotify")) {
        logger.warn(
          "Spotify was detected in CLIENT_ENDPOINT, Google might mark your entire domain as deceptive. https://github.com/Yooooomi/your_spotify/pull/254",
        );
      }
      // Sanitize the database before the server is considered ready. While these
      // tasks are running, the server still answers requests so the frontend can
      // display that the server is booting up.
      logger.info("Booting up, sanitizing the database...");
      try {
        await fixRunningImportsAtStart();
        await checkBlacklistConsistency();
      } catch (e) {
        logger.error(e);
      }
      setServerReady();
      logger.info("Boot finished, server is ready");
      // Only start fetching users' new tracks once the server has finished
      // booting.
      dbLoop().catch(logger.error);
    })
    .catch(console.error);
}
