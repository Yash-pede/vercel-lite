"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github } from "lucide-react";
import { Fira_Code } from "next/font/google";
import axios from "axios";
import { generateSlug } from "random-word-slugs";
import dayjs from "dayjs";

const socket = io("http://localhost:9000");
const firaCode = Fira_Code({ subsets: ["latin"] });

type LogItem = {
  log: string;
  timestamp?: string;
};

export default function Home() {
  const [repoURL, setURL] = useState("");
  const [outputDir, setOutputDir] = useState("dist");
  const [buildCommand, setbuildCommand] = useState("build");
  const [projectId, setProjectId] = useState<string | undefined>(generateSlug(2));
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deployPreviewURL, setDeployPreviewURL] = useState<string | undefined>(undefined);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Validate GitHub URL
  const isValidURL: [boolean, string | null] = useMemo(() => {
    const regex =
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/;
    if (!repoURL || repoURL.trim() === "") return [false, null];
    return [regex.test(repoURL), "Enter valid Github Repository URL"];
  }, [repoURL]);

  const handleClickDeploy = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`http://localhost:4000/api/project`, {
        repoUrl: repoURL,
        outputDir,
        buildCommand,
        projectName: projectId,
      });

      if (data && data.data) {
        const { projectName, url } = data.data;
        setDeployPreviewURL(url);
        socket.emit("subscribe", `logs:${projectName}`);
      }
    } catch (e) {
      setLogs((prev) => [
        ...prev,
        { log: "Failed to deploy. Please try again.", timestamp: dayjs().toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  }, [repoURL, outputDir, buildCommand, projectId]);

  // ---- Store logs as objects for easier formatting ----
  const handleSocketIncommingMessage = useCallback((message: string) => {
    try {
      const data = JSON.parse(message);
      setLogs((prev) => [
        ...prev,
        (typeof data === "object" && (data.log || data.message))
          ? {
              log: data.log ?? data.message ?? "",
              timestamp: data.timestamp, // Need to be string or undefined
            }
          : { log: message, timestamp: undefined }
      ]);
    } catch {
      setLogs((prev) => [...prev, { log: message, timestamp: undefined }]);
    }
  }, []);

  useEffect(() => {
    socket.on("message", handleSocketIncommingMessage);
    return () => {
      socket.off("message", handleSocketIncommingMessage);
    };
  }, [handleSocketIncommingMessage]);

  // Auto-scroll to latest log
  useEffect(() => {
    if (!logContainerRef.current) return;
    logContainerRef.current.scrollTo({
      top: logContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [logs.length]);

  return (
    <main className="flex justify-center items-center min-h-screen bg-[#111112]">
      <div className="w-full max-w-5xl">
        <span className="flex justify-start items-center gap-2 mb-6">
          <Github className="text-5xl" />
          <Input
            disabled={loading}
            value={repoURL}
            onChange={(e) => setURL(e.target.value)}
            type="url"
            placeholder="GitHub Repository URL"
          />
        </span>
        {/* Output Directory */}
        <div className="mt-3">
          <label className="block mb-1 text-gray-300 font-medium">Output Directory</label>
          <Input
            disabled={loading}
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            placeholder="dist"
          />
        </div>
        {/* Build Command */}
        <div className="mt-3">
          <label className="block mb-1 text-gray-300 font-medium">Build Command</label>
          <div className="flex">
            <Input disabled value="npm run" className="w-28 mr-2" />
            <Input
              disabled={loading}
              value={buildCommand}
              onChange={(e) => setbuildCommand(e.target.value)}
              placeholder="build"
              className="flex-1"
            />
          </div>
        </div>
        {/* Project ID */}
        <div className="mt-3">
          <label className="block mb-1 text-gray-300 font-medium">Project ID (slug)</label>
          <Input
            disabled={loading}
            value={projectId ?? ""}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Auto-generated or custom"
          />
        </div>
        {/* Deploy Button */}
        <Button
          onClick={handleClickDeploy}
          disabled={!isValidURL[0] || loading}
          className="w-full mt-4 text-lg py-6 font-bold tracking-wider"
        >
          {loading ? "In Progress" : "🚀 Deploy"}
        </Button>

        {/* Preview URL */}
        {deployPreviewURL && (
          <div className="mt-4 bg-[#191924] py-4 px-4 rounded-lg border border-blue-700/40 shadow transition">
            <p className="text-sky-300 font-mono">
              Preview URL{" "}
              <a
                target="_blank"
                className="ml-2 text-sky-100 hover:text-sky-400 transition-all underline"
                href={deployPreviewURL}
                rel="noopener noreferrer"
              >
                {deployPreviewURL}
              </a>
            </p>
          </div>
        )}

        {/* LOGS BOX — IMPROVED AND MODERN */}
        {logs.length > 0 && (
          <div
            ref={logContainerRef as React.RefObject<HTMLDivElement>}
            className={`
              ${firaCode.className}
              text-[19px] leading-tight
              bg-[#101113]
              border border-[#212226]
              rounded-[30px]
              mt-10
              mb-10
              p-8
              shadow-2xl
              h-[620px]
              overflow-y-auto
              log-viewer
              transition-all
              max-w-full
              outline-none
            `}
            style={{ fontVariantLigatures: "none", fontFeatureSettings: "'liga' 0" }}
            tabIndex={-1}
          >
            <div className="flex flex-col gap-0.5">
              {logs.map((entry, i) => {
                const log = entry.log ?? "";
                const timestamp = entry.timestamp;
                // Dayjs format
                const timeStr = timestamp
                  ? dayjs(timestamp).format("HH:mm:ss")
                  : "";

                // Zebra striping
                const bg =
                  i % 2 === 0
                    ? "bg-[#181a20]" // lighter
                    : "bg-[#141517]"; // dark

                // Left border and optional status icon
                let border = "";
                let icon = null;
                if (/❌|error|fail/i.test(log)) {
                  border = "border-l-[5px] border-red-500";
                  icon = <span className="mr-2">❌</span>;
                } else if (/✅|success/i.test(log)) {
                  border = "border-l-[5px] border-green-400";
                  icon = <span className="mr-2">✅</span>;
                } else if (/warn/i.test(log)) {
                  border = "border-l-[5px] border-yellow-400";
                  icon = <span className="mr-2">⚠️</span>;
                } else if (/upload|clone|build|starting/i.test(log)) {
                  icon = <span className="mr-2 text-blue-400">●</span>;
                  // border = "border-l-[5px] border-blue-400";
                } else {
                  icon = <span className="mr-2 text-gray-600">•</span>;
                }

                // Text color
                let color = "text-gray-100";
                if (/❌|error|fail/i.test(log)) color = "text-red-400";
                else if (/✅|success/i.test(log)) color = "text-green-400";
                else if (/warn/i.test(log)) color = "text-yellow-200";

                return (
                  <div
                    key={i}
                    className={`flex gap-4 px-4 py-3 items-center ${bg} ${border} min-h-[40px] rounded-xl`}
                    style={{
                      fontFamily: firaCode.className,
                      marginBottom: 2,
                      alignItems: "center",
                      fontWeight: 500,
                      fontSmooth: "always",
                      WebkitFontSmoothing: "antialiased",
                    }}
                  >
                    {/* Timestamp */}
                    <span
                      className="min-w-[75px] text-base font-mono text-gray-400 select-none"
                      style={{ fontFamily: "monospace" }}
                    >
                      {timeStr}
                    </span>
                    {/* Icon */}
                    {icon}
                    {/* Log message */}
                    <span
                      className={`flex-1 break-words ${color} leading-snug`}
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontFamily: "inherit",
                        fontWeight: 500
                      }}
                    >
                      {log}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
