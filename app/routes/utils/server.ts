import {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
// import multer from "multer";
// import multerS3 from "multer-s3";
import forge from "../../../forge/client";

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("AWS credentials not found");
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToS3(file: File, key: string) {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `food/${key}`, // Add the folder name here
      Body: file,
      ContentType: file.type,
      ACL: "public-read", // This line makes the object public
    },
  });

  try {
    const result = await upload.done();
    return result.Location;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
}

export function getImageUrl(key: string) {
  const imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  if (!imageUrl) {
    throw new Error("Image URL not found");
  }
  return imageUrl;
}

export async function getRecipe(imageUrl: string) {
  try {
    const response = await forge.recipe.queryImage(
      {
        prompt: "Describe the recipe of the image",
        imageUrl: imageUrl,
      },
      {
        cache: "Bust",
      }
    );
    return response;
  } catch (error) {
    console.error("Error querying Forge:", error);
    throw new Error("Error processing the image");
  }
}

export async function getImageMetadata(key: string) {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      eTag: response.ETag,
    };
  } catch (error) {
    console.error("Error retrieving image metadata:", error);
    throw new Error("Error retrieving image metadata");
  }
}

export async function getAllImageUrls() {
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_S3_BUCKET,
  });

  try {
    const data = await s3Client.send(command);
    const imageUrls = data.Contents?.filter((item) => {
      if (!item.Key?.startsWith("food/") || item.Key?.endsWith("/"))
        return false;
      const imageExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
      ];
      return imageExtensions.some((ext) =>
        item.Key?.toLowerCase().endsWith(ext)
      );
    }).map(
      (item) =>
        `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`
    );

    return imageUrls || [];
  } catch (error) {
    console.error("Error listing objects:", error);
    throw error;
  }
}
