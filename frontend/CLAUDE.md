# CLAUDE.md — Coding Best Practices for AAP Frontend

## Stack
- Next.js 14+ (App Router)
- TypeScript (strict)
- Tailwind CSS
- @solana/wallet-adapter-react
- @coral-xyz/anchor

## React & Next.js Best Practices (from Vercel Engineering)

### CRITICAL: Eliminate Waterfalls
- Defer `await` until needed — don't block code paths that won't use the result
- Use `Promise.all()` for independent async operations
- Use Suspense boundaries to show layout immediately while data loads
- Start fetches early, await late

### CRITICAL: Bundle Size
- Avoid barrel file imports — import directly from source files
- Use `next/dynamic` for heavy components (ssr: false when appropriate)
- Defer non-critical libraries (analytics, tracking) with dynamic imports
- Use `optimizePackageImports` in next.config for known heavy packages

### HIGH: Server-Side Performance
- Authenticate Server Actions like API routes — they're public endpoints
- Minimize serialization at RSC boundaries — only pass fields the client uses
- Use parallel data fetching with component composition (separate async components)
- Use `React.cache()` for per-request deduplication
- Use `after()` for non-blocking operations (logging, analytics)

### MEDIUM-HIGH: Client-Side Data Fetching
- Use SWR for automatic deduplication and caching
- Use passive event listeners for scroll/touch (`{ passive: true }`)
- Cache localStorage/sessionStorage reads in memory

### MEDIUM: Re-render Optimization
- Calculate derived state during render — don't store computed values in state
- Use functional setState updates (`setItems(curr => [...curr, newItem])`)
- Use lazy state initialization (`useState(() => expensiveComputation())`)
- Use transitions for non-urgent updates (`startTransition`)
- Use `useRef` for transient values that don't need re-renders
- Narrow effect dependencies to primitives, not objects

### MEDIUM: Rendering Performance
- Use `content-visibility: auto` for long lists
- Use explicit conditional rendering (`condition ? <X/> : null` not `condition && <X/>`)
- Hoist static JSX elements outside components
- Use `useTransition` over manual loading states

### LOW-MEDIUM: JavaScript Performance
- Build index Maps for repeated lookups (not `.find()` in loops)
- Use Set/Map for O(1) lookups instead of Array.includes()
- Use `.toSorted()` instead of `.sort()` (immutability)
- Early return from functions when result is determined
- Combine multiple array iterations into single loops

## Project-Specific Rules

### Solana Integration
- All PDA derivation should use helper functions, not inline seeds
- Use Anchor's `program.account` for deserialization — don't manually parse
- Handle wallet disconnection gracefully in all views
- Show loading skeletons while fetching on-chain data
- Cache RPC responses with SWR (reasonable TTL for on-chain data)

### Design
- Dark theme, minimal, clean
- Mobile-responsive
- No charts or analytics — this is an oversight tool
- Emergency controls should be prominent, red/warning styled
- Public agent profiles should work without wallet connection

### Security
- Never expose private keys or authority secrets in the frontend
- All write operations require wallet signature
- Validate all user input before building transactions
