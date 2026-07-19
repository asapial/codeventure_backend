import app from "./app";
import { prisma } from "./lib/prisma";

const PORT = process.env.PORT || 5000;

process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
});

async function main() {
    try {
        await prisma.$connect();
        console.log("Connected to the database successfully.");

        const server = app.listen(Number(PORT), () => {
            const addr = server.address();
            console.log(
                `Server is running on http://localhost:${PORT} (bound: ${JSON.stringify(addr)})`,
            );
        });

        server.on("error", (err: NodeJS.ErrnoException) => {
            console.error("[HTTP server error]", err);
            if (err.code === "EADDRINUSE") {
                console.error(
                    `\nPort ${PORT} is already in use. Another backend instance is likely still running.\n` +
                        `Find it with:  netstat -ano | findstr :${PORT}\n` +
                        `Then stop it:  Stop-Process -Id <PID> -Force\n`,
                );
                process.exit(1);
            }
        });

        // Keep the event loop alive for the lifetime of the process.
        // Some hosts/environments can otherwise let the loop drain after
        // `app.listen` if no other handles are pending.
        const keepAlive = setInterval(() => {}, 1 << 30);
        const shutdown = async (signal: string) => {
            console.log(`\n${signal} received, shutting down...`);
            clearInterval(keepAlive);
            server.close(() => console.log("HTTP server closed."));
            await prisma.$disconnect();
            process.exit(0);
        };
        process.on("SIGINT", () => void shutdown("SIGINT"));
        process.on("SIGTERM", () => void shutdown("SIGTERM"));
    } catch (error) {
        console.error("An error occurred:", error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

main();