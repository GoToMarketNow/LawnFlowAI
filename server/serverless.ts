import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";

// Import only what we need for serverless
const app = express();

const MemoryStoreSession = MemoryStore(session);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "lawnflow-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStoreSession({
      checkPeriod: 86400000,
    }),
    cookie: {
      secure: true, // Always true in production/Vercel
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from dist/public
import { serveStatic } from "./static";
try {
  serveStatic(app);
} catch (error) {
  console.error('Failed to setup static serving:', error);
  // Fallback - just return a basic response
  app.get('*', (req, res) => {
    res.send('<h1>LawnFlow AI</h1><p>Static assets not available in serverless mode.</p>');
  });
}

// Export for Vercel
export default app;
