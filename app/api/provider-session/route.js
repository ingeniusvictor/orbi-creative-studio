import { NextResponse } from 'next/server';
import {
    PROVIDER_SESSION_COOKIE,
    PROVIDER_SESSION_ENV,
    PROVIDER_SESSION_MAX_AGE_SECONDS,
    isTrustedProviderSessionMutation,
    loadProviderSessionSecret,
    openMuapiProviderSession,
    parseCookieHeader,
    providerSessionCookieOptions,
    sealMuapiProviderSession,
} from '@/src/server/providerSession.mjs';

function publicSessionError(error) {
    if (error?.code === 'SESSION_SECRET_MISSING' || error?.code === 'SESSION_SECRET_INVALID') {
        return NextResponse.json(
            { available: false, configured: false, error: 'provider-session-unavailable' },
            { status: 503 },
        );
    }

    return NextResponse.json(
        { available: true, configured: false },
        { status: 200 },
    );
}

function readToken(request) {
    return parseCookieHeader(request.headers.get('cookie'));
}

export async function GET(request) {
    let secret;
    try {
        secret = loadProviderSessionSecret(process.env);
    } catch (error) {
        return publicSessionError(error);
    }

    const token = readToken(request);
    if (!token) {
        return NextResponse.json({ available: true, configured: false });
    }

    try {
        const session = openMuapiProviderSession(token, {
            secret: secret.toString('hex'),
        });
        return NextResponse.json({
            available: true,
            configured: true,
            expiresAt: session.expiresAt,
        });
    } catch {
        const response = NextResponse.json({ available: true, configured: false });
        response.cookies.set(
            PROVIDER_SESSION_COOKIE,
            '',
            { ...providerSessionCookieOptions(request), maxAge: 0 },
        );
        return response;
    }
}

export async function POST(request) {
    if (!isTrustedProviderSessionMutation(request)) {
        return NextResponse.json({ error: 'untrusted-origin' }, { status: 403 });
    }

    let secret;
    try {
        secret = loadProviderSessionSecret(process.env);
    } catch (error) {
        return publicSessionError(error);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
    }

    try {
        const token = sealMuapiProviderSession(body?.apiKey, {
            secret: secret.toString('hex'),
        });

        const response = NextResponse.json({
            available: true,
            configured: true,
        });
        response.cookies.set(
            PROVIDER_SESSION_COOKIE,
            token,
            providerSessionCookieOptions(request, {
                maxAgeSeconds: PROVIDER_SESSION_MAX_AGE_SECONDS,
            }),
        );
        return response;
    } catch (error) {
        if (error?.code === 'INVALID_PROVIDER_KEY') {
            return NextResponse.json({ error: 'invalid-provider-key' }, { status: 400 });
        }
        return NextResponse.json({ error: 'provider-session-failed' }, { status: 500 });
    }
}

export async function DELETE(request) {
    if (!isTrustedProviderSessionMutation(request)) {
        return NextResponse.json({ error: 'untrusted-origin' }, { status: 403 });
    }

    const response = NextResponse.json({
        available: true,
        configured: false,
    });
    response.cookies.set(
        PROVIDER_SESSION_COOKIE,
        '',
        { ...providerSessionCookieOptions(request), maxAge: 0 },
    );
    return response;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Keep the environment dependency explicit for deployment documentation/static review.
export const providerSessionEnvironmentVariable = PROVIDER_SESSION_ENV;
