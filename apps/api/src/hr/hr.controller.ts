import type { Request, Response } from "express";

export function uploadDocument(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "NO_FILE_UPLOADED" });
  }
  return res.status(200).json({ ok: true, filename: req.file.originalname });
}
