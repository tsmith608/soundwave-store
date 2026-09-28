import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { validateAudioUpload } from "@/lib/audio";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photoEntry = formData.get("photo") || formData.get("image") || formData.get("photoFile");
    const audioEntry = formData.get("audio");
    const genericEntry = formData.get("file");

    const targetEntry = photoEntry || audioEntry || genericEntry;

    if (!targetEntry || !(targetEntry instanceof Blob)) {
      return NextResponse.json(
        {
          success: false,
          error: "No file provided. Please submit an audio or photo file under 'audio', 'photo', or 'file' field.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await targetEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = targetEntry instanceof File ? targetEntry.name : undefined;
    const mimeType = targetEntry.type;

    // Check if uploaded file is an image
    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;

    const isImageExplicit =
      Boolean(photoEntry) ||
      (mimeType && mimeType.startsWith("image/")) ||
      (originalName && /\.(jpe?g|png)$/i.test(originalName));

    if (isJpeg || isPng || isImageExplicit) {
      // Validate image format
      if (!isJpeg && !isPng) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid image format. Only JPEG (.jpg, .jpeg) and PNG (.png) files are supported.",
          },
          { status: 400 }
        );
      }

      // Max image size: 25MB
      if (buffer.length > 25 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: "Image file size exceeds maximum limit of 25MB." },
          { status: 400 }
        );
      }

      const photoId = `img_${uuidv4().replace(/-/g, "").substring(0, 16)}`;
      const extension = isJpeg ? ".jpg" : ".png";
      const filename = `${photoId}${extension}`;

      const uploadsDir = path.resolve(process.cwd(), "storage", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const fullFilePath = path.join(uploadsDir, filename);
      await fs.writeFile(fullFilePath, buffer);

      const relativePhotoPath = `storage/uploads/${filename}`;

      return NextResponse.json({
        success: true,
        photoId,
        photoPath: relativePhotoPath,
        imageId: photoId,
        imagePath: relativePhotoPath,
        format: isJpeg ? "jpeg" : "png",
        sizeBytes: buffer.length,
        originalFilename: originalName || filename,
      });
    }

    // Process as audio upload
    const validation = validateAudioUpload(buffer, originalName, mimeType);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || "Invalid audio file" },
        { status: 400 }
      );
    }

    const audioId = `aud_${uuidv4().replace(/-/g, "").substring(0, 16)}`;
    const extension = validation.extension || ".wav";
    const filename = `${audioId}${extension}`;

    // Target upload directory: storage/uploads
    const uploadsDir = path.resolve(process.cwd(), "storage", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const fullFilePath = path.join(uploadsDir, filename);
    await fs.writeFile(fullFilePath, buffer);

    const relativeAudioPath = `storage/uploads/${filename}`;
    const duration = validation.durationSeconds ?? 0;

    return NextResponse.json({
      success: true,
      audioId,
      audioPath: relativeAudioPath,
      duration,
      durationSeconds: duration,
      format: validation.format,
      sizeBytes: buffer.length,
    });
  } catch (error: any) {
    console.error("Upload processing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process upload" },
      { status: 500 }
    );
  }
}
