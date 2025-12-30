import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { PolicyService } from "./policy";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  // Auto-seed database with Green Ridge Lawn Care on startup
  try {
    const existingProfile = await storage.getBusinessProfile();
    if (!existingProfile) {
      log("Seeding database with Green Ridge Lawn Care...", "seed");
      const profile = await storage.createBusinessProfile({
        name: "Green Ridge Lawn Care",
        phone: "+14345551234",
        email: "info@greenridgelawncare.com",
        address: "123 Main St, Charlottesville, VA 22901",
        serviceArea: "Charlottesville + 20 miles",
        services: ["mowing", "cleanup", "mulch"],
        businessHours: "Mon-Fri 8AM-5PM",
        autoResponseEnabled: true,
      });

      await PolicyService.createDefaultPolicy(profile.id, "owner_operator");

      const policyProfile = await storage.getPolicyProfile(profile.id);
      if (policyProfile) {
        await storage.updatePolicyProfile(policyProfile.id, {
          serviceAreaZips: ["22901", "22902", "22903", "22904", "22905", "22906", "22908", "22909", "22911"],
          serviceAreaRadius: 20,
          pricingRules: {
            services: {
              mowing: { basePrice: 4500, unit: "visit" },
              cleanup: { minPrice: 25000, unit: "job" },
              mulch: { minPrice: 30000, unit: "job" },
            },
          },
        });
      }
      log("Seed data created successfully", "seed");
    }
  } catch (error) {
    log(`Failed to seed database: ${error}`, "seed");
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
