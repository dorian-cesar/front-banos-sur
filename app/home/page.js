'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export default function HomePage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  
  // Servicios y estado de carga
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [spinnerPago, setSpinnerPago] = useState(false);

  // Buscar Ticket
  const [ticketInput, setTicketInput] = useState('');
  const [ticketBuscado, setTicketBuscado] = useState(null);
  const [showModalTicket, setShowModalTicket] = useState(false);
  const [showModalResumen, setShowModalResumen] = useState(false);
  const [showModalPrint, setShowModalPrint] = useState(false);
  const [recentSales, setRecentSales] = useState([]);

  // Último boleto impreso en pantalla
  const [ultimoBoleto, setUltimoBoleto] = useState({
    codigo: '',
    tipo: '',
    fecha: '',
    hora: '',
    qrBase64: '',
  });

  // Modal pago
  const [showModalPago, setShowModalPago] = useState(false);
  const [datosPendientes, setDatosPendientes] = useState(null);

  const numeroCajaEnv = process.env.NEXT_PUBLIC_NUMERO_CAJA || '77';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend-banios.dev-wit.com/api';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userRaw = sessionStorage.getItem('usuario');
      if (!userRaw) {
        router.push('/login');
        return;
      }
      setUsuario(JSON.parse(userRaw));
      
      const estado = localStorage.getItem('estado_caja');
      setCajaAbierta(estado === 'abierta');

      cargarServicios();
    }
  }, []);

  const cargarServicios = async () => {
    try {
      const token = sessionStorage.getItem('authToken');
      const res = await fetch(`${backendUrl}/services`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Error al cargar servicios');

      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        const activos = data.data.filter((s) => s.estado === 'activo');
        setServicios(activos);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectServicio = (serv) => {
    if (!cajaAbierta) {
      Swal.fire({
        icon: 'warning',
        title: 'Caja cerrada',
        text: 'Por favor, primero debe abrir la caja para realizar ventas.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    setDatosPendientes({
      tipo: serv.tipo,
      nombre: serv.nombre,
      precio: parseFloat(serv.precio),
    });
    setShowModalPago(true);
  };

  const generarTokenNumerico = () => {
    // Genera un token numérico único de 6 a 8 dígitos similar al antiguo
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const obtenerFechaHoraChile = () => {
    const ahora = new Date();
    const opsFecha = { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' };
    const opsHora = { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    
    const fechaChile = ahora.toLocaleDateString('sv-SE', opsFecha); // YYYY-MM-DD
    const horaChile = ahora.toLocaleTimeString('es-CL', opsHora); // HH:MM:SS
    return { fecha: fechaChile, hora: horaChile };
  };

  const registrarMovimientoCaja = async (datos) => {
    const token = sessionStorage.getItem('authToken');
    await fetch(`${backendUrl}/movimientos/registrar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(datos),
    });
  };

  const callApi = async (datos) => {
    // Registra la boleta en la nube
    const token = sessionStorage.getItem('authToken');
    await fetch(`${backendUrl}/boletas/guardar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(datos),
    });
  };

  const registerUserInZKTeco = async (codigo) => {
    // Lógica para registrar en la controladora ZKTeco si existiera el SDK local
    console.log(`Registrando en controladora local: ${codigo}`);
  };

  const continuarConPago = async (metodoPago) => {
    if (!datosPendientes) return;

    setSpinnerPago(true);
    setShowModalPago(false);

    try {
      const token = sessionStorage.getItem('authToken');
      const precioFinal = datosPendientes.precio;
      const tipo = datosPendientes.tipo;
      const idCaja = localStorage.getItem('id_aperturas_cierres');
      
      const { fecha, hora } = obtenerFechaHoraChile();
      const codigoUnico = generarTokenNumerico();

      // Solicitar Folio del SII al backend
      const resFolio = await fetch(`${backendUrl}/boletas/enviar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: tipo,
          precio: Number(precioFinal),
        }),
      });

      const folioData = await resFolio.json();
      if (!resFolio.ok || !folioData?.folio) {
        throw new Error(folioData?.error || 'No se recibió folio del SII');
      }

      const folio = folioData.folio.toString();

      // Generar base64 del código QR usando librería nativa
      const qrBase64 = await QRCode.toDataURL(codigoUnico, { margin: 1 });
      const cleanQrBase64 = qrBase64.replace(/^data:image\/png;base64,/, '');

      // Guardar boleta
      await callApi({
        Codigo: codigoUnico,
        hora,
        fecha,
        tipo,
        valor: precioFinal,
        medio_pago: metodoPago,
      });

      // Guardar movimiento de caja
      await registrarMovimientoCaja({
        codigo: codigoUnico,
        fecha,
        hora,
        tipo,
        valor: precioFinal,
        metodoPago,
        estado_caja: 'abierta',
        id_usuario: usuario.id,
        id_caja: idCaja,
        boleta: folio,
      });

      // Mandar a imprimir el ticket
      await enviarImpresionTicket({
        Codigo: codigoUnico,
        hora,
        fecha,
        tipo,
        valor: precioFinal,
        qrBase64: cleanQrBase64,
        folio,
      });

      // Registrar en el control de acceso
      await registerUserInZKTeco(codigoUnico);

      // Actualizar último boleto impreso en pantalla
      setUltimoBoleto({
        codigo: codigoUnico,
        tipo: `${tipo} (${metodoPago})`,
        fecha,
        hora,
        qrBase64,
      });

      Swal.fire({
        icon: 'success',
        title: '¡Venta Realizada!',
        text: 'Ticket emitido e impreso.',
        timer: 2000,
        showConfirmButton: false,
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error en la venta',
        text: err.message || 'No se pudo completar la emisión de boleta.',
      });
    } finally {
      setSpinnerPago(false);
      setDatosPendientes(null);
    }
  };

  const enviarImpresionTicket = async ({
    Codigo,
    hora,
    fecha,
    tipo,
    valor,
    qrBase64,
    folio,
  }) => {
    const pdfDoc = await PDFDocument.create();
    
    let fechaFormateada = "--/--/----";
    if (fecha) {
      const [anio, mes, dia] = fecha.split("-");
      fechaFormateada = `${dia}-${mes}-${anio}`;
    }

    const lineHeight = 15;
    const altura = 500;
    const page = pdfDoc.addPage([210, altura]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;
    let y = altura - 20;

    const encabezado = [
      "BOLETO DE TRANSACCIÓN",
      "VENTA - COPIA CLIENTE",
      "",
      "INMOBILIARIA E INVERSIONES",
      "P Y R S.A.",
      "RUT: 96.971.370-5",
      "SAN BORJA N1251",
      "ESTACION CENTRAL",
      "Santiago - Chile",
      "---------------------------------------------",
    ];

    encabezado.forEach((line) => {
      const tw = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, { x: (210 - tw) / 2, y, size: fontSize, font });
      y -= lineHeight;
    });

    const codigoText = `Número Ticket : ${Codigo}`;
    const cw = font.widthOfTextAtSize(codigoText, fontSize);
    page.drawText(codigoText, { x: (210 - cw) / 2, y, size: fontSize, font });
    y -= lineHeight;

    if (qrBase64) {
      const qrImage = await pdfDoc.embedPng(`data:image/png;base64,${qrBase64}`);
      const qrDims = qrImage.scale(0.3);
      page.drawImage(qrImage, {
        x: (210 - qrDims.width) / 2,
        y: y - qrDims.height,
        width: qrDims.width,
        height: qrDims.height,
      });
      y -= qrDims.height + 10;
    }

    const detalle = [
      "---------------------------------------------",
      `Nº boleta : ${folio}`,
      `Fecha : ${fechaFormateada}`,
      `Hora  : ${hora}`,
      `Tipo  : ${tipo}`,
      valor ? `Monto : $${Number(valor).toLocaleString("es-CL")}` : null,
      "---------------------------------------------",
    ].filter(Boolean);

    detalle.forEach((line) => {
      const tw = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, { x: (210 - tw) / 2, y, size: fontSize, font });
      y -= lineHeight;
    });

    const footer = ["VÁLIDO COMO BOLETA", "Gracias por su compra"];
    footer.forEach((line) => {
      const tw = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, { x: (210 - tw) / 2, y, size: fontSize, font });
      y -= lineHeight;
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    const responsePrint = await fetch('/api/imprimir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfData: pdfBase64,
        filename: `ticket-${Codigo}-${folio}.pdf`,
      }),
    });

    const result = await responsePrint.json();
    if (!result.success) throw new Error(result.message || 'Error al imprimir');
  };

  const handleBuscarTicket = async () => {
    if (!ticketInput.trim() || !/^\d{6,10}$/.test(ticketInput)) {
      Swal.fire({
        icon: 'warning',
        title: 'Código inválido',
        text: 'El código debe contener entre 6 y 10 números.',
      });
      return;
    }

    setLoading(true);
    const userPin = ticketInput.trim().slice(0, 6);

    try {
      const res = await fetch(`https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/getCodigo.php?codigo=${ticketInput.trim()}`);
      const data = await res.json();
      const ticket = data.find((t) => t.Codigo === ticketInput.trim());

      const resEstado = await fetch(`https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/estadoBoleto.php?userPin=${userPin}`);
      const dataEstado = await resEstado.json();
      let estadoTicket = dataEstado.message || 'No encontrado';
      estadoTicket = estadoTicket.toUpperCase().replace(/\.$/, '');

      if (ticket) {
        setTicketBuscado({
          ...ticket,
          estado: estadoTicket,
        });
        setShowModalTicket(true);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'No encontrado',
          text: 'No se encontró ningún ticket con ese código.',
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al buscar el ticket.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (cajaAbierta) {
      Swal.fire({
        icon: 'warning',
        title: 'Caja abierta',
        text: 'Por favor, primero cierre la caja antes de cerrar sesión.',
      });
      return;
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      sessionStorage.clear();
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <link href="/css/style.css" rel="stylesheet" />
      <link href="/css/teclado.css" rel="stylesheet" />

      {/* Spinner de carga de pago */}
      {spinnerPago && (
        <div className="d-flex flex-column align-items-center justify-content-center position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75" style={{ zIndex: 10000, gap: '20px' }}>
          <div className="spinner-border text-warning" style={{ width: '4rem', height: '4rem', borderWidth: '0.5rem' }}></div>
          <p className="text-white fs-5 fw-bold">Espere unos segundos para la impresión...</p>
        </div>
      )}

      <header>
        <nav className="d-flex align-items-center justify-content-between px-4 py-2">
          <img
            src="/images/LOGOTIPO_PB_NARANJO_NORMA@2x.png"
            alt="Logo Pullman"
            className="logo-pullman"
            style={{ height: '50px' }}
          />
          <h1 style={{ fontSize: '1.8rem', color: '#ff6600', fontWeight: 'bold', margin: 0 }}>
            MÓDULO DE CAJA BAÑOS (CAJA {numeroCajaEnv})
          </h1>
          <img src="/images/wit@2x.png" alt="Logo Wit" className="logo-wit" style={{ height: '50px' }} />
        </nav>
      </header>

      <main className="container-fluid p-4" style={{ backgroundColor: '#f1f9ff', minHeight: 'calc(100vh - 70px)' }}>
        <div id="codigo-container" className="d-flex align-items-center gap-3 mb-4 flex-wrap justify-content-between">
          <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '500px' }}>
            <input
              type="text"
              className="form-control usar-teclado"
              placeholder="Número de ticket"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
            />
            <button className="btn btn-warning text-white" onClick={handleBuscarTicket} disabled={loading}>
              Verificar Ticket
            </button>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-primary" onClick={() => router.push('/caja')}>
              Ver Caja
            </button>
            <button className="btn btn-danger" onClick={handleLogout}>
              Cerrar Sesión
            </button>
          </div>
        </div>

        <h2 className="text-center mb-4 text-secondary">
          Elija la opción según servicio, para imprimir Ticket.
        </h2>

        {/* Contenedor de Botones de Servicios */}
        <div id="btns-container" className="d-flex justify-content-center gap-3 flex-wrap mb-5">
          {servicios.map((serv) => (
            <button
              key={serv.id}
              className={`btn-genera-${serv.tipo.toLowerCase()} lg-button btn btn-warning p-4 text-white fs-4`}
              style={{ minWidth: '220px', minHeight: '120px', borderRadius: '15px' }}
              onClick={() => handleSelectServicio(serv)}
            >
              {serv.nombre} <br />
              <span className="precio font-weight-bold" style={{ fontSize: '1.2rem' }}>
                ${parseFloat(serv.precio).toLocaleString('es-CL')}
              </span>
            </button>
          ))}
        </div>

        {/* Último ticket impreso en pantalla */}
        {ultimoBoleto.codigo && (
          <div id="ticket-container" className="card p-4 mx-auto shadow-sm" style={{ maxWidth: '500px', backgroundColor: 'white' }}>
            <h3 className="text-center mb-3 text-secondary">ÚLTIMO TICKET IMPRESO</h3>
            <div className="row align-items-center">
              <div className="col text-center">
                <img src={ultimoBoleto.qrBase64} alt="QR" style={{ width: '150px', height: '150px' }} />
              </div>
              <div className="col">
                <p className="mb-1"><strong>Código:</strong> {ultimoBoleto.codigo}</p>
                <p className="mb-1"><strong>Servicio:</strong> {ultimoBoleto.tipo}</p>
                <p className="mb-1"><strong>Fecha:</strong> {ultimoBoleto.fecha}</p>
                <p className="mb-0"><strong>Hora:</strong> {ultimoBoleto.hora}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL PAGO */}
      {showModalPago && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0 p-4">
              <h3 className="text-center mb-4 text-primary">Seleccione método de pago</h3>
              <div className="d-grid gap-2">
                <button className="btn btn-success py-3 fs-5" onClick={() => continuarConPago('EFECTIVO')}>
                  💵 Efectivo
                </button>
                <button className="btn btn-info text-white py-3 fs-5" onClick={() => continuarConPago('TARJETA')}>
                  💳 Tarjeta
                </button>
              </div>
              <button className="btn btn-outline-secondary mt-4 py-2" onClick={() => setShowModalPago(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET BUSCADO */}
      {showModalTicket && ticketBuscado && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0 p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="modal-title text-primary">Detalle de Ticket</h3>
                <button className="btn-close" onClick={() => setShowModalTicket(false)}></button>
              </div>
              <div className="mb-3">
                <p className="mb-1"><strong>Código:</strong> {ticketBuscado.Codigo}</p>
                <p className="mb-1"><strong>Tipo:</strong> {ticketBuscado.tipo}</p>
                <p className="mb-1"><strong>Fecha:</strong> {ticketBuscado.date}</p>
                <p className="mb-1"><strong>Hora:</strong> {ticketBuscado.time}</p>
                <p className="mb-0">
                  <strong>Estado:</strong>{' '}
                  <span className={ticketBuscado.estado === 'BOLETO SIN USAR' ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                    {ticketBuscado.estado}
                  </span>
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowModalTicket(false)}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor del teclado virtual */}
      <div
        id="tecladoContainer"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          zIndex: 9999,
          background: '#fff',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="simple-keyboard"></div>
      </div>

      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/simple-keyboard/3.8.67/index.min.js"
        strategy="lazyOnload"
      />
    </>
  );
}
