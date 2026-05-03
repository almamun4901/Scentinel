import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

interface Window {
  count: number;
  windowStart: number;
}

const windows = new Map<string, Window>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;

// Periodically purge old windows to avoid memory leak
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, win] of windows.entries()) {
    if (win.windowStart < cutoff) windows.delete(key);
  }
}, 5 * 60_000);

export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  const key = userId ?? req.ip ?? "unknown";

  const now = Date.now();
  const win = windows.get(key);

  if (!win || now - win.windowStart > WINDOW_MS) {
    windows.set(key, { count: 1, windowStart: now });
    next();
    return;
  }

  if (win.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - win.windowStart)) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "Rate limit exceeded. Please wait before making more AI requests.",
      retryAfter,
    });
    return;
  }

  win.count++;
  next();
}
