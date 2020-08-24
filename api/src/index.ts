/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
import bodyParser from "body-parser";
import cluster from "cluster";
import compression from "compression";
import express, { Application } from "express";
import { Server } from "http";
import os from "os";
import SocketIO from "socket.io";
import stickyCluster from "sticky-cluster";
import { initWorkerServices, initMasterServices } from "./initServices";
import { IFeedSubscribeRequest } from "./models/api/IFeedSubscribeRequest";
import { IConfiguration } from "./models/configuration/IConfiguration";
import { routes } from "./routes";
import { subscribe } from "./routes/feed/subscribe";
import { unsubscribe } from "./routes/feed/unsubscribe";
import { cors, executeRoute } from "./utils/apiHelper";

const configId = process.env.CONFIG_ID || "local";
const config: IConfiguration = require(`./data/config.${configId}.json`);

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 4000;

if (cluster.isMaster) {
    console.log(`Running Config '${configId}'`);
    console.log(`API port ${port}`);

    initMasterServices(config).catch(err => console.error(err));
}

stickyCluster(
    callback => {
        const app: Application = express();

        app.use(bodyParser.json({ limit: "10mb" }));
        app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

        app.use(compression());

        app.use((req, res, next) => {
            cors(
                req,
                res,
                config.allowedDomains ? config.allowedDomains.join(",") : undefined,
                "GET, POST, OPTIONS, PUT, PATCH, DELETE",
                "Content-Type, Authorization");
            next();
        });

        for (const route of routes) {
            app[route.method](route.path, async (req, res) => {
                await executeRoute(
                    req,
                    res,
                    config,
                    route,
                    req.params,
                    config.verboseLogging);
            });
        }

        const server = new Server(app);
        // eslint-disable-next-line new-cap
        const socketServer = SocketIO(server);

        const sockets: {
            [socketId: string]: string;
        } = {};

        socketServer.on("connection", socket => {
            socket.on("subscribe", async (data: IFeedSubscribeRequest) => {
                const response = await subscribe(config, socket, data);
                if (!response.error) {
                    sockets[socket.id] = data.network;
                }
                socket.emit("subscribe", response);
            });

            socket.on("unsubscribe", data => {
                const response = unsubscribe(config, socket, data);
                if (sockets[socket.id]) {
                    delete sockets[socket.id];
                }
                socket.emit("unsubscribe", response);
            });

            socket.on("disconnect", async () => {
                if (sockets[socket.id]) {
                    await unsubscribe(config, socket, {
                        subscriptionId: sockets[socket.id],
                        network: sockets[socket.id]
                    });
                    delete sockets[socket.id];
                }
            });
        });

        initWorkerServices(config,
            // We only run the storage sets on master or single worker.
            cluster.isMaster || Number(process.env.stickycluster_worker_index) === 0)
            .catch(err => console.error(err));

        callback(server);

        console.log(`Started Worker Index: ${process.env.stickycluster_worker_index}`);
    },
    {
        // We keep 1 cpu for master processing
        concurrency: Math.max(1, configId === "local" ? 1 : os.cpus().length - 1),
        port
    }
);
