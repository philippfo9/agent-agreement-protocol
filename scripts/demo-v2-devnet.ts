/**
 * AAP V2 Compressed Demo Script — Devnet
 *
 * Demonstrates:
 *   1. Register two compressed agents (ZK Compression via Light Protocol V2)
 *   2. Propose a compressed agreement
 *   3. Add counterparty to agreement
 *   4. Counterparty signs the agreement
 *
 * Usage: npx ts-node scripts/demo-v2-devnet.ts
 */

import {
  createRpc,
  bn,
  featureFlags,
  VERSION,
  LightSystemProgram,
  defaultStaticAccounts,
  defaultStaticAccountsStruct,
  toAccountMetas,
} from "@lightprotocol/stateless.js";
import { keccak256 } from "js-sha3";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

// ── Config ──────────────────────────────────────────────────────────────────
const HELIUS_API_KEY = "0a24352c-be73-4d0e-9777-38bfde485853";
const HELIUS_RPC = `https://devnet.helius-rpc.com?api-key=${HELIUS_API_KEY}`;
const PROGRAM_ID = new PublicKey("Ey56W7XXaeLm2kYNt5Ewp6TfgWgpVEZ2DD23ernmfuxY");
// V1 address tree (treeType 2 = batched, works with indexer)
const DEVNET_ADDRESS_TREE = new PublicKey("amt1Ayt45jfbdw5YSo7iz6WZxUmnZsQTYXy82hVwyC2");
const DEVNET_ADDRESS_QUEUE = new PublicKey("aq1S9z4reTSQAdgWHGD2zDaS39sjGrAxbR31vxJ2F4F");
// V2 batched state trees (from docs — not returned by getStateTreeInfos which only returns V1)
const DEVNET_V2_OUTPUT_QUEUE = new PublicKey("oq1na8gojfdUhsfCpyjNt6h4JaDWtHf1yQj4koBWfto");

// ── V2 Address Derivation (matches light_sdk::address::v2) ──────────────
function hashvToBn254(slices: Uint8Array[]): Uint8Array {
  // keccak256(slices... || [0xFF]), then set first byte to 0
  const hasher = keccak256.create();
  for (const s of slices) hasher.update(s);
  hasher.update(new Uint8Array([0xFF])); // HASH_TO_FIELD_SIZE_SEED
  const hash = new Uint8Array(hasher.arrayBuffer());
  hash[0] = 0; // truncate to BN254 field
  return hash;
}

function deriveAddressSeedV2(seeds: Uint8Array[]): Uint8Array {
  return hashvToBn254(seeds);
}

function deriveAddressV2(seeds: Uint8Array[], addressTree: PublicKey, programId: PublicKey): { address: PublicKey; seed: Uint8Array } {
  const seed = deriveAddressSeedV2(seeds);
  const address = hashvToBn254([seed, addressTree.toBytes(), programId.toBytes()]);
  return { address: new PublicKey(address), seed };
}
const STATE_TREE_LOOKUP_TABLE = new PublicKey("qAJZMgnQJ8G6vA3WRcjD9Jan1wtKkaCFWLWskxJrR5V");

// Force V2 mode
(featureFlags as any).version = VERSION.V2;

// Load IDL
const idlPath = path.join(__dirname, "..", "target", "idl", "aap_compressed.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadWallet(): Keypair {
  const keyPath = path.join(process.env.HOME || "/root", ".config", "solana", "id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, "utf-8"))));
}

function getCpiSigner(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("cpi_authority")], PROGRAM_ID)[0];
}

function buildSystemRemainingAccounts(): PublicKey[] {
  const statics = defaultStaticAccountsStruct();
  // V2 CpiAccounts order (from CompressionCpiAccountIndex enum):
  return [
    LightSystemProgram.programId,                         // 0: LightSystemProgram
    getCpiSigner(),                                        // 1: Authority (CPI signer PDA)
    statics.registeredProgramPda,                          // 2: RegisteredProgramPda
    statics.accountCompressionAuthority,                   // 3: AccountCompressionAuthority
    statics.accountCompressionProgram,                     // 4: AccountCompressionProgram
    SystemProgram.programId,                               // 5: SystemProgram
  ];
}

function findOrAdd(accounts: PublicKey[], pubkey: PublicKey): number {
  const idx = accounts.findIndex((a) => a.equals(pubkey));
  if (idx >= 0) return idx;
  accounts.push(pubkey);
  return accounts.length - 1;
}

function encodeRegisterAgent(args: {
  proof: { compressedProof: { a: number[]; b: number[]; c: number[] } | null };
  addressTreeInfo: { addressMerkleTreePubkeyIndex: number; addressQueuePubkeyIndex: number; rootIndex: number };
  outputStateTreeIndex: number;
  agentKey: number[];
  metadataHash: number[];
  scope: { canSignAgreements: boolean; canCommitFunds: boolean; maxCommitLamports: bigint | number; expiresAt: bigint | number };
}): Buffer {
  // Discriminator for register_agent
  const disc = Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]);

  const parts: Buffer[] = [disc];

  // ValidityProof: Option<CompressedProof> (tuple struct - just the option directly)
  if (args.proof.compressedProof) {
    parts.push(Buffer.from([1])); // Some
    parts.push(Buffer.from(args.proof.compressedProof.a)); // 32 bytes
    parts.push(Buffer.from(args.proof.compressedProof.b)); // 64 bytes
    parts.push(Buffer.from(args.proof.compressedProof.c)); // 32 bytes
  } else {
    parts.push(Buffer.from([0])); // None
  }

  // PackedAddressTreeInfo: { u8, u8, u16 }
  const ati = Buffer.alloc(4);
  ati.writeUInt8(args.addressTreeInfo.addressMerkleTreePubkeyIndex, 0);
  ati.writeUInt8(args.addressTreeInfo.addressQueuePubkeyIndex, 1);
  ati.writeUInt16LE(args.addressTreeInfo.rootIndex, 2);
  parts.push(ati);

  // output_state_tree_index: u8
  parts.push(Buffer.from([args.outputStateTreeIndex]));

  // agent_key: [u8; 32]
  parts.push(Buffer.from(args.agentKey));

  // metadata_hash: [u8; 32]
  parts.push(Buffer.from(args.metadataHash));

  // CompressedDelegationScope: { bool, bool, u64, i64 }
  const scope = Buffer.alloc(18);
  scope.writeUInt8(args.scope.canSignAgreements ? 1 : 0, 0);
  scope.writeUInt8(args.scope.canCommitFunds ? 1 : 0, 1);
  scope.writeBigUInt64LE(BigInt(args.scope.maxCommitLamports), 2);
  scope.writeBigInt64LE(BigInt(args.scope.expiresAt), 10);
  parts.push(scope);

  return Buffer.concat(parts);
}

// Keep generic encoder for other instructions (fallback)
function encodeInstruction(name: string, args: Record<string, any>): Buffer {
  const coder = new anchor.BorshInstructionCoder(idl as any);
  return coder.encode(name, args) as Buffer;
}

async function sendTx(
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  lookupTableAccount?: AddressLookupTableAccount
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: signers[0].publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTableAccount ? [lookupTableAccount] : []);
  const tx = new VersionedTransaction(msg);
  tx.sign(signers);
  const sig = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Deserialization ─────────────────────────────────────────────────────────

function deserializeAgentIdentity(data: any): any {
  if (!data || !data.data) throw new Error("No data to deserialize");
  const buf = Buffer.from(data.data);
  let o = 0;
  const authority = new PublicKey(buf.subarray(o, o + 32)); o += 32;
  const agentKey = new PublicKey(buf.subarray(o, o + 32)); o += 32;
  const metadataHash = Array.from(buf.subarray(o, o + 32)); o += 32;
  const canSignAgreements = buf[o] !== 0; o += 1;
  const canCommitFunds = buf[o] !== 0; o += 1;
  const maxCommitLamports = new anchor.BN(buf.subarray(o, o + 8), "le"); o += 8;
  const expiresAt = new anchor.BN(buf.subarray(o, o + 8), "le"); o += 8;
  const parent = new PublicKey(buf.subarray(o, o + 32)); o += 32;
  const createdAt = new anchor.BN(buf.subarray(o, o + 8), "le"); o += 8;
  return {
    authority, agentKey, metadataHash,
    scope: { canSignAgreements, canCommitFunds, maxCommitLamports, expiresAt },
    parent, createdAt,
  };
}

function deserializeAgreement(data: any): any {
  if (!data || !data.data) throw new Error("No data");
  const buf = Buffer.from(data.data);
  let o = 0;
  const agreementId = Array.from(buf.subarray(o, o + 16)); o += 16;
  const agreementType = buf[o]; o += 1;
  const status = buf[o]; o += 1;
  const visibility = buf[o]; o += 1;
  const proposer = new PublicKey(buf.subarray(o, o + 32)); o += 32;
  const termsHash = Array.from(buf.subarray(o, o + 32)); o += 32;
  const termsUri = Array.from(buf.subarray(o, o + 64)); o += 64;
  const numParties = buf[o]; o += 1;
  const numSigned = buf[o]; o += 1;
  const partiesAdded = buf[o]; o += 1;
  const createdAt = new anchor.BN(buf.subarray(o, o + 8), "le"); o += 8;
  const expiresAt = new anchor.BN(buf.subarray(o, o + 8), "le"); o += 8;
  return { agreementId, agreementType, status, visibility, proposer, termsHash, termsUri, numParties, numSigned, partiesAdded, createdAt, expiresAt };
}

function deserializeAgreementParty(data: any): any {
  if (!data || !data.data) throw new Error("No data");
  const buf = Buffer.from(data.data);
  let o = 0;
  const agreementAddress = Array.from(buf.subarray(o, o + 32)); o += 32;
  const agentIdentityAddress = Array.from(buf.subarray(o, o + 32)); o += 32;
  const role = buf[o]; o += 1;
  const signed = buf[o] !== 0; o += 1;
  const signedAt = new anchor.BN(buf.subarray(o, o + 8), "le"); o += 8;
  return { agreementAddress, agentIdentityAddress, role, signed, signedAt };
}

function packProof(proofResult: any): any {
  return {
    compressedProof: proofResult.compressedProof
      ? {
          a: Array.from(proofResult.compressedProof.a),
          b: Array.from(proofResult.compressedProof.b),
          c: Array.from(proofResult.compressedProof.c),
        }
      : null,
  };
}

function packAccountMeta(
  acc: any,
  address: number[],
  proofResult: any,
  proofIndex: number,
  remainingAccounts: PublicKey[]
): any {
  const treeIdx = findOrAdd(remainingAccounts, acc.treeInfo.tree);
  const queueIdx = findOrAdd(remainingAccounts, acc.treeInfo.queue);
  const outTree = acc.treeInfo.nextTreeInfo
    ? (acc.treeInfo.nextTreeInfo.queue || acc.treeInfo.nextTreeInfo.tree)
    : (acc.treeInfo.queue || acc.treeInfo.tree);
  const outIdx = findOrAdd(remainingAccounts, outTree);
  return {
    treeInfo: {
      rootIndex: proofResult.rootIndices[proofIndex],
      proveByIndex: proofResult.proveByIndices?.[proofIndex] ?? false,
      merkleTreePubkeyIndex: treeIdx,
      queuePubkeyIndex: queueIdx,
      leafIndex: acc.leafIndex,
    },
    address,
    outputStateTreeIndex: outIdx,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   AAP V2 — Compressed Demo (Devnet)                    ║");
  console.log("║   Light Protocol ZK Compression                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const rpc = createRpc(HELIUS_RPC, HELIUS_RPC, HELIUS_RPC);
  const connection = new Connection(HELIUS_RPC, "confirmed");
  const payer = loadWallet();

  console.log(`Wallet: ${payer.publicKey.toBase58()}`);
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // Load lookup table
  let lookupTableAccount: AddressLookupTableAccount | undefined;
  try {
    const ltResult = await connection.getAddressLookupTable(STATE_TREE_LOOKUP_TABLE);
    if (ltResult.value) lookupTableAccount = ltResult.value;
    console.log(`✓ Loaded lookup table: ${STATE_TREE_LOOKUP_TABLE.toBase58()}`);
  } catch (e) {
    console.log("⚠ Could not load lookup table");
  }

  const agentA = Keypair.generate();
  const agentB = Keypair.generate();
  console.log(`\nAgent A key: ${agentA.publicKey.toBase58()}`);
  console.log(`Agent B key: ${agentB.publicKey.toBase58()}`);

  const addressTree = DEVNET_ADDRESS_TREE;

  // ── Step 1: Register Agent A ──────────────────────────────────────────
  console.log("\n─── Step 1: Register Agent A (compressed) ───");
  const { address: agentAAddr, seed: agentASeed } = deriveAddressV2([Buffer.from("agent"), agentA.publicKey.toBytes()], addressTree, PROGRAM_ID);
  const agentAAddrBytes = Array.from(agentAAddr.toBytes());
  console.log(`  Address: ${agentAAddr.toBase58()}`);

  // Debug: verify address derivation
  {
    const seed = deriveAddressSeedV2([Buffer.from("agent"), Buffer.from(agentA.publicKey.toBytes())]);
    console.log(`  Seed: [${Array.from(seed).join(', ')}]`);
    console.log(`  Tree: ${addressTree.toBase58()} [${Array.from(addressTree.toBytes()).join(', ')}]`);
    console.log(`  ProgramId: ${PROGRAM_ID.toBase58()} [${Array.from(PROGRAM_ID.toBytes()).join(', ')}]`);
    console.log(`  Address: [${Array.from(agentAAddr.toBytes()).join(', ')}]`);
  }

  let sig = await registerAgent(rpc, connection, payer, agentA.publicKey.toBytes(), new Uint8Array(32).fill(1),
    { canSignAgreements: true, canCommitFunds: false, maxCommitLamports: new anchor.BN(0), expiresAt: new anchor.BN(0) },
    agentAAddr, agentAAddrBytes, addressTree, lookupTableAccount);
  console.log(`  ✓ tx: ${sig}`);

  // ── Step 2: Register Agent B ──────────────────────────────────────────
  console.log("\n─── Step 2: Register Agent B (compressed) ───");
  const { address: agentBAddr, seed: agentBSeed } = deriveAddressV2([Buffer.from("agent"), agentB.publicKey.toBytes()], addressTree, PROGRAM_ID);
  const agentBAddrBytes = Array.from(agentBAddr.toBytes());
  console.log(`  Address: ${agentBAddr.toBase58()}`);

  sig = await registerAgent(rpc, connection, payer, agentB.publicKey.toBytes(), new Uint8Array(32).fill(2),
    { canSignAgreements: true, canCommitFunds: false, maxCommitLamports: new anchor.BN(0), expiresAt: new anchor.BN(0) },
    agentBAddr, agentBAddrBytes, addressTree, lookupTableAccount);
  console.log(`  ✓ tx: ${sig}`);

  console.log("\n  ⏳ Waiting for indexer (8s)...");
  await sleep(8000);

  // ── Step 3: Propose Agreement ─────────────────────────────────────────
  console.log("\n─── Step 3: Propose Agreement ───");
  const agreementId = new Uint8Array(16).fill(42);
  const { address: agreementAddr, seed: agreementSeed } = deriveAddressV2([Buffer.from("agreement"), Buffer.from(agreementId)], addressTree, PROGRAM_ID);
  const agreementAddrBytes = Array.from(agreementAddr.toBytes());

  const { address: proposerPartyAddr, seed: proposerPartySeed } = deriveAddressV2(
    [Buffer.from("party"), Buffer.from(agreementId), agentAAddr.toBytes()], addressTree, PROGRAM_ID);

  sig = await proposeAgreement(rpc, connection, payer, agentA, agentAAddr, agentAAddrBytes,
    agreementId, agreementAddr, agreementAddrBytes, proposerPartyAddr, addressTree, lookupTableAccount);
  console.log(`  ✓ tx: ${sig}`);

  console.log("\n  ⏳ Waiting for indexer (8s)...");
  await sleep(8000);

  // ── Step 4: Add Party ─────────────────────────────────────────────────
  console.log("\n─── Step 4: Add Agent B as counterparty ───");
  const { address: cpPartyAddr, seed: cpPartySeed } = deriveAddressV2(
    [Buffer.from("party"), Buffer.from(agreementId), agentBAddr.toBytes()], addressTree, PROGRAM_ID);

  sig = await addParty(rpc, connection, payer, agentA, agentAAddr, agentAAddrBytes,
    agentBAddr, agentBAddrBytes, agreementAddr, agreementAddrBytes, agreementId,
    cpPartyAddr, addressTree, lookupTableAccount);
  console.log(`  ✓ tx: ${sig}`);

  console.log("\n  ⏳ Waiting for indexer (8s)...");
  await sleep(8000);

  // ── Step 5: Sign Agreement ────────────────────────────────────────────
  console.log("\n─── Step 5: Agent B signs the agreement ───");
  sig = await signAgreementFn(rpc, connection, payer, agentB, agentBAddr, agentBAddrBytes,
    agreementAddr, agreementAddrBytes, cpPartyAddr, Array.from(cpPartyAddr.toBytes()),
    lookupTableAccount);
  console.log(`  ✓ tx: ${sig}`);

  // ── Summary ───────────────────────────────────────────────────────────
  const finalBalance = await connection.getBalance(payer.publicKey);
  const totalCost = (balance - finalBalance) / 1e9;

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Summary                                               ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Total cost:       ${totalCost.toFixed(6)} SOL (5 txs)`);
  console.log("║                                                         ║");
  console.log("║  V1 rent (5 accounts): ~0.014 SOL                      ║");
  console.log("║  V2 compressed:        ~0.00x SOL (no rent!)           ║");
  console.log("║  Savings:              ~95%+ cheaper                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
}

// ── Instruction Functions ───────────────────────────────────────────────────

async function registerAgent(
  rpc: any, connection: Connection, payer: Keypair,
  agentKey: Uint8Array, metadataHash: Uint8Array, scope: any,
  address: PublicKey, addressBytes: number[], addressTree: PublicKey,
  lut?: AddressLookupTableAccount
): Promise<string> {
  const proofResult = await rpc.getValidityProofV0(
    [],
    [{ address: bn(address.toBytes()), tree: addressTree, queue: DEVNET_ADDRESS_QUEUE }]
  );

  const systemAccounts = buildSystemRemainingAccounts();
  const SYSTEM_OFFSET = systemAccounts.length; // packed accounts start after this
  const remainingAccounts = [...systemAccounts];
  const addrTreeIdx = findOrAdd(remainingAccounts, addressTree) - SYSTEM_OFFSET;
  const addrQueueIdx = findOrAdd(remainingAccounts, DEVNET_ADDRESS_QUEUE) - SYSTEM_OFFSET;

  // Use V2 batched output queue directly
  const outputIdx = findOrAdd(remainingAccounts, DEVNET_V2_OUTPUT_QUEUE) - SYSTEM_OFFSET;

  const data = encodeRegisterAgent({
    proof: packProof(proofResult),
    addressTreeInfo: {
      addressMerkleTreePubkeyIndex: addrTreeIdx,
      addressQueuePubkeyIndex: addrQueueIdx,
      rootIndex: proofResult.rootIndices?.[0] ?? 0,
    },
    outputStateTreeIndex: outputIdx,
    agentKey: Array.from(agentKey),
    metadataHash: Array.from(metadataHash),
    scope,
  });

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      ...toAccountMetas(remainingAccounts),
    ],
    data,
  });

  return sendTx(connection, [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), ix], [payer], lut);
}

async function proposeAgreement(
  rpc: any, connection: Connection, payer: Keypair, agentSigner: Keypair,
  proposerAddr: PublicKey, proposerAddrBytes: number[],
  agreementId: Uint8Array, agreementAddr: PublicKey, agreementAddrBytes: number[],
  partyAddr: PublicKey, addressTree: PublicKey,
  lut?: AddressLookupTableAccount
): Promise<string> {
  const proposerAccount = await rpc.getCompressedAccount(bn(proposerAddr.toBytes()));
  if (!proposerAccount) throw new Error("Proposer not found in indexer");

  const proofResult = await rpc.getValidityProofV0(
    [{ hash: proposerAccount.hash, tree: proposerAccount.treeInfo.tree, queue: proposerAccount.treeInfo.queue }],
    [
      { address: bn(agreementAddr.toBytes()), tree: addressTree, queue: DEVNET_ADDRESS_QUEUE },
      { address: bn(partyAddr.toBytes()), tree: addressTree, queue: DEVNET_ADDRESS_QUEUE },
    ]
  );

  const remainingAccounts = buildSystemRemainingAccounts();
  const proposerMeta = packAccountMeta(proposerAccount, proposerAddrBytes, proofResult, 0, remainingAccounts);
  const addrTreeIdx = findOrAdd(remainingAccounts, addressTree);

  const termsUri = new Uint8Array(64);
  Buffer.from("ipfs://QmDemo").copy(Buffer.from(termsUri.buffer));

  const data = encodeInstruction("propose_agreement", {
    proof: packProof(proofResult),
    proposerAccountMeta: proposerMeta,
    proposerIdentity: deserializeAgentIdentity(proposerAccount.data),
    agreementAddressTreeInfo: {
      addressMerkleTreePubkeyIndex: addrTreeIdx,
      addressQueuePubkeyIndex: addrTreeIdx,
      rootIndex: proofResult.rootIndices[1],
    },
    partyAddressTreeInfo: {
      addressMerkleTreePubkeyIndex: addrTreeIdx,
      addressQueuePubkeyIndex: addrTreeIdx,
      rootIndex: proofResult.rootIndices[2],
    },
    outputStateTreeIndex: proposerMeta.outputStateTreeIndex,
    agreementId: Array.from(agreementId),
    agreementType: 0,
    visibility: 0,
    termsHash: Array.from(new Uint8Array(32)),
    termsUri: Array.from(termsUri),
    numParties: 2,
    expiresAt: new anchor.BN(0),
  });

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: agentSigner.publicKey, isSigner: true, isWritable: true },
      ...toAccountMetas(remainingAccounts),
    ],
    data,
  });

  return sendTx(connection, [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), ix],
    [payer, agentSigner], lut);
}

async function addParty(
  rpc: any, connection: Connection, payer: Keypair, proposerSigner: Keypair,
  proposerAddr: PublicKey, proposerAddrBytes: number[],
  partyIdentityAddr: PublicKey, partyIdentityAddrBytes: number[],
  agreementAddr: PublicKey, agreementAddrBytes: number[],
  agreementId: Uint8Array, newPartyAddr: PublicKey,
  addressTree: PublicKey, lut?: AddressLookupTableAccount
): Promise<string> {
  const proposerAcc = await rpc.getCompressedAccount(bn(proposerAddr.toBytes()));
  const agreementAcc = await rpc.getCompressedAccount(bn(agreementAddr.toBytes()));
  const partyIdAcc = await rpc.getCompressedAccount(bn(partyIdentityAddr.toBytes()));
  if (!proposerAcc || !agreementAcc || !partyIdAcc) throw new Error("Account not found");

  const proofResult = await rpc.getValidityProofV0(
    [
      { hash: proposerAcc.hash, tree: proposerAcc.treeInfo.tree, queue: proposerAcc.treeInfo.queue },
      { hash: agreementAcc.hash, tree: agreementAcc.treeInfo.tree, queue: agreementAcc.treeInfo.queue },
      { hash: partyIdAcc.hash, tree: partyIdAcc.treeInfo.tree, queue: partyIdAcc.treeInfo.queue },
    ],
    [{ address: bn(newPartyAddr.toBytes()), tree: addressTree, queue: DEVNET_ADDRESS_QUEUE }]
  );

  const remainingAccounts = buildSystemRemainingAccounts();
  const pm0 = packAccountMeta(proposerAcc, proposerAddrBytes, proofResult, 0, remainingAccounts);
  const pm1 = packAccountMeta(agreementAcc, agreementAddrBytes, proofResult, 1, remainingAccounts);
  const pm2 = packAccountMeta(partyIdAcc, partyIdentityAddrBytes, proofResult, 2, remainingAccounts);
  const addrTreeIdx = findOrAdd(remainingAccounts, addressTree);

  const data = encodeInstruction("add_party", {
    proof: packProof(proofResult),
    proposerAccountMeta: pm0,
    proposerIdentity: deserializeAgentIdentity(proposerAcc.data),
    agreementAccountMeta: pm1,
    currentAgreement: deserializeAgreement(agreementAcc.data),
    partyIdentityAccountMeta: pm2,
    partyIdentity: deserializeAgentIdentity(partyIdAcc.data),
    partyAddressTreeInfo: {
      addressMerkleTreePubkeyIndex: addrTreeIdx,
      addressQueuePubkeyIndex: addrTreeIdx,
      rootIndex: proofResult.rootIndices[3],
    },
    outputStateTreeIndex: pm0.outputStateTreeIndex,
    role: 1,
  });

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: proposerSigner.publicKey, isSigner: true, isWritable: true },
      ...toAccountMetas(remainingAccounts),
    ],
    data,
  });

  return sendTx(connection, [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), ix],
    [payer, proposerSigner], lut);
}

async function signAgreementFn(
  rpc: any, connection: Connection, payer: Keypair, signerAgent: Keypair,
  signerAddr: PublicKey, signerAddrBytes: number[],
  agreementAddr: PublicKey, agreementAddrBytes: number[],
  partyAddr: PublicKey, partyAddrBytes: number[],
  lut?: AddressLookupTableAccount
): Promise<string> {
  const signerAcc = await rpc.getCompressedAccount(bn(signerAddr.toBytes()));
  const agreementAcc = await rpc.getCompressedAccount(bn(agreementAddr.toBytes()));
  const partyAcc = await rpc.getCompressedAccount(bn(partyAddr.toBytes()));
  if (!signerAcc || !agreementAcc || !partyAcc) throw new Error("Account not found");

  const proofResult = await rpc.getValidityProofV0(
    [
      { hash: signerAcc.hash, tree: signerAcc.treeInfo.tree, queue: signerAcc.treeInfo.queue },
      { hash: agreementAcc.hash, tree: agreementAcc.treeInfo.tree, queue: agreementAcc.treeInfo.queue },
      { hash: partyAcc.hash, tree: partyAcc.treeInfo.tree, queue: partyAcc.treeInfo.queue },
    ],
    []
  );

  const remainingAccounts = buildSystemRemainingAccounts();
  const sm = packAccountMeta(signerAcc, signerAddrBytes, proofResult, 0, remainingAccounts);
  const am = packAccountMeta(agreementAcc, agreementAddrBytes, proofResult, 1, remainingAccounts);
  const pm = packAccountMeta(partyAcc, partyAddrBytes, proofResult, 2, remainingAccounts);

  const data = encodeInstruction("sign_agreement", {
    proof: packProof(proofResult),
    signerIdentityMeta: sm,
    signerIdentity: deserializeAgentIdentity(signerAcc.data),
    agreementMeta: am,
    currentAgreement: deserializeAgreement(agreementAcc.data),
    partyMeta: pm,
    currentParty: deserializeAgreementParty(partyAcc.data),
  });

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: signerAgent.publicKey, isSigner: true, isWritable: true },
      ...toAccountMetas(remainingAccounts),
    ],
    data,
  });

  return sendTx(connection, [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), ix],
    [payer, signerAgent], lut);
}

// ── Run ─────────────────────────────────────────────────────────────────────
main()
  .then(() => { console.log("\n✅ Demo complete!"); process.exit(0); })
  .catch((err) => { console.error("\n❌ Error:", err); process.exit(1); });
