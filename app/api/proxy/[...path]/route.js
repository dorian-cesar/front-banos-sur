import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend-banios.dev-wit.com/api';

async function proxyRequest(request, { params }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;

    const { path } = await params;
    const pathStr = Array.isArray(path) ? path.join('/') : path;

    // Preservar query params
    const url = new URL(request.url);
    const targetUrl = `${backendUrl}/${pathStr}${url.search}`;

    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let body = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const text = await request.text();
      if (text) body = text;
    }

    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });

  } catch (error) {
    console.error('[proxy] Error:', error.message);
    return NextResponse.json({ error: 'Error interno del proxy' }, { status: 500 });
  }
}

export async function GET(request, context) {
  return proxyRequest(request, context);
}

export async function POST(request, context) {
  return proxyRequest(request, context);
}

export async function PUT(request, context) {
  return proxyRequest(request, context);
}

export async function PATCH(request, context) {
  return proxyRequest(request, context);
}

export async function DELETE(request, context) {
  return proxyRequest(request, context);
}
