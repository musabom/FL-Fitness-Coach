import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Local disk upload dir — used when Replit Object Storage is not available
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "local_uploads");
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOCAL_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({ storage: multerStorage, limits: { fileSize: 2 * 1024 * 1024 } });

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number(),
  contentType: z.string(),
});

/** POST /storage/uploads/request-url — request a presigned upload URL */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    console.error("Error generating upload URL", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/** GET /storage/public-objects/... — serve public assets unconditionally */
router.use("/storage/public-objects", async (req: Request, res: Response) => {
  const filePath = req.path.replace(/^\//, "");
  try {
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.from(response.body as unknown as AsyncIterable<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
    } else {
      console.error("Error serving public object", error);
      res.status(500).json({ error: "Failed to serve object" });
    }
  }
});

/** POST /storage/uploads/direct — multipart upload for local dev (no GCS required) */
router.post("/storage/uploads/direct", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }
  const objectPath = `/objects/local/${req.file.filename}`;
  res.json({ objectPath });
});

/** GET /storage/objects/local/... — serve local-disk uploads (must be before the GCS handler) */
router.use("/storage/objects/local", (req: Request, res: Response) => {
  const filename = path.basename(req.path);
  const filePath = path.join(LOCAL_UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

/** GET /storage/objects/... — serve uploaded object entities via GCS */
router.use("/storage/objects", async (req: Request, res: Response) => {
  const objectPath = `/objects${req.path}`;
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile, 3600);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.from(response.body as unknown as AsyncIterable<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
    } else {
      console.error("Error serving object", error);
      res.status(500).json({ error: "Failed to serve object" });
    }
  }
});

export default router;
