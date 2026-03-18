import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import FileStore from "session-file-store";
import router from "./routes";
import path from "path";

const app: Express = express();

const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : undefined;

app.use(
  cors({
    credentials: true,
    origin: allowedOrigins ?? true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && !sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required in production");
}

const FileStoreSession = FileStore(session);
const sessionStore = new FileStoreSession({
  dir: path.join(process.cwd(), ".sessions"),
  ttl: 7 * 24 * 60 * 60,
});

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret || "dev-only-session-secret-not-for-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

app.use("/api", router);

export default app;
