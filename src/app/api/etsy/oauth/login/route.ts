import { NextRequest, NextResponse } from "next/server";
import {
  isEtsyConfigured,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  getAuthorizationUrl,
} from "@/lib/etsy";

export async function GET(request: NextRequest) {
  try {
    if (!isEtsyConfigured()) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          warning: "Etsy API keys not configured",
        },
        { status: 200 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const shouldRedirect = searchParams.get("redirect") === "true";

    // Determine redirect URI
    const defaultRedirectUri = new URL("/api/etsy/oauth/callback", request.url).toString();
    const redirectUri =
      searchParams.get("redirect_uri") ||
      process.env.ETSY_REDIRECT_URI ||
      defaultRedirectUri;

    // Generate PKCE credentials and state
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const authUrl = getAuthorizationUrl(redirectUri, state, codeChallenge);

    const response = shouldRedirect
      ? NextResponse.redirect(authUrl)
      : NextResponse.json({
          success: true,
          configured: true,
          url: authUrl,
          state,
        });

    // Store state and code verifier in secure cookies for callback validation
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600, // 10 minutes
    };

    response.cookies.set("etsy_oauth_state", state, cookieOptions);
    response.cookies.set("etsy_code_verifier", codeVerifier, cookieOptions);
    response.cookies.set("etsy_redirect_uri", redirectUri, cookieOptions);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error during Etsy OAuth login initialization",
      },
      { status: 500 }
    );
  }
}
