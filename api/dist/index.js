"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const agents_1 = require("./routes/agents");
const agreements_1 = require("./routes/agreements");
const program_1 = require("./program");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = parseInt(process.env.PORT || "3000");
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
async function main() {
    const { connection, program } = (0, program_1.createProgramClient)(RPC_URL);
    app.use("/agents", (0, agents_1.agentRoutes)(program, connection));
    app.use("/agreements", (0, agreements_1.agreementRoutes)(program, connection));
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", rpc: RPC_URL, programId: program.programId.toString() });
    });
    app.listen(PORT, () => {
        console.log(`AAP API listening on :${PORT} (RPC: ${RPC_URL})`);
    });
}
main().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
});
