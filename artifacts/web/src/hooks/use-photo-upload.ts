import { useState } from "react";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

export function getObjectUrl(objectPath: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/storage${objectPath}`;
}

export function usePhotoUpload() {
  const [isUploading, setIsUploading] = useState(false);

  async function uploadPhoto(file: File): Promise<string> {
    if (file.size > MAX_SIZE) {
      throw new Error("File too large (max 8MB)");
    }
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }

    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    setIsUploading(true);

    try {
      // Try direct multipart upload first (works locally without GCS)
      const formData = new FormData();
      formData.append("file", file);

      const directRes = await fetch(`${base}/api/storage/uploads/direct`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (directRes.ok) {
        const { objectPath } = await directRes.json();
        return objectPath as string;
      }

      // Fallback: presigned URL flow (Replit / production with GCS)
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
