import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    
    // Conectarse al backend en la nube
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend-banios.dev-wit.com/api';
    
    const response = await fetch(`${backendUrl}/auth/loginUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ success: false, error: result.error || 'Error al iniciar sesión' }, { status: response.status });
    }

    // Configurar la cookie segura HttpOnly
    const cookieOptions = [
      `authToken=${result.token}`,
      'HttpOnly',
      'Secure',
      'Path=/',
      'SameSite=Strict',
      `Max-Age=${60 * 60 * 24}` // 1 día
    ];

    const nextResponse = NextResponse.json({ 
      success: true, 
      user: result.user 
    });
    
    nextResponse.headers.append('Set-Cookie', cookieOptions.join('; '));

    return nextResponse;
  } catch (error) {
    console.error('Error en API local de login:', error);
    return NextResponse.json({ success: false, error: 'Ocurrió un error en el servidor' }, { status: 500 });
  }
}
