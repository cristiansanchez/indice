import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.ACCESS_PASSWORD;

    // DEBUG: Log temporal para verificar la variable de entorno
    console.log("=== AUTH DEBUG ===");
    console.log("ACCESS_PASSWORD exists:", !!correctPassword);
    console.log("ACCESS_PASSWORD length:", correctPassword?.length || 0);
    console.log("ACCESS_PASSWORD first 3 chars:", correctPassword?.substring(0, 3) || "N/A");
    console.log("ACCESS_PASSWORD last 3 chars:", correctPassword?.substring(correctPassword?.length - 3) || "N/A");
    console.log("Password received length:", password?.length || 0);
    console.log("Passwords match:", password === correctPassword);
    console.log("==================");

    if (!correctPassword) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (password === correctPassword) {
      // Create response with success
      const response = NextResponse.json({ success: true });

      // Set secure authentication cookie from server
      // HttpOnly prevents JavaScript access (XSS protection)
      // Secure flag ensures cookie is only sent over HTTPS in production
      // SameSite=Strict provides CSRF protection
      response.cookies.set("authenticated", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return response;
    } else {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

