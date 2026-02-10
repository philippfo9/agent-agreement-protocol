import { initTRPC, TRPCError } from "@trpc/server";
import { verifyWalletSignature, buildAuthMessage } from "@/lib/auth";

export type Context = {
  wallet: string | null;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware that requires a verified wallet signature
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.wallet) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Wallet signature required",
    });
  }
  return next({ ctx: { wallet: ctx.wallet } });
});

export const authedProcedure = t.procedure.use(isAuthed);

// Create context from request headers
export function createContext(headers: Headers): Context {
  const wallet = headers.get("x-wallet");
  const signature = headers.get("x-signature");
  const timestamp = headers.get("x-timestamp");

  if (!wallet || !signature || !timestamp) {
    return { wallet: null };
  }

  const ts = parseInt(timestamp, 10);
  const now = Date.now();
  if (Math.abs(now - ts) > 5 * 60 * 1000) {
    return { wallet: null };
  }

  const message = buildAuthMessage(wallet, ts);
  if (!verifyWalletSignature(wallet, message, signature)) {
    return { wallet: null };
  }

  return { wallet };
}
