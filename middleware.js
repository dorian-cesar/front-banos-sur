import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('authToken')?.value;
  const { pathname } = request.nextUrl;

  // Rutas protegidas
  const isProtectedRoute = pathname.startsWith('/caja') || pathname.startsWith('/home');
  // Rutas de autenticación
  const isAuthRoute = pathname.startsWith('/login') || pathname === '/';

  if (isProtectedRoute && !token) {
    // Redirigir a login si no hay token
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && token) {
    // Redirigir a home si ya está autenticado
    const homeUrl = new URL('/home', request.url);
    return NextResponse.redirect(homeUrl);
  }

  // Si entra a la raíz y no tiene sesión, llevar al login
  if (pathname === '/' && !token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Aplicar middleware a todas las páginas excepto APIs y archivos estáticos
  matcher: ['/((?!api|_next/static|_next/image|images|css|favicon.ico).*)'],
};
