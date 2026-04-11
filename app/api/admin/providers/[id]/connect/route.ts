import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/encryption";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const provider = db.select().from(schema.providers)
    .where(eq(schema.providers.id, id))
    .get();

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  if (provider.authMethod !== "oauth2") {
    return NextResponse.json({ error: "Provider does not support OAuth2" }, { status: 400 });
  }

  if (!provider.oauthClientId || !provider.oauthClientSecret || !provider.oauthTokenUrl) {
    return NextResponse.json({ error: "OAuth2 not fully configured" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { grantType, code, redirectUri } = body;

    const clientId = decrypt(provider.oauthClientId);
    const clientSecret = decrypt(provider.oauthClientSecret);

    let tokenData: any;

    if (grantType === "client_credentials") {
      const response = await fetch(provider.oauthTokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({ error: `Token exchange failed: ${error}` }, { status: 400 });
      }

      tokenData = await response.json();
    } else if (grantType === "authorization_code" && code) {
      const response = await fetch(provider.oauthTokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri || "",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({ error: `Token exchange failed: ${error}` }, { status: 400 });
      }

      tokenData = await response.json();
    } else {
      return NextResponse.json({ error: "Invalid grant type or missing code" }, { status: 400 });
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    db.update(schema.providers)
      .set({
        oauthAccessToken: encrypt(tokenData.access_token),
        oauthRefreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        oauthExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.providers.id, id))
      .run();

    return NextResponse.json({
      success: true,
      expiresAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "OAuth2 connect failed" }, { status: 500 });
  }
}
