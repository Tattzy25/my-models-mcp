import express from "express";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
// Import Express types correctly
import type { Request, Response } from "express";

// Enable debug logging to see what's happening
process.env.DEBUG = "mcp:*";

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "Echo",
  version: "1.0.0",
});

// Register our capabilities
server.resource(
  "echo",
  new ResourceTemplate("echo://{message}", { list: undefined }),
  async (uri, { message }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Resource echo: ${message}`,
      },
    ],
  }),
);

server.tool("echo", { message: z.string() }, async ({ message }) => ({
  content: [{ type: "text", text: `Tool echo: ${message}` }],
}));

server.prompt("echo", { message: z.string() }, ({ message }) => ({
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please process this message: ${message}`,
      },
    },
  ],
}));

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    // Log incoming request for debugging
    console.log("Received request:", JSON.stringify(req.body, null, 2));

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      console.log("Request closed");
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  console.log("Received GET MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Method not allowed. Use POST to interact with the MCP server. Follow README for details.",
      },
      id: null,
    }),
  );
});

app.delete("/mcp", async (req: Request, res: Response) => {
  console.log("Received DELETE MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Method not allowed. Use POST to interact with the MCP server. Follow README for details.",
      },
      id: null,
    }),
  );
});

// Start the server
const PORT = process.env.PORT || process.env.MCP_SERVER_PORT || 4000;
app.listen(PORT, () => {
  console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
});

// Base URL for the storagecloud API
const API_URL =
  process.env.MCP_API_URL || "http://my-models-mcp-production.up.railway.app/mcp";

// Helper function for making storagecloud API requests
async function makeStorageCloudRequest<T>(
  url: string,
  method: string,
  body?: any,
): Promise<T | null> {
  const headers = {
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making storagecloud request:", error);
    return null;
  }
}

// Interfaces for request and response types
interface UploadZippedFolderResponse {
  message: string;
  url: string;
}

interface ReturnProcessedDataResponse {
  message: string;
}

interface Bucket {
  name: string;
  createdAt: string;
}

interface ListBucketsResponse {
  buckets: Bucket[];
}

interface NotificationConfig {
  // Define the structure of the notification configuration
}

interface PutBucketNotificationResponse {
  message: string;
}

interface MultipartUploadResponse {
  uploadId: string;
}

interface ListMultipartUploadsResponse {
  uploads: MultipartUploadResponse[];
}

interface ObjectResponse {
  key: string;
  url: string;
}

interface ListObjectsResponse {
  objects: ObjectResponse[];
}

// Register tools with MCP server

// @ts-ignore
server.tool(
  "upload-zipped-folder",
  "Upload a zipped folder to Tigris cloud storage",
  {
    folder: z.string().describe("Path to the zipped folder to upload"),
  },
  async ({ folder }) => {
    const uploadUrl = `${API_URL}/upload`;
    const response = await makeStorageCloudRequest<UploadZippedFolderResponse>(
      uploadUrl,
      "POST",
      { folder },
    );

    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to upload zipped folder",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully uploaded zipped folder. URL: ${response.url}`,
        },
      ],
    };
  },
);

// @ts-ignore
server.tool(
  "return-processed-data",
  "Upload processed data back to Tigris cloud storage after workflow completion",
  {
    data: z
      .object({
        uploadId: z.string(),
        data: z.any(),
      })
      .describe("Upload ID and processed data"),
  },
  async ({ data }) => {
    const returnUrl = `${API_URL}/upload/return`;
    const response = await makeStorageCloudRequest<ReturnProcessedDataResponse>(
      returnUrl,
      "PUT",
      data,
    );

    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to return processed data",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: response.message,
        },
      ],
    };
  },
);

// @ts-ignore
server.tool("list-buckets", "List all buckets", {}, async () => {
  const bucketsUrl = `${API_URL}/buckets`;
  const response = await makeStorageCloudRequest<ListBucketsResponse>(
    bucketsUrl,
    "GET",
  );

  if (!response) {
    return {
      content: [
        {
          type: "text",
          text: "Failed to retrieve buckets",
        },
      ],
    };
  }

  const bucketNames =
    response.buckets.map((bucket) => bucket.name).join(", ") ||
    "No buckets found.";
  return {
    content: [
      {
        type: "text",
        text: `Buckets: ${bucketNames}`,
      },
    ],
  };
});

// @ts-ignore
server.tool(
  "put-bucket-notification",
  "Set bucket notification configuration",
  {
    bucketName: z.string(),
    config: z
      .object({
        // Define the structure of the notification configuration
      })
      .describe("Notification configuration"),
  },
  async ({ bucketName, config }) => {
    const notificationUrl = `${API_URL}/buckets/${bucketName}/notification`;
    const response =
      await makeStorageCloudRequest<PutBucketNotificationResponse>(
        notificationUrl,
        "PUT",
        config,
      );

    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to set bucket notification",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: response.message,
        },
      ],
    };
  },
);

// @ts-ignore
server.tool(
  "list-multipart-uploads",
  "List ongoing multipart uploads",
  {},
  async () => {
    const multipartUploadsUrl = `${API_URL}/multipart-uploads`;
    const response =
      await makeStorageCloudRequest<ListMultipartUploadsResponse>(
        multipartUploadsUrl,
        "GET",
      );

    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve multipart uploads",
          },
        ],
      };
    }

    const uploadIds =
      response.uploads.map((upload) => upload.uploadId).join(", ") ||
      "No ongoing uploads.";
    return {
      content: [
        {
          type: "text",
          text: `Ongoing multipart uploads: ${uploadIds}`,
        },
      ],
    };
  },
);

// @ts-ignore
server.tool(
  "list-objects",
  "List objects in a bucket",
  {
    bucketName: z.string(),
  },
  async ({ bucketName }) => {
    const objectsUrl = `${API_URL}/objects/list?bucket=${bucketName}`;
    const response = await makeStorageCloudRequest<ListObjectsResponse>(
      objectsUrl,
      "GET",
    );

    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve objects",
          },
        ],
      };
    }

    const objectKeys =
      response.objects.map((object) => object.key).join(", ") ||
      "No objects found.";
    return {
      content: [
        {
          type: "text",
          text: `Objects in bucket ${bucketName}: ${objectKeys}`,
        },
      ],
    };
  },
);

// Additional methods can be registered similarly...
