"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agreementRoutes = agreementRoutes;
const express_1 = require("express");
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const program_1 = require("../program");
const STATUS_LABELS = {
    0: "proposed", 1: "active", 2: "fulfilled", 3: "breached", 4: "disputed", 5: "cancelled",
};
const TYPE_LABELS = {
    0: "safe", 1: "service", 2: "revenue_share", 3: "joint_venture", 4: "custom",
};
function serializeAccount(acc) {
    const obj = {};
    for (const [k, v] of Object.entries(acc)) {
        if (v instanceof web3_js_1.PublicKey) {
            obj[k] = v.toString();
        }
        else if (v && typeof v === "object" && "toNumber" in v) {
            obj[k] = v.toString();
        }
        else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "number") {
            obj[k] = Buffer.from(v).toString("hex");
        }
        else if (v && typeof v === "object") {
            obj[k] = serializeAccount(v);
        }
        else {
            obj[k] = v;
        }
    }
    return obj;
}
function agreementRoutes(program, connection) {
    const router = (0, express_1.Router)();
    // GET /agreements — list all agreements with optional filters
    router.get("/", async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const offset = parseInt(req.query.offset) || 0;
            const statusFilter = req.query.status;
            const typeFilter = req.query.type;
            const visibilityFilter = req.query.visibility;
            let allAccounts = await program.account.agreement.all();
            // Apply filters
            if (statusFilter !== undefined) {
                const statusVal = Object.entries(STATUS_LABELS).find(([_, v]) => v === statusFilter)?.[0];
                if (statusVal !== undefined) {
                    allAccounts = allAccounts.filter((a) => a.account.status === parseInt(statusVal));
                }
            }
            if (typeFilter !== undefined) {
                const typeVal = Object.entries(TYPE_LABELS).find(([_, v]) => v === typeFilter)?.[0];
                if (typeVal !== undefined) {
                    allAccounts = allAccounts.filter((a) => a.account.agreementType === parseInt(typeVal));
                }
            }
            if (visibilityFilter !== undefined) {
                const visVal = visibilityFilter === "public" ? 0 : visibilityFilter === "private" ? 1 : -1;
                if (visVal >= 0) {
                    allAccounts = allAccounts.filter((a) => a.account.visibility === visVal);
                }
            }
            const total = allAccounts.length;
            const page = allAccounts.slice(offset, offset + limit);
            res.json({
                agreements: page.map((a) => ({
                    pda: a.publicKey.toString(),
                    statusLabel: STATUS_LABELS[a.account.status],
                    typeLabel: TYPE_LABELS[a.account.agreementType],
                    ...serializeAccount(a.account),
                })),
                total,
                limit,
                offset,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // GET /agreements/:id — get agreement by PDA pubkey or agreement_id hex
    router.get("/:id", async (req, res) => {
        try {
            const id = req.params.id;
            let account;
            let pda;
            // Try as direct PDA pubkey first
            try {
                const pk = new web3_js_1.PublicKey(id);
                account = await program.account.agreement.fetch(pk);
                pda = pk.toString();
            }
            catch {
                // Try as hex agreement_id (16 bytes = 32 hex chars)
                if (id.length === 32) {
                    const idBytes = Array.from(Buffer.from(id, "hex"));
                    const [derivedPDA] = (0, program_1.findAgreementPDA)(idBytes);
                    account = await program.account.agreement.fetch(derivedPDA);
                    pda = derivedPDA.toString();
                }
                else {
                    return res.status(404).json({ error: "Agreement not found" });
                }
            }
            // Fetch parties
            const parties = await program.account.agreementParty.all([
                {
                    memcmp: {
                        offset: 8, // discriminator, then agreement pubkey
                        bytes: pda,
                    },
                },
            ]);
            res.json({
                pda,
                statusLabel: STATUS_LABELS[account.status],
                typeLabel: TYPE_LABELS[account.agreementType],
                ...serializeAccount(account),
                parties: parties.map((p) => ({
                    pda: p.publicKey.toString(),
                    ...serializeAccount(p.account),
                })),
            });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // POST /agreements/propose — build propose_agreement transaction
    router.post("/propose", async (req, res) => {
        try {
            const { proposerAgentKey, agreementId, // hex string, 32 chars
            agreementType, visibility, termsHash, // hex string
            termsUri, // string (padded to 64 bytes)
            numParties, expiresAt, } = req.body;
            if (!proposerAgentKey || !agreementId) {
                return res.status(400).json({ error: "proposerAgentKey and agreementId required" });
            }
            const agentPk = new web3_js_1.PublicKey(proposerAgentKey);
            const [identityPDA] = (0, program_1.findAgentIdentityPDA)(agentPk);
            const idBytes = Array.from(Buffer.from(agreementId, "hex"));
            const [agreementPDA] = (0, program_1.findAgreementPDA)(idBytes);
            const [partyPDA] = (0, program_1.findAgreementPartyPDA)(idBytes, identityPDA);
            const hashArr = termsHash
                ? Array.from(Buffer.from(termsHash, "hex"))
                : new Array(32).fill(0);
            // Pad termsUri to 64 bytes
            let uriArr = new Array(64).fill(0);
            if (termsUri) {
                const uriBuf = Buffer.from(termsUri);
                for (let i = 0; i < Math.min(uriBuf.length, 64); i++)
                    uriArr[i] = uriBuf[i];
            }
            const tx = await program.methods
                .proposeAgreement(idBytes, agreementType ?? 1, visibility ?? 0, hashArr, uriArr, numParties ?? 2, new anchor_1.BN(expiresAt ?? 0))
                .accounts({
                proposerSigner: agentPk,
                proposerIdentity: identityPDA,
                agreement: agreementPDA,
                proposerParty: partyPDA,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .transaction();
            tx.feePayer = agentPk;
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            res.json({
                transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
                agreementPDA: agreementPDA.toString(),
                partyPDA: partyPDA.toString(),
            });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // POST /agreements/:id/sign — build sign_agreement transaction
    router.post("/:id/sign", async (req, res) => {
        try {
            const { signerAgentKey } = req.body;
            const idBytes = Array.from(Buffer.from(req.params.id, "hex"));
            const agentPk = new web3_js_1.PublicKey(signerAgentKey);
            const [identityPDA] = (0, program_1.findAgentIdentityPDA)(agentPk);
            const [agreementPDA] = (0, program_1.findAgreementPDA)(idBytes);
            const [partyPDA] = (0, program_1.findAgreementPartyPDA)(idBytes, identityPDA);
            const tx = await program.methods
                .signAgreement(idBytes)
                .accounts({
                signer: agentPk,
                signerIdentity: identityPDA,
                agreement: agreementPDA,
                party: partyPDA,
            })
                .transaction();
            tx.feePayer = agentPk;
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            res.json({
                transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
            });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // POST /agreements/:id/cancel — build cancel_agreement transaction
    router.post("/:id/cancel", async (req, res) => {
        try {
            const { signerKey, proposerAgentKey } = req.body;
            const idBytes = Array.from(Buffer.from(req.params.id, "hex"));
            const signerPk = new web3_js_1.PublicKey(signerKey);
            const [proposerIdentityPDA] = (0, program_1.findAgentIdentityPDA)(new web3_js_1.PublicKey(proposerAgentKey));
            const [agreementPDA] = (0, program_1.findAgreementPDA)(idBytes);
            const tx = await program.methods
                .cancelAgreement(idBytes)
                .accounts({
                signer: signerPk,
                proposerIdentity: proposerIdentityPDA,
                agreement: agreementPDA,
            })
                .transaction();
            tx.feePayer = signerPk;
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            res.json({
                transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
            });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // POST /agreements/:id/fulfill — build fulfill_agreement transaction
    router.post("/:id/fulfill", async (req, res) => {
        try {
            const { signerKey, signerAgentKey } = req.body;
            const idBytes = Array.from(Buffer.from(req.params.id, "hex"));
            const signerPk = new web3_js_1.PublicKey(signerKey);
            const agentPk = new web3_js_1.PublicKey(signerAgentKey);
            const [identityPDA] = (0, program_1.findAgentIdentityPDA)(agentPk);
            const [agreementPDA] = (0, program_1.findAgreementPDA)(idBytes);
            const [partyPDA] = (0, program_1.findAgreementPartyPDA)(idBytes, identityPDA);
            const tx = await program.methods
                .fulfillAgreement(idBytes)
                .accounts({
                signer: signerPk,
                signerIdentity: identityPDA,
                signerParty: partyPDA,
                agreement: agreementPDA,
            })
                .transaction();
            tx.feePayer = signerPk;
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            res.json({
                transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
            });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    return router;
}
