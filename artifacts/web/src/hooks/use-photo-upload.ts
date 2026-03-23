import { useState } from "react";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function getObjectUrl(objectPath: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/storage${objectPath}`;
}

export function usePhotoUpload() {
  const [isUploading, setIsUploading] = useState(false);

  async function uploadPhoto(file: File): Promise<string> {
    if (file.size > MAX_SIZE) {
      throw new Error("File too large (max 5MB)");
    }
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }

    setIsUploading(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

      // Step 1: Request presigned URL
      const urlRes = await fetch(`${base}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: Upload directly to GCS
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Failed to upload file");

      return objectPath as string;
    } finally {
      setIsUploading(false);
    }
  }

  return { uploadPhoto, isUploading };
}
