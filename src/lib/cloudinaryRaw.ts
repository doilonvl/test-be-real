import cloudinary from "../config/cloudinary";

export async function uploadPdfBufferToCloudinary(buf: Buffer, filename?: string) {
  if (!cloudinary.config().cloud_name) {
    throw new Error("Cloudinary is not configured");
  }
  const folder = process.env.CLOUDINARY_FOLDER_CATALOGS || "hasake/catalogs";

  return new Promise<{
    url: string; public_id: string; bytes: number; resource_type: string; format: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "raw",     // quan trọng để upload PDF
        filename_override: filename,
        use_filename: true,
        overwrite: true,
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error("Upload failed"));
        resolve({
          url: result.secure_url!,
          public_id: result.public_id!,
          bytes: result.bytes!,
          resource_type: result.resource_type!,
          format: result.format!,
        });
      }
    );
    stream.end(buf);
  });
}

export async function destroyCloudinaryRaw(publicId: string) {
  if (!cloudinary.config().cloud_name) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
}
