import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, isEtsyConfigured } from "@/lib/etsy";
import { saveEtsyToken } from "@/lib/db";

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
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error,
          description: errorDescription || "Etsy OAuth authorization failed or was denied",
        },
        { status: 400 }
      );
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing authorization code in callback parameters",
        },
        { status: 400 }
      );
    }

    // Retrieve state & verifier from cookies
    const cookieState = request.cookies.get("etsy_oauth_state")?.value;
    const codeVerifier = request.cookies.get("etsy_code_verifier")?.value;
    const cookieRedirectUri = request.cookies.get("etsy_redirect_uri")?.value;

    if (!state || !cookieState || state !== cookieState) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired OAuth state parameter (potential CSRF)",
        },
        { status: 400 }
      );
    }

    if (!codeVerifier) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing PKCE code verifier cookie",
        },
        { status: 400 }
      );
    }

    const defaultRedirectUri = new URL("/api/etsy/oauth/callback", request.url).toString();
    const redirectUri = cookieRedirectUri || defaultRedirectUri;

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
    // Etsy v3 access token format typically prefixes with shop ID or user ID
    const shopId = tokens.access_token.includes(".")
      ? tokens.access_token.split(".")[0]
      : null;

    const savedToken = await saveEtsyToken({
      shopId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      tokenType: tokens.token_type || "Bearer",
      scope: "transactions_r shops_r",
    });

    const response = NextResponse.json({
      success: true,
      message: "Etsy account successfully authenticated and tokens persisted",
      shopId: savedToken.shopId,
      expiresAt: savedToken.expiresAt.toISOString(),
    });

    // Clear authentication cookies
    response.cookies.delete("etsy_oauth_state");
    response.cookies.delete("etsy_code_verifier");
    response.cookies.delete("etsy_redirect_uri");

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error during Etsy OAuth callback exchange",
      },
      { status: 500 }
    );
  }
}
