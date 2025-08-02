import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import Redis from "ioredis";

const gitRepositoryUrl = process.env.GIT_REPOSITORY__URL;
const githubBuildCommand = process.env.GITHUB_BUILD_COMMAND || "build";
const githubOutputDir = process.env.GITHUB_OUTPUT_DIR || "dist";
const bucketName = process.env.S3_BUCKET_NAME;
const PROJECT_ID = process.env.PROJECT_ID;

const s3Client = new S3Client({
  region: "ap-south-1",
});

const publisher = new Redis('');
function publishLog(message) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({
    message,
    timestamp: new Date().toISOString(),
  }));
  console.log(message);
}

const init = async () => {
  if (!gitRepositoryUrl) {
    publishLog("❌ ERROR: GIT_REPOSITORY__URL environment variable is not set.");
    process.exit(1);
  }

  publishLog(`🚀 Starting build for project: ${PROJECT_ID}`);

  publishLog("📦 Installing npm dependencies...");
  await new Promise((resolve, reject) => {
    exec(`cd /app/repo && npm install`, (err, stdout, stderr) => {
      publishLog(stdout);
      if (err) {
        publishLog(`❌ Error installing dependencies: ${stderr || err.message}`);
        reject(err);
      } else {
        publishLog("✅ Dependencies installed");
        resolve();
      }
    });
  });

  publishLog(`⚒️ Running build: npm run ${githubBuildCommand}`);
  await new Promise((resolve, reject) => {
    exec(`cd /app/repo && npm run ${githubBuildCommand}`, (err, stdout, stderr) => {
      publishLog(stdout); // Publish all build output (optional, may be verbose)
      if (err) {
        publishLog(`❌ Build failed: ${stderr || err.message}`);
        reject(err);
      } else {
        publishLog("✅ Build completed successfully");
        resolve();
      }
    });
  });

  // 4. Upload to S3
  publishLog("☁️ Uploading build output to S3...");
  const success = await uploadToS3();
  if (success) {
    publishLog("✅ All files uploaded to S3. Deployment complete!");
  } else {
    publishLog("❌ Error uploading files to S3.");
  }

  publisher.quit();
};

async function uploadToS3() {
  const outputDir = path.join("/app/repo", githubOutputDir);
  if (!fs.existsSync(outputDir)) {
    publishLog(`❌ Output directory ${outputDir} does not exist.`);
    return false;
  }
  const files = fs.readdirSync(outputDir, { recursive: true });
  let success = true;
  for (const file of files) {
    const filePath = path.join(outputDir, file);
    if (fs.lstatSync(filePath).isDirectory()) continue;

    publishLog(`⤴️ Uploading file: ${file}`);
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `__outputs/${PROJECT_ID}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });
      await s3Client.send(command);
      publishLog(`✅ File uploaded: ${file}`);
    } catch (err) {
      publishLog(`❌ Error uploading file ${file}: ${err.message}`);
      success = false;
    }
  }
  return success;
}

init().catch((err) => {
  publishLog(`❌ Build process crashed: ${err.message}`);
});
