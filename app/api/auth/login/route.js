import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://new-backend-caja-banos.dev-wit.com/api";

    const response = await fetch(`${backendUrl}/auth/loginUser`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: result.error || "Error al iniciar sesión" },
        { status: response.status },
      );
    }

    const isProduction = process.env.NODE_ENV === "production";

    const nextResponse = NextResponse.json({
      success: true,
      user: result.user,
      token: result.token,
    });

    // Usar cookies().set para que Next.js maneje correctamente los flags
    nextResponse.cookies.set("authToken", result.token, {
      httpOnly: true,
      secure: isProduction, // Solo Secure en producción (HTTPS)
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 1 día
      path: "/",
    });

    return nextResponse;
  } catch (error) {
    console.error("Error en API local de login:", error);
    return NextResponse.json(
      { success: false, error: "Ocurrió un error en el servidor" },
      { status: 500 },
    );
  }
}
