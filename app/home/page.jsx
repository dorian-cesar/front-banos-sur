"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Swal from "sweetalert2";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts } from "pdf-lib";

export default function HomePage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);

  // Servicios y estado de carga
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [spinnerPago, setSpinnerPago] = useState(false);
  const [loadingServicios, setLoadingServicios] = useState(true);

  // Buscar Ticket
  const [ticketInput, setTicketInput] = useState("");
  const [ticketBuscado, setTicketBuscado] = useState(null);
  const [showModalTicket, setShowModalTicket] = useState(false);
  const [showModalResumen, setShowModalResumen] = useState(false);
  const [showModalPrint, setShowModalPrint] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [estadoTicketSeleccionado, setEstadoTicketSeleccionado] = useState("");
  const [qrTicketSeleccionado, setQrTicketSeleccionado] = useState("");

  // Último boleto impreso en pantalla
  const [ultimoBoleto, setUltimoBoleto] = useState({
    codigo: "",
    tipo: "",
    fecha: "",
    hora: "",
    qrBase64: "",
  });

  // Modal pago
  const [showModalPago, setShowModalPago] = useState(false);
  const [datosPendientes, setDatosPendientes] = useState(null);

  const numeroCajaEnv = process.env.NEXT_PUBLIC_NUMERO_CAJA || "77";
  // Proxy local — agrega el token automáticamente desde la cookie HttpOnly
  const backendUrl = "/api/proxy";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userRaw = sessionStorage.getItem("usuario");
      if (!userRaw) {
        router.push("/login");
        return;
      }
      setUsuario(JSON.parse(userRaw));

      const estado = localStorage.getItem("estado_caja");
      setCajaAbierta(estado === "abierta");

      cargarServicios();
    }
  }, []);

  const cargarServicios = async () => {
    setLoadingServicios(true);
    try {
      // Llama al proxy local que usa la cookie HttpOnly para autenticar
      const res = await fetch("/api/services");

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al cargar servicios");
      }

      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        const activos = data.data.filter((s) => s.estado === "activo");
        setServicios(activos);
      } else if (Array.isArray(data)) {
        const activos = data.filter((s) => s.estado === "activo");
        setServicios(activos);
      }
    } catch (error) {
      console.warn("Servicios no disponibles:", error.message);
    } finally {
      setLoadingServicios(false);
    }
  };

  const handleSelectServicio = (serv) => {
    if (!cajaAbierta) {
      Swal.fire({
        icon: "warning",
        title: "Caja cerrada",
        text: "Por favor, primero debe abrir la caja para realizar ventas.",
        confirmButtonText: "Entendido",
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
    const opsFecha = {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    const opsHora = {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };

    const fechaChile = ahora.toLocaleDateString("sv-SE", opsFecha); // YYYY-MM-DD
    const horaChile = ahora.toLocaleTimeString("es-CL", opsHora); // HH:MM:SS
    return { fecha: fechaChile, hora: horaChile };
  };

  const registrarMovimientoCaja = async (datos) => {
    const token = sessionStorage.getItem("authToken");
    await fetch(`${backendUrl}/movimientos/registrar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(datos),
    });
  };

  const callApi = async (datos) => {
    // Registra la boleta en la nube
    const token = sessionStorage.getItem("authToken");
    await fetch(`${backendUrl}/boletas/guardar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(datos),
    });
  };

  const registerUserInZKTeco = async (codigo) => {
    // Lógica para registrar en la controladora ZKTeco si existiera el SDK local
    console.log(`Registrando en controladora local: ${codigo}`);
  };

  const seleccionarCantidadTicketsAccesible = async () => {
    return Swal.fire({
      title: "🖨️ ¿Cuántos boletos desea imprimir?",
      html: `
        <div class="cantidad-grid" aria-label="Opciones rápidas de cantidad">
          <button type="button" class="cantidad-btn" data-value="5">5</button>
          <button type="button" class="cantidad-btn" data-value="10">10</button>
          <button type="button" class="cantidad-btn" data-value="15">15</button>
          <button type="button" class="cantidad-btn" data-value="20">20</button>
        </div>
        <p style="margin-top:12px">O ingrese otra cantidad (máx. 25):</p>
        <input id="cantidadManual" type="number" min="1" max="25" class="cantidad-manual" aria-label="Cantidad manual" autocomplete="off" />
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Aceptar",
      cancelButtonText: "Cancelar",
      customClass: {
        popup: "alert-card",
        title: "swal-font",
        confirmButton: "my-confirm-btn",
        cancelButton: "my-cancel-btn",
      },
      buttonsStyling: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const grid = Swal.getHtmlContainer().querySelector(".cantidad-grid");
        grid.querySelectorAll(".cantidad-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            grid
              .querySelectorAll(".cantidad-btn")
              .forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
          });
        });
        const manual = Swal.getHtmlContainer().querySelector("#cantidadManual");
        manual.addEventListener("focus", () => {
          grid
            .querySelectorAll(".cantidad-btn")
            .forEach((b) => b.classList.remove("selected"));
        });
      },
      preConfirm: () => {
        const manual = Number(
          Swal.getHtmlContainer().querySelector("#cantidadManual").value,
        );
        const selectedBtn = Swal.getHtmlContainer().querySelector(
          ".cantidad-btn.selected",
        );
        const quick = selectedBtn ? Number(selectedBtn.dataset.value) : null;

        if (manual && manual > 0 && manual <= 25) return manual;
        if (quick && quick > 0) return quick;

        Swal.showValidationMessage("Seleccione una cantidad válida (1 a 25).");
        return false;
      },
    }).then((r) => (r.isConfirmed ? Number(r.value) : null));
  };

  const continuarConPago = async (metodoPago) => {
    if (!datosPendientes) return;

    setShowModalPago(false);

    try {
      const token = sessionStorage.getItem("authToken");
      const precioFinal = datosPendientes.precio;
      const tipo = datosPendientes.tipo;
      const idCaja = localStorage.getItem("id_aperturas_cierres");

      const { fecha, hora } = obtenerFechaHoraChile();

      if (metodoPago === "EFECTIVO_LOTE") {
        const cantidad = await seleccionarCantidadTicketsAccesible();
        if (!cantidad || cantidad <= 0) {
          return;
        }

        setSpinnerPago(true);

        // Solicitar Folio Lote del SII al backend
        const resLote = await fetch(`${backendUrl}/boletas/enviar-lote`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombre: tipo,
            precio: Number(precioFinal) || 0,
            cantidad: Number(cantidad),
            monto_total: (Number(precioFinal) || 0) * Number(cantidad),
          }),
        });

        const loteData = await resLote.json();
        if (!resLote.ok || !loteData?.folio) {
          throw new Error(
            loteData?.error || "No se recibió folio base de lote del SII",
          );
        }

        const folioBase = loteData.folio.toString();

        let ticketsImpresos = 0;
        let ultimoCodigo = "";
        let ultimoQrBase64 = "";

        for (let i = 0; i < cantidad; i++) {
          const codigoUnico = generarTokenNumerico();
          const folioActual = `${folioBase}-${i + 1}`;

          // Generar base64 del código QR usando librería nativa
          const qrBase64 = await QRCode.toDataURL(codigoUnico, { margin: 1 });
          const cleanQrBase64 = qrBase64.replace(
            /^data:image\/png;base64,/,
            "",
          );

          // Guardar boleta
          await callApi({
            Codigo: codigoUnico,
            hora,
            fecha,
            tipo,
            valor: precioFinal,
            medio_pago: "EFECTIVO_LOTE",
          });

          // Guardar movimiento de caja
          await registrarMovimientoCaja({
            codigo: codigoUnico,
            fecha,
            hora,
            tipo,
            valor: precioFinal,
            metodoPago: "EFECTIVO-LOTE",
            estado_caja: "abierta",
            id_usuario: usuario.id,
            id_caja: idCaja,
            boleta: folioActual,
          });

          // Mandar a imprimir el ticket
          await enviarImpresionTicket({
            Codigo: codigoUnico,
            hora,
            fecha,
            tipo,
            valor: precioFinal,
            qrBase64: cleanQrBase64,
            folio: folioActual,
          });

          // Registrar en el control de acceso
          await registerUserInZKTeco(codigoUnico);

          ticketsImpresos++;
          ultimoCodigo = codigoUnico;
          ultimoQrBase64 = qrBase64;
        }

        // Actualizar último boleto impreso en pantalla con el último del lote
        setUltimoBoleto({
          codigo: ultimoCodigo,
          tipo: `${tipo} (EFECTIVO-LOTE)`,
          fecha,
          hora,
          qrBase64: ultimoQrBase64,
        });

        Swal.fire({
          icon: "success",
          title: "¡Venta Realizada!",
          text: `Se imprimieron ${ticketsImpresos} boletos correctamente.`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        setSpinnerPago(true);
        const codigoUnico = generarTokenNumerico();

        // Solicitar Folio del SII al backend
        const resFolio = await fetch(`${backendUrl}/boletas/enviar`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombre: tipo,
            precio: Number(precioFinal),
          }),
        });

        const folioData = await resFolio.json();
        if (!resFolio.ok || !folioData?.folio) {
          throw new Error(folioData?.error || "No se recibió folio del SII");
        }

        const folio = folioData.folio.toString();

        // Generar base64 del código QR usando librería nativa
        const qrBase64 = await QRCode.toDataURL(codigoUnico, { margin: 1 });
        const cleanQrBase64 = qrBase64.replace(/^data:image\/png;base64,/, "");

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
          estado_caja: "abierta",
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
          icon: "success",
          title: "¡Venta Realizada!",
          text: "Ticket emitido e impreso.",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error en la venta",
        text: err.message || "No se pudo completar la emisión de boleta.",
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
      const qrImage = await pdfDoc.embedPng(
        `data:image/png;base64,${qrBase64}`,
      );
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

    const responsePrint = await fetch("/api/imprimir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfData: pdfBase64,
        filename: `ticket-${Codigo}-${folio}.pdf`,
      }),
    });

    const result = await responsePrint.json();
    if (!result.success) throw new Error(result.message || "Error al imprimir");
  };

  const handleBuscarTicket = async () => {
    if (!ticketInput.trim() || !/^\d{6,10}$/.test(ticketInput)) {
      Swal.fire({
        icon: "warning",
        title: "Código inválido",
        text: "El código debe contener entre 6 y 10 números.",
      });
      return;
    }

    setLoading(true);
    const userPin = ticketInput.trim().slice(0, 6);

    try {
      const res = await fetch(
        `https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/getCodigo.php?codigo=${ticketInput.trim()}`,
      );
      const data = await res.json();
      const ticket = data.find((t) => t.Codigo === ticketInput.trim());

      const resEstado = await fetch(
        `https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/estadoBoleto.php?userPin=${userPin}`,
      );
      const dataEstado = await resEstado.json();
      let estadoTicket = dataEstado.message || "No encontrado";
      estadoTicket = estadoTicket.toUpperCase().replace(/\.$/, "");

      if (ticket) {
        const qrBase64 = await QRCode.toDataURL(ticket.Codigo, { margin: 1 });
        setTicketBuscado({
          ...ticket,
          estado: estadoTicket,
          qrBase64: qrBase64,
        });
        setShowModalTicket(true);
      } else {
        Swal.fire({
          icon: "error",
          title: "No encontrado",
          text: "No se encontró ningún ticket con ese código.",
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al buscar el ticket.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReimprimirTicketBuscado = async () => {
    if (!ticketBuscado || !ticketBuscado.estado) return;

    if (ticketBuscado.estado !== "BOLETO SIN USAR") {
      Swal.fire({
        icon: "warning",
        title: "Reimpresión no permitida",
        text: "No se puede reimprimir un boleto que ya ha sido ocupado.",
      });
      return;
    }

    setSpinnerPago(true);

    try {
      const pdfDoc = await PDFDocument.create();

      let fechaFormateada = "--/--/----";
      if (ticketBuscado.date) {
        const parts = ticketBuscado.date.split("-");
        if (parts.length === 3) {
          const [anio, mes, dia] = parts;
          fechaFormateada = `${dia}-${mes}-${anio}`;
        } else {
          fechaFormateada = ticketBuscado.date;
        }
      }

      const lineHeight = 15;
      const qrHeight = 120;
      const altura = 500;
      const page = pdfDoc.addPage([210, altura]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 11;
      let y = altura - 20;

      const encabezado = [
        "REIMPRESIÓN",
        "---------------------------------------------",
      ];
      encabezado.forEach((line) => {
        const textWidth = font.widthOfTextAtSize(line, fontSize);
        page.drawText(line, {
          x: (210 - textWidth) / 2,
          y,
          size: fontSize,
          font,
        });
        y -= lineHeight;
      });

      const codigoText = `Código : ${ticketBuscado.Codigo}`;
      const codigoWidth = font.widthOfTextAtSize(codigoText, fontSize);
      page.drawText(codigoText, {
        x: (210 - codigoWidth) / 2,
        y,
        size: fontSize,
        font,
      });
      y -= lineHeight;

      if (ticketBuscado.qrBase64) {
        const cleanQr = ticketBuscado.qrBase64.replace(
          /^data:image\/png;base64,/,
          "",
        );
        const qrImage = await pdfDoc.embedPng(
          `data:image/png;base64,${cleanQr}`,
        );
        const qrDims = qrImage.scale(0.5);
        page.drawImage(qrImage, {
          x: (210 - qrDims.width) / 2,
          y: y - qrHeight,
          width: qrDims.width,
          height: qrDims.height,
        });
        y = y - qrHeight - 10;
      }

      const detalle = [
        "---------------------------------------------",
        `Fecha : ${fechaFormateada}`,
        `Hora  : ${ticketBuscado.time}`,
        `Tipo  : ${ticketBuscado.tipo}`,
        ticketBuscado.valor ? `Monto : $${ticketBuscado.valor}` : null,
        "---------------------------------------------",
      ].filter(Boolean);

      detalle.forEach((line) => {
        const textWidth = font.widthOfTextAtSize(line, fontSize);
        page.drawText(line, {
          x: (210 - textWidth) / 2,
          y,
          size: fontSize,
          font,
        });
        y -= lineHeight;
      });

      const footer = [
        "COMPROBANTE DE REIMPRESIÓN",
        "Válido solo como comprobante",
      ];
      footer.forEach((line) => {
        const textWidth = font.widthOfTextAtSize(line, fontSize);
        page.drawText(line, {
          x: (210 - textWidth) / 2,
          y,
          size: fontSize,
          font,
        });
        y -= lineHeight;
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

      const responsePrint = await fetch("/api/imprimir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfData: pdfBase64,
          filename: `reimpresion-${ticketBuscado.Codigo}-${Date.now()}.pdf`,
        }),
      });

      const result = await responsePrint.json();
      if (!result.success)
        throw new Error(result.message || "Error al imprimir");

      Swal.fire({
        icon: "success",
        title: "Reimpresión enviada",
        text: `El ticket ${ticketBuscado.Codigo} ha sido enviado a impresión.`,
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al imprimir",
        text: err.message || "No se pudo reimprimir el ticket.",
      });
    } finally {
      setSpinnerPago(false);
    }
  };

  const handleVerificarTicket = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/load.php",
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        const ordenado = data.sort((a, b) => {
          const fechaA = new Date(`${a.date} ${a.time}`);
          const fechaB = new Date(`${b.date} ${b.time}`);
          return fechaB - fechaA;
        });
        const ultimos = ordenado.slice(0, 8);
        setRecentSales(ultimos);
        setShowModalResumen(true);
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al cargar el resumen de ventas.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirModalImpresion = async (item) => {
    setShowModalResumen(false);
    setLoading(true);
    const userPin = item.Codigo.slice(0, 6);
    try {
      const resEstado = await fetch(
        `https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/estadoBoleto.php?userPin=${userPin}`,
      );
      const dataEstado = await resEstado.json();
      let estadoTicket = dataEstado.message || "No encontrado";
      estadoTicket = estadoTicket.toUpperCase().replace(/\.$/, "");

      const qrBase64 = await QRCode.toDataURL(item.Codigo, { margin: 1 });

      setTicketSeleccionado(item);
      setEstadoTicketSeleccionado(estadoTicket);
      setQrTicketSeleccionado(qrBase64);
      setShowModalPrint(true);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cargar la información del ticket.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReimprimirTicket = async () => {
    if (!ticketSeleccionado || !estadoTicketSeleccionado) return;

    if (estadoTicketSeleccionado !== "BOLETO SIN USAR") {
      Swal.fire({
        icon: "warning",
        title: "Reimpresión no permitida",
        text: "No se puede reimprimir un boleto que ya ha sido ocupado.",
      });
      return;
    }

    setSpinnerPago(true);

    try {
      const pdfDoc = await PDFDocument.create();

      let fechaFormateada = "--/--/----";
      if (ticketSeleccionado.date) {
        const parts = ticketSeleccionado.date.split("-");
        if (parts.length === 3) {
          const [anio, mes, dia] = parts;
          fechaFormateada = `${dia}-${mes}-${anio}`;
        } else {
          fechaFormateada = ticketSeleccionado.date;
        }
      }

      const lineHeight = 15;
      const qrHeight = 120;
      const altura = 500;
      const page = pdfDoc.addPage([210, altura]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 11;
      let y = altura - 20;

      const encabezado = [
        "REIMPRESIÓN",
        "---------------------------------------------",
      ];
      encabezado.forEach((line) => {
        const textWidth = font.widthOfTextAtSize(line, fontSize);
        page.drawText(line, {
          x: (210 - textWidth) / 2,
          y,
          size: fontSize,
          font,
        });
        y -= lineHeight;
      });

      const codigoText = `Código : ${ticketSeleccionado.Codigo}`;
      const codigoWidth = font.widthOfTextAtSize(codigoText, fontSize);
      page.drawText(codigoText, {
        x: (210 - codigoWidth) / 2,
        y,
        size: fontSize,
        font,
      });
      y -= lineHeight;

      if (qrTicketSeleccionado) {
        const cleanQr = qrTicketSeleccionado.replace(
          /^data:image\/png;base64,/,
          "",
        );
        const qrImage = await pdfDoc.embedPng(
          `data:image/png;base64,${cleanQr}`,
        );
        const qrDims = qrImage.scale(0.5);
        page.drawImage(qrImage, {
          x: (210 - qrDims.width) / 2,
          y: y - qrHeight,
          width: qrDims.width,
          height: qrDims.height,
        });
        y = y - qrHeight - 10;
      }

      const detalle = [
        "---------------------------------------------",
        `Fecha : ${fechaFormateada}`,
        `Hora  : ${ticketSeleccionado.time}`,
        `Tipo  : ${ticketSeleccionado.tipo}`,
        ticketSeleccionado.valor
          ? `Monto : $${ticketSeleccionado.valor}`
          : null,
        "---------------------------------------------",
      ].filter(Boolean);

      detalle.forEach((line) => {
        const textWidth = font.widthOfTextAtSize(line, fontSize);
        page.drawText(line, {
          x: (210 - textWidth) / 2,
          y,
          size: fontSize,
          font,
        });
        y -= lineHeight;
      });

      const footer = [
        "COMPROBANTE DE REIMPRESIÓN",
        "Válido solo como comprobante",
      ];
      footer.forEach((line) => {
        const textWidth = font.widthOfTextAtSize(line, fontSize);
        page.drawText(line, {
          x: (210 - textWidth) / 2,
          y,
          size: fontSize,
          font,
        });
        y -= lineHeight;
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

      const responsePrint = await fetch("/api/imprimir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfData: pdfBase64,
          filename: `reimpresion-${ticketSeleccionado.Codigo}-${Date.now()}.pdf`,
        }),
      });

      const result = await responsePrint.json();
      if (!result.success)
        throw new Error(result.message || "Error al imprimir");

      Swal.fire({
        icon: "success",
        title: "Reimpresión enviada",
        text: `El ticket ${ticketSeleccionado.Codigo} ha sido enviado a impresión.`,
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error al imprimir",
        text: err.message || "No se pudo reimprimir el ticket.",
      });
    } finally {
      setSpinnerPago(false);
    }
  };

  const handleLogout = async () => {
    if (cajaAbierta) {
      Swal.fire({
        icon: "warning",
        title: "Caja abierta",
        text: "Por favor, primero cierre la caja antes de cerrar sesión.",
      });
      return;
    }

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      sessionStorage.clear();
      router.push("/login");
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
        <div
          className="d-flex flex-column align-items-center justify-content-center position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75"
          style={{ zIndex: 10000, gap: "20px" }}
        >
          <div
            className="spinner-border text-warning"
            style={{ width: "4rem", height: "4rem", borderWidth: "0.5rem" }}
          ></div>
          <p className="text-white fs-5 fw-bold">
            Espere unos segundos para la impresión...
          </p>
        </div>
      )}

      <header>
        <nav className="d-flex align-items-center justify-content-between px-4 py-2">
          <img
            src="/images/LOGOTIPO_PB_NARANJO_NORMA@2x.png"
            alt="Logo Pullman"
            className="logo-pullman"
            style={{ height: "50px" }}
          />
          <h1
            style={{
              fontSize: "1.8rem",
              color: "#2699fb",
              fontWeight: "bold",
              margin: 0,
            }}
          >
            MODULO DE CAJA BAÑOS
          </h1>
          <img
            src="/images/wit@2x.png"
            alt="Logo Wit"
            className="logo-wit"
            style={{ height: "50px" }}
          />
        </nav>
      </header>

      <main
        className="container-fluid px-4 pb-4 pt-0"
        style={{ backgroundColor: "#f1f9ff", minHeight: "calc(100vh - 70px)" }}
      >
        {/* Top search & links bar */}
        <div id="codigo-container">
          <div className="codigo-input-container">
            <img
              className="input-icon"
              src="/images/LUPA.svg"
              alt="Search"
              style={{ height: "16px" }}
            />
            <div className="input-container">
              <input
                type="text"
                className="codigo-input usar-teclado"
                placeholder="Número de ticket"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <button
            className="search-btn"
            onClick={handleBuscarTicket}
            disabled={loading}
          >
            <img
              src="/images/LUPA boton.svg"
              alt="Search"
              style={{ height: "20px" }}
            />
          </button>

          <button
            className="sm-button"
            onClick={handleVerificarTicket}
            style={{ background: "#ff5600", borderColor: "#ff5600" }}
            disabled={loading}
          >
            {loading ? "Cargando..." : "VERIFICAR TICKET"}
          </button>

          <button className="caja-button" onClick={() => router.push("/caja")}>
            <img
              src="/images/cash-machine.png"
              alt="Ir a caja"
              className="caja-image"
            />
          </button>

          <button className="logout-button" onClick={handleLogout}>
            <img
              src="/images/logout.png"
              alt="Cerrar sesión"
              className="logout-image"
            />
          </button>
        </div>

        <h2
          className="text-center mb-4 text-secondary"
          style={{ color: "#2699fb", fontSize: "28px", fontWeight: "bold" }}
        >
          Elija la opción según servicio, para imprimir Ticket.
        </h2>

        {/* Contenedor de Botones de Servicios */}
        <div
          id="btns-container"
          style={{
            minHeight: "176px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {loadingServicios ? (
            <div className="d-flex flex-column align-items-center justify-content-center">
              <div
                className="spinner-border text-primary"
                style={{
                  width: "4rem",
                  height: "4rem",
                  borderWidth: "0.5rem",
                  color: "#ff5600",
                }}
                role="status"
              >
                <span className="visually-hidden">Cargando...</span>
              </div>
              <span className="mt-3 fs-5 fw-bold" style={{ color: "#ff5600" }}>
                Cargando servicios...
              </span>
            </div>
          ) : servicios.length > 0 ? (
            servicios.map((serv) => (
              <button
                key={serv.id}
                className="lg-button"
                onClick={() => handleSelectServicio(serv)}
              >
                {serv.nombre} <br />
                <span className="precio">
                  ${parseFloat(serv.precio).toLocaleString("es-CL")}
                </span>
              </button>
            ))
          ) : (
            <span className="fs-5 fw-bold" style={{ color: "#666666" }}>
              No hay servicios disponibles
            </span>
          )}
        </div>

        {/* Último ticket impreso en pantalla */}
        <div
          id="ticket-container"
          className="mx-auto"
          style={{
            border: "2px solid #2599fb",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
          }}
        >
          <div className="row h-100 align-items-center px-4">
            <h3
              className="text-center w-100 m-0"
              style={{
                color: "#2699fb",
                fontSize: "24px",
                fontWeight: "bold",
                margin: "10px 0",
              }}
            >
              ÚLTIMO TICKET y BOLETA IMPRESA
            </h3>

            <div className="col-4 d-flex justify-content-center align-items-center">
              {ultimoBoleto.qrBase64 ? (
                <img
                  src={ultimoBoleto.qrBase64}
                  alt="QR"
                  style={{
                    width: "150px",
                    height: "150px",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <img
                  src="/images/QR@2x.png"
                  alt="Placeholder QR"
                  style={{
                    width: "150px",
                    height: "150px",
                    objectFit: "contain",
                    opacity: 0.15,
                  }}
                />
              )}
            </div>

            <div
              className="col-4 ticket-text"
              style={{
                fontSize: "20px",
                color: "#666666",
                fontWeight: "bold",
                lineHeight: "1.8",
              }}
            >
              <p className="m-0">CÓDIGO TICKET</p>
              <p className="m-0">TIPO</p>
              <p className="m-0">FECHA</p>
              <p className="m-0">HORA</p>
            </div>

            <div
              className="col-4 ticket-text"
              style={{ fontSize: "20px", color: "#707070", lineHeight: "1.8" }}
            >
              <p className="m-0" id="codigo">
                {ultimoBoleto.codigo || ""}
              </p>
              <p className="m-0" id="tipo">
                {ultimoBoleto.tipo || ""}
              </p>
              <p className="m-0" id="fecha">
                {ultimoBoleto.fecha || ""}
              </p>
              <p className="m-0" id="hora">
                {ultimoBoleto.hora || ""}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL PAGO */}
      {showModalPago && (
        <div
          id="modalPago"
          style={{
            display: "flex",
            position: "fixed",
            zIndex: 9999,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "20px 30px",
              borderRadius: "10px",
              textAlign: "center",
              width: "90%",
              maxWidth: "400px",
            }}
          >
            <h3
              style={{
                color: "#2699fb",
                fontWeight: "bold",
                fontSize: "28px",
                marginBottom: "15px",
              }}
            >
              Selecciona método de pago
            </h3>
            <button
              className="sm-button"
              style={{ margin: "10px" }}
              onClick={() => continuarConPago("EFECTIVO")}
            >
              💵 Efectivo
            </button>
            <button
              className="sm-button"
              style={{ margin: "10px" }}
              onClick={() => continuarConPago("EFECTIVO_LOTE")}
            >
              💵 Efectivo (por lote)
            </button>
            <br />
            <button
              onClick={() => setShowModalPago(false)}
              className="sm-button"
              style={{ marginTop: "15px" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL TICKET BUSCADO */}
      {showModalTicket && ticketBuscado && (
        <div id="ticket-overlay" style={{ display: "flex" }}>
          <div id="ticket-modal">
            <div className="sales-summary">
              <button
                className="close-button"
                onClick={() => setShowModalTicket(false)}
              >
                <img
                  className="img-close-btn"
                  src="/images/SALIR@2x.png"
                  alt="Cerrar"
                />
              </button>
              <h1 className="title">TICKET</h1>
              <div className="table-container">
                <div className="info-row">
                  <div className="info-item">
                    <div className="info-label">TIPO</div>
                    <div className="info-value">{ticketBuscado.tipo}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">NÚMERO TICKET</div>
                    <div className="info-value">{ticketBuscado.Codigo}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">FECHA</div>
                    <div className="info-value">{ticketBuscado.date}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">HORA</div>
                    <div className="info-value">{ticketBuscado.time}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">ESTADO</div>
                    <div
                      className="info-value"
                      style={{
                        fontWeight: "bold",
                        color:
                          ticketBuscado.estado === "BOLETO SIN USAR"
                            ? "green"
                            : "red",
                      }}
                    >
                      {ticketBuscado.estado}
                    </div>
                  </div>
                </div>
              </div>
              <div className="img-qr-tk col d-flex justify-content-center align-items-center mb-3">
                {ticketBuscado.qrBase64 && (
                  <img
                    src={ticketBuscado.qrBase64}
                    alt="QR"
                    style={{
                      width: "150px",
                      height: "150px",
                      objectFit: "contain",
                    }}
                  />
                )}
              </div>
              <div className="button-container">
                <button
                  className="sm-button"
                  onClick={handleReimprimirTicketBuscado}
                >
                  REIMPRIMIR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESUMEN DE VENTAS */}
      {showModalResumen && (
        <div id="resumen-overlay" style={{ display: "flex" }}>
          <div id="resumen-modal">
            <div className="sales-summary">
              <button
                className="close-button"
                onClick={() => setShowModalResumen(false)}
              >
                <img
                  className="img-close-btn"
                  src="/images/SALIR@2x.png"
                  alt="Cerrar"
                />
              </button>
              <h1 className="title">RESUMEN DE VENTA</h1>
              <div className="table-container">
                <table>
                  <thead>
                    <tr className="text-center">
                      <th>TIPO</th>
                      <th>NÚMERO TICKET</th>
                      <th>FECHA</th>
                      <th>HORA</th>
                      <th>IMPRIMIR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((item, index) => (
                      <tr key={index} className="text-center">
                        <td>{item.tipo}</td>
                        <td>{item.Codigo}</td>
                        <td>{item.date}</td>
                        <td>{item.time}</td>
                        <td>
                          <button
                            className="print-button"
                            onClick={() => handleAbrirModalImpresion(item)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="35"
                              height="35"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="6 9 6 2 18 2 18 9"></polyline>
                              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                              <rect x="6" y="14" width="12" height="8"></rect>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPRIMIR TICKET DESDE RESUMEN */}
      {showModalPrint && ticketSeleccionado && (
        <div id="ticket-print-overlay" style={{ display: "flex" }}>
          <div id="ticket-print-modal">
            <div className="sales-summary">
              <button
                className="close-button"
                onClick={() => setShowModalPrint(false)}
              >
                <img
                  className="img-close-btn"
                  src="/images/SALIR@2x.png"
                  alt="Cerrar"
                />
              </button>
              <h1 className="title">TICKET</h1>
              <div className="table-container">
                <div className="info-row">
                  <div className="info-item">
                    <div className="info-label">TIPO</div>
                    <div className="info-value">{ticketSeleccionado.tipo}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">CÓDIGO</div>
                    <div className="info-value">
                      {ticketSeleccionado.Codigo}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">FECHA</div>
                    <div className="info-value">{ticketSeleccionado.date}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">HORA</div>
                    <div className="info-value">{ticketSeleccionado.time}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">ESTADO</div>
                    <div
                      className="info-value"
                      style={{
                        fontWeight: "bold",
                        color:
                          estadoTicketSeleccionado === "BOLETO SIN USAR"
                            ? "green"
                            : "red",
                      }}
                    >
                      {estadoTicketSeleccionado}
                    </div>
                  </div>
                </div>
              </div>
              <div className="img-qr-tk col d-flex justify-content-center align-items-center mb-3">
                {qrTicketSeleccionado && (
                  <img
                    src={qrTicketSeleccionado}
                    alt="QR"
                    style={{
                      width: "150px",
                      height: "150px",
                      objectFit: "contain",
                    }}
                  />
                )}
              </div>
              <div className="button-container">
                <button className="sm-button" onClick={handleReimprimirTicket}>
                  REIMPRIMIR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor del teclado virtual */}
      <div
        id="tecladoContainer"
        style={{
          display: "none",
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          zIndex: 9999,
          background: "#fff",
          boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.3)",
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
