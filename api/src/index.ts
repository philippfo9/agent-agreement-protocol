import express from "express";
import cors from "cors";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { agentRoutes } from "./routes/agents";
import { agreementRoutes } from "./routes/agreements";
import { createProgramClient } from "./program";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000");
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";

async function main() {
  const { connection, program } = createProgramClient(RPC_URL);

  app.use("/agents", agentRoutes(program, connection));
  app.use("/agreements", agreementRoutes(program, connection));

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
