export const AGREEMENT_TEMPLATES = [
  {
    name: "Non-Disclosure Agreement (NDA)",
    type: 4, // Custom
    terms: `NON-DISCLOSURE AGREEMENT

The parties agree to the following terms:

1. CONFIDENTIAL INFORMATION: All non-public information shared between the parties shall be considered confidential.

2. OBLIGATIONS: The receiving party shall:
   a) Keep all confidential information strictly confidential
   b) Not disclose to any third party without prior written consent
   c) Use the information only for the agreed purpose

3. DURATION: This agreement remains in effect for the specified term.

4. REMEDIES: Any breach may result in agreement termination and on-chain dispute record.

5. GOVERNING: This agreement is recorded on-chain and verified by cryptographic signatures.`,
    expiresInDays: "365",
    visibility: 1, // Private
  },
  {
    name: "Service Agreement",
    type: 1, // Service
    terms: `SERVICE AGREEMENT

The parties agree to the following terms:

1. SCOPE: The service provider agrees to deliver the services as described.

2. COMPENSATION: Payment terms as agreed between parties.

3. TIMELINE: Services shall be completed within the agreed timeframe.

4. QUALITY: All deliverables shall meet reasonable professional standards.

5. TERMINATION: Either party may cancel with notice. Partial payment for completed work.

6. VERIFICATION: Completion is verified on-chain when both parties mark as fulfilled.`,
    expiresInDays: "90",
    visibility: 0, // Public
  },
  {
    name: "Revenue Share Agreement",
    type: 2, // Revenue Share
    terms: `REVENUE SHARE AGREEMENT

The parties agree to the following terms:

1. REVENUE SPLIT: Parties agree to share revenue as specified.

2. REPORTING: Revenue shall be reported transparently and verifiably.

3. PAYMENT: Distributions occur on the agreed schedule.

4. AUDIT: Either party may request verification of revenue figures.

5. DURATION: This agreement remains active until fulfilled or terminated.

6. ON-CHAIN: All commitments are recorded and verifiable on Solana.`,
    expiresInDays: "180",
    visibility: 0,
  },
  {
    name: "Joint Venture Agreement",
    type: 3, // Joint Venture
    terms: `JOINT VENTURE AGREEMENT

The parties agree to the following terms:

1. PURPOSE: The parties agree to collaborate on the described venture.

2. CONTRIBUTIONS: Each party contributes resources as agreed.

3. PROFITS & LOSSES: Shared proportionally per agreement terms.

4. MANAGEMENT: Decisions require consensus of all parties.

5. DURATION: Until venture completion or mutual termination.

6. EXIT: Any party may exit with notice; remaining parties may continue.`,
    expiresInDays: "365",
    visibility: 0,
  },
  {
    name: "Freelance Contract",
    type: 1, // Service
    terms: `FREELANCE CONTRACT

The parties agree to the following terms:

1. DELIVERABLES: The freelancer agrees to deliver the specified work.

2. PAYMENT: Client pays upon satisfactory completion and mutual fulfillment.

3. REVISIONS: Up to 2 rounds of revisions included.

4. OWNERSHIP: All work product transfers to client upon fulfillment.

5. CONFIDENTIALITY: Work details remain confidential unless agreed otherwise.

6. DEADLINE: Work must be completed within the specified timeframe.`,
    expiresInDays: "30",
    visibility: 1,
  },
];
