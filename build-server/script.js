import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";

const gitRepositoryUrl = process.env.GIT_REPOSITORY__URL;
const githubBuildCommand = process.env.GITHUB_BUILD_COMMAND || "build";
const githubOutputDir = process.env.GITHUB_OUTPUT_DIR || "dist";
const bucketName = process.env.S3_BUCKET_NAME;
const PROJECT_ID = process.env.PROJECT_ID;

const s3Client = new S3Client({
  region: "ap-south-1",
});

const init = async () => {
  if (!gitRepositoryUrl) {
    console.error("GIT_REPOSITORY__URL environment variable is not set.");
    process.exit(1);
  }

  const p = exec(
    `cd /app/repo && npm install && npm run ${githubBuildCommand}`
  );
  p.stdout.on("data", (data) => {
    console.log(`stdout: ${data}`);
  });

  p.stderr.on("data", (data) => {
    console.error(`stderr: ${data}`);
  });

  p.on("close", (code) => {
    if (code !== 0) {
      console.error(`Process exited with code ${code}`);
      return;
    }
    console.log("Build completed successfully.");
    uploadToS3();
    console.log("Done uploading to S3.");
  });
};

async function uploadToS3() {
  const outputDir = path.join("/app/repo", githubOutputDir);
  if (!fs.existsSync(outputDir)) {
    console.error(`Output directory ${outputDir} does not exist.`);
    return;
  }

  const files = fs.readdirSync(outputDir, { recursive: true });
  for (const file of files) {
    const filePath = path.join(outputDir, file);
    if (fs.lstatSync(filePath).isDirectory()) continue;

    console.log(`Uploading file: ${filePath}`);

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `__outputs/${PROJECT_ID}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });
      await s3Client.send(command);
      console.log(`File uploaded successfully: ${file}`);
    } catch (err) {
      console.error(`Error uploading file ${file}: ${err.message}`);
    }
  }
}

init();
