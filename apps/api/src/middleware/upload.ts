import { win32 } from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { AppError } from "../utils/AppError.js";

export const MAX_UPLOAD_BYTES = 256 * 1024;
export const MAX_LINES = 5000;
const ALLOWED_EXTENSIONS = [".py", ".java"];

export type SourceUpload = {
  content: Buffer;
  originalName: string;
  extension: string;
  sizeBytes: number;
  lineCount: number;
};

declare global {
  namespace Express {
    interface Request {
      upload?: SourceUpload;
    }
  }
}

// memory storage: the file becomes a Buffer and never touches the server's disk
const parser = multer({
  storage: multer.memoryStorage(),
  // read filenames as UTF-8, so a name like "जोड़.py" isn't garbled
  defParamCharset: "utf8",
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, fieldSize: 10 * 1024 },
}).single("file");

function toAppError(err: unknown) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return AppError.payloadTooLarge(`Files can be at most ${MAX_UPLOAD_BYTES / 1024} KB`);
    }
    // wrong field name, a second file, too many fields
    return AppError.badRequest("Send exactly one file, in a form field named 'file'");
  }
  // anything else from the parser means the multipart body itself was broken
  return AppError.badRequest("The upload could not be read");
}

function countLines(text: string) {
  if (text.length === 0) return 0;
  const breaks = text.match(/\r\n|\r|\n/g)?.length ?? 0;
  // a last line without a trailing newline still counts
  return /[\r\n]$/.test(text) ? breaks : breaks + 1;
}

function checkSourceFile(file: Express.Multer.File | undefined): SourceUpload {
  if (!file) throw AppError.badRequest("Attach your code as a file in a form field named 'file'");

  // some clients send a full path like C:\Users\sam\sort.py; keep only the name
  const originalName = win32.basename(file.originalname).slice(0, 255);
  const extension = win32.extname(originalName).toLowerCase();

  // the browser's MIME type is ignored: the client decides it, so it proves nothing
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw AppError.unsupportedMediaType("Only .py and .java files are accepted");
  }

  const content = file.buffer;
  if (content.length === 0) throw AppError.badRequest("The file is empty");

  // source code never contains a NUL byte; binaries almost always do
  if (content.includes(0)) {
    throw AppError.unsupportedMediaType("This looks like a binary file, not source code");
  }

  let text: string;
  try {
    // fatal: true makes invalid UTF-8 throw instead of being replaced silently
    text = new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw AppError.unsupportedMediaType("The file must be saved as UTF-8 text");
  }

  const lineCount = countLines(text);
  if (lineCount > MAX_LINES) {
    throw AppError.badRequest(`Files can have at most ${MAX_LINES} lines`);
  }

  return { content, originalName, extension, sizeBytes: content.length, lineCount };
}

export function uploadSourceFile(req: Request, res: Response, next: NextFunction) {
  parser(req, res, (err: unknown) => {
    if (err) return next(toAppError(err));
    try {
      req.upload = checkSourceFile(req.file);
      next();
    } catch (e) {
      next(e);
    }
  });
}
