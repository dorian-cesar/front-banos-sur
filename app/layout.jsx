import "./globals.css";

export const metadata = {
  title: "Suite Servicios Pullman",
  description: "Control de caja e impresión de tickets de servicios",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=1366" />
        <link rel="icon" type="image/png" href="/images/icono.png" />
        {/* Bootstrap 5.3 */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        {/* Simple Keyboard CSS */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/simple-keyboard/3.8.67/css/index.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
