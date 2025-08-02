const express = require("express");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { Server } = require("socket.io");
const Redis = require("ioredis");
const cors = require("cors");
require("dotenv").config();


const app = express();
const PORT = 4000;
app.use(cors());

const subscriber = new Redis(
  ""
);

const io = new Server({ cors: "*" });

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});
io.listen(9000, () => console.log("Socket Server 9000"));

app.use(express.json());
const ecsClient = new ECSClient({ region: "ap-south-1" });

const config = {
  cluster: "build-server-cluster",
  task: "build-server-task",
  s3bucket: process.env.S3_BUCKET_NAME || "vercel-lite",
};

app.post("/api/project", async (req, res) => {
  const { repoUrl, outputDir, buildCommand, projectName } = req.body;
  if (!repoUrl || !outputDir || !buildCommand || !projectName) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  console.log("Received request to start build for project:", projectName);
  try {
    const command = new RunTaskCommand({
      cluster: config.cluster,
      taskDefinition: config.task,
      overrides: {
        containerOverrides: [
          {
            name: "build-server-container",
            environment: [
              { name: "GIT_REPOSITORY__URL", value: repoUrl },
              { name: "GITHUB_OUTPUT_DIR", value: outputDir },
              { name: "GITHUB_BUILD_COMMAND", value: buildCommand },
              { name: "S3_BUCKET_NAME", value: config.s3bucket },
              { name: "PROJECT_ID", value: projectName },
            ],
          },
        ],
      },
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: process.env.AWS_SUBNETS.split(","),
          securityGroups: process.env.AWS_SECURITY_GROUPS.split(","),
          assignPublicIp: "ENABLED",
        },
      },
    });
    const response = await ecsClient.send(command);
    console.log("Build started successfully:", response);
    return res.json({
      status: "queued",
      data: { projectName, url: `http://${projectName}.localhost:8000` },
    });
  } catch (error) {
    console.error("Error starting build:", error);
    res.status(500).json({ error: "Failed to start build" });
  }
});

async function initRedisSubscribe() {
  console.log("Subscribed to logs....");
  subscriber.psubscribe("logs:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    io.to(channel).emit("message", message);
  });
}

initRedisSubscribe();

app.listen(PORT, () => {
  console.log(`API service running on http://localhost:${PORT}`);
});
