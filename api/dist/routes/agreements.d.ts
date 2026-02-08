import { Router } from "express";
import { Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
export declare function agreementRoutes(program: Program, connection: Connection): Router;
