// Maps raw Anchor/Solana errors to user-friendly messages
export function formatError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  // Account not found errors
  if (msg.includes('Account not found') || msg.includes('AccountNotFound')) {
    return 'This account does not exist on the current network. Make sure you are connected to the correct network (Devnet).';
  }

  // Program not found
  if (msg.includes('Program') && msg.includes('not found')) {
    return 'The AAP program is not deployed on this network yet. Please switch to Devnet.';
  }

  // Insufficient funds
  if (msg.includes('insufficient') || msg.includes('Insufficient')) {
    return 'Not enough SOL for transaction fees. You need at least 0.01 SOL.';
  }

  // User rejected
  if (msg.includes('User rejected') || msg.includes('rejected the request')) {
    return 'Transaction was cancelled.';
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('blockhash')) {
    return 'Network request timed out. Please try again.';
  }

  // Anchor program errors (6000+)
  if (msg.includes('6000')) return 'Agent key must be different from the authority wallet.';
  if (msg.includes('6001')) return 'Delegation scope has already expired. Choose a future expiry date.';
  if (msg.includes('6002')) return 'Unauthorized: you are not the authority for this agent.';
  if (msg.includes('6003')) return 'Agent delegation has expired. Update the delegation scope.';
  if (msg.includes('6004')) return 'This agent does not have permission to sign agreements.';
  if (msg.includes('6005')) return 'This agent does not have permission to commit funds.';
  if (msg.includes('6006')) return 'Escrow amount exceeds the agent\'s maximum commit limit.';
  if (msg.includes('6009')) return 'Invalid agreement type specified.';
  if (msg.includes('6012')) return 'Number of parties must be between 2 and 8.';
  if (msg.includes('6013')) return 'Agreement is not in the expected status for this action.';
  if (msg.includes('6014')) return 'Agreement has expired.';
  if (msg.includes('6015')) return 'This party has already signed the agreement.';

  // Network errors
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Network error. Check your internet connection and try again.';
  }

  // Fallback - clean up the raw message
  return msg.length > 200 ? msg.slice(0, 200) + '...' : msg;
}
