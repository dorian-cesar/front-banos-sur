import { NextResponse } from 'next/server';

export async function POST() {
  const nextResponse = NextResponse.json({ success: true, message: 'Sesión cerrada' });
  
  // Expirar la cookie de autenticación inmediatamente
  nextResponse.headers.append(
    'Set-Cookie',
    'authToken=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  );
  
  return nextResponse;
}
