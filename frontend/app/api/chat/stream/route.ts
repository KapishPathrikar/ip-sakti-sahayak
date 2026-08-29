import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Default to the backend running locally on port 8000
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch(`${backendUrl}/api/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Pass the ReadableStream directly to the client without Next.js rewrites buffering it
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform", // CRITICAL for disabling Next.js/Vercel buffering
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      },
    });
  } catch (error) {
    console.error("Stream Proxy Error:", error);
    return NextResponse.json({ error: "Failed to proxy stream" }, { status: 500 });
  }
}
