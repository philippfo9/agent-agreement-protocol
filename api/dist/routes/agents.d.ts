import { Router } from "express";
import { Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
export declare function agentRoutes(program: Program, connection: Connection): Router;
