import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import type { UploadedFile as UploadedFileDTO } from "@im/shared";
import { JwtAuthGuard } from "../auth/jwt.guard";

// 20 MiB limit — large-file chunked upload will land in Phase 4.
const MAX_SIZE = 20 * 1024 * 1024;
const UPLOAD_ROOT = join(process.cwd(), "uploads");

if (!existsSync(UPLOAD_ROOT)) {
  mkdirSync(UPLOAD_ROOT, { recursive: true });
}

@UseGuards(JwtAuthGuard)
@Controller("upload")
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOAD_ROOT,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).slice(0, 12);
          const id = randomBytes(12).toString("hex");
          cb(null, `${id}${ext}`);
        },
      }),
      limits: { fileSize: MAX_SIZE },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): UploadedFileDTO {
    if (!file) throw new BadRequestException("no file");
    return {
      url: `/uploads/${file.filename}`,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    };
  }
}
