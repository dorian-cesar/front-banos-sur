const contenedorQR = document.getElementById("contenedorQR");
const parrafoCodigo = document.getElementById("codigo");
const parrafoFecha = document.getElementById("fecha");
const parrafoHora = document.getElementById("hora");
const parrafoTipo = document.getElementById("tipo");
const botonesQR = document.querySelectorAll(".generarQR");

const QR = new QRCode(contenedorQR);
QR.makeCode("wit");

const urlBase = "https://andenes.terminal-calama.com";
const url = urlBase + "/TerminalCalama/PHP/Restroom/save.php";

// console.log(urlBase);

// leerDatosServer();
let datosPendientes = null;

let botonActivo = null;

let serviciosDisponibles = {}; 

// Fallbacks si la API no responde o no trae el tipo
const PRECIO_FALLBACK = { "BAÑO": 500, "DUCHA": 3500 };
const getPrecio = (tipo) => {
const api = Number(serviciosDisponibles?.[tipo]?.precio);
  return Number.isFinite(api) && api > 0 ? api : (PRECIO_FALLBACK[tipo] ?? 0);
};

async function cargarServicios() {
  try {
    const token = sessionStorage.getItem('authToken');
    if (!token) throw new Error('No se encontró token de autenticación');

    const res = await fetch('https://backend-banios.dev-wit.com/api/services', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

    const data = await res.json();

    // Ahora la API devuelve los servicios en data.data
    if (!Array.isArray(data.data)) throw new Error('Formato inesperado en respuesta de servicios');

    serviciosDisponibles = {};

    // Filtrar solo servicios con estado activo
    const serviciosActivos = data.data.filter(s => s.estado === 'activo');

    serviciosActivos.forEach(s => {
      serviciosDisponibles[s.tipo] = {
        id: s.id,
        nombre: s.nombre,
        precio: parseFloat(s.precio),
        estado: s.estado
      };
    });

    const contenedor = document.getElementById("btns-container");
    contenedor.innerHTML = "";

    Object.entries(serviciosDisponibles).forEach(([tipo, info]) => {
      const claseTipo = `btn-genera-${tipo.toLowerCase()}`;

      const btn = document.createElement("button");
      btn.className = `${claseTipo} lg-button generarQR`;
      btn.setAttribute("data-tipo", tipo);
      btn.innerHTML = `
        ${info.nombre} <br />
        <span class="precio">$${info.precio.toLocaleString("es-CL")}</span>
      `;
      contenedor.appendChild(btn);
    });

    document.querySelectorAll(".generarQR").forEach((btn) => {
      btn.addEventListener("click", (e) => {
          e.preventDefault();

          const estado_caja = localStorage.getItem('estado_caja');
          const id_aperturas_cierres = localStorage.getItem('id_aperturas_cierres');

          if (estado_caja !== 'abierta') {
              Swal.fire({
                  icon: 'warning',
                  title: 'Caja cerrada',
                  text: 'Por favor, primero debe abrir la caja antes de generar un QR.',
                  confirmButtonText: 'Entendido'
              });
              return;
          }

          const fechaHoraAct = new Date();
          const horaStr = `${fechaHoraAct.getHours().toString().padStart(2, '0')}:${fechaHoraAct.getMinutes().toString().padStart(2, '0')}:${fechaHoraAct.getSeconds().toString().padStart(2, '0')}`;
          const fechaStr = fechaHoraAct.toISOString().split("T")[0];
          const tipoStr = btn.dataset.tipo;
          const numeroT = generarTokenNumerico();
          const valor = getPrecio(tipoStr);

          datosPendientes = {
              Codigo: numeroT,
              hora: horaStr,
              fecha: fechaStr,
              tipo: tipoStr,
              valor: valor,
              id_caja: id_aperturas_cierres,
              estado_caja
          };

          botonActivo = btn;
          btn.disabled = true;
          btn.classList.add("disabled");

          document.getElementById("modalPago").style.display = "flex";
      });
  });

    console.log("Servicios activos cargados:", serviciosDisponibles);

  } catch (err) {
    console.error('Error al cargar servicios:', err);
    alert('Error al cargar servicios disponibles: ' + err.message);
  }
}

async function imprimirTicket({ Codigo, hora, fecha, tipo, valor, qrBase64, folio, cantidad }) {
  try {
    console.log("🟢 Iniciando proceso de impresión de ticket");
    console.log("📋 Datos recibidos:", { Codigo, hora, fecha, tipo, valor, folio, cantidad });

    if (!Codigo || !tipo) throw new Error("Campos requeridos faltantes");

    // ✅ Limpiar tipo (para evitar problemas con ñ, tildes o espacios)
    const tipoLimpio = tipo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/g, "n")
      .replace(/Ñ/g, "N")
      .replace(/\s+/g, "_")
      .toLowerCase();

    let folioBase = folio || null;
    let cantidadBoletas = Number(cantidad) || 1;
    const esLote = cantidadBoletas > 1;
    let esFicticia = false;

    // --- Obtener folio desde la API real ---
    if (!folioBase) {
      try {
        console.log(esLote ? "📦 Generando lote de boletas..." : "🧾 Generando boleta individual...");

        const endpoint = esLote
          ? "https://backend-banios.dev-wit.com/api/boletas/enviar-lote"
          : "https://backend-banios.dev-wit.com/api/boletas/enviar";

        const bodyData = esLote
          ? {
              nombre: tipoLimpio,
              precio: Number(valor) || 0,
              cantidad: cantidadBoletas,
              monto_total: Number(valor) * cantidadBoletas,
            }
          : {
              nombre: tipoLimpio,
              precio: Number(valor) || 0,
            };

        // ✅ Obtener el token desde sessionStorage
        const token = sessionStorage.getItem("authToken");
        if (!token) {
          throw new Error("No se encontró token de autenticación. Inicia sesión nuevamente.");
        }

        const response = await fetch(endpoint, {
          method: "POST",
      /*    headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`, // ✅ Se incluye token
          },
      */
          headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },



          body: JSON.stringify(bodyData),
        });

        const data = await response.json();
        console.log("🔍 Respuesta de API:", data);

        if (response.ok && data.folio) {
          esFicticia = data.ficticia === true;

          // 🔹 Mantener formato original del folio
          folioBase = data.folio.toString();
          cantidadBoletas = data.cantidad || cantidadBoletas;

          console.log(
            `✅ Folio base asignado: ${folioBase} | Ficticia: ${esFicticia ? "Sí" : "No"} | cantidad: ${cantidadBoletas}`
          );
        } else {
          console.warn("⚠️ API devolvió error:", data.error || "desconocido");
        }
      } catch (apiErr) {
        console.warn("❌ Error al conectar con la API de boletas:", apiErr.message);
      }
    } else {
      console.log(`📄 Usando folio base proporcionado manualmente: ${folioBase}`);
    }

    // --- Generar e imprimir cada boleta ---
    for (let i = 0; i < cantidadBoletas; i++) {
      // ✅ Calcular correlativo de folio correctamente
      let folioActual;

      // Si el folio contiene un guion, por ejemplo "412-2729"
      if (typeof folioBase === "string" && folioBase.includes("-")) {
        const [prefijo, sufijo] = folioBase.split("-");
        const baseNum = parseInt(sufijo);
        const siguiente = isNaN(baseNum) ? i : baseNum + i;
        folioActual = `${prefijo}-${siguiente}`;
      }
      // Si el folio es puramente numérico
      else if (!isNaN(Number(folioBase))) {
        folioActual = (Number(folioBase) + i).toString();
      }
      // Si no tiene formato reconocible, se usa un sufijo incremental
      else {
        folioActual = `${folioBase}-${i + 1}`;
      }

      // ✅ Cada ticket tiene un código único
      const codigoUnico = esLote ? generarTokenNumerico() : Codigo;
      console.log(`🧾 Ticket ${i + 1}/${cantidadBoletas} → Ticket ${codigoUnico} | Folio ${folioActual}`);

      const { PDFDocument, StandardFonts } = PDFLib;
      const pdfDoc = await PDFDocument.create();

      // --- Fecha formateada ---
      let fechaFormateada = "--/--/----";
      if (fecha) {
        const soloFecha = fecha.split("T")[0];
        const [anio, mes, dia] = soloFecha.split("-");
        fechaFormateada = `${dia}-${mes}-${anio}`;
      }
      const horaServidor = hora || "--:--:--";

      const lineHeight = 15;
      const altura = 500;
      const page = pdfDoc.addPage([210, altura]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 11;
      let y = altura - 20;

      // --- Encabezado ---
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

      // --- Código del ticket ---
      const codigoText = `Número Ticket : ${codigoUnico}`;
      const cw = font.widthOfTextAtSize(codigoText, fontSize);
      page.drawText(codigoText, { x: (210 - cw) / 2, y, size: fontSize, font });
      y -= lineHeight;

      // --- QR ---
      if (qrBase64) {
        const qrImage = await pdfDoc.embedPng(`data:image/png;base64,${qrBase64}`);
        const qrDims = qrImage.scale(0.5);
        page.drawImage(qrImage, {
          x: (210 - qrDims.width) / 2,
          y: y - qrDims.height,
          width: qrDims.width,
          height: qrDims.height,
        });
        y -= qrDims.height + 10;
      }

      // --- Detalle ---
      const detalle = [
        "---------------------------------------------",
        `Nº boleta : ${folioActual}`,
        `Fecha : ${fechaFormateada}`,
        `Hora  : ${horaServidor}`,
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

      // --- Convertir PDF a base64 ---
      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

      // --- Enviar a backend local para impresión ---
      const responsePrint = await fetch("http://localhost:3000/api/imprimir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },




        body: JSON.stringify({
          pdfData: pdfBase64,
          printer: "POS58",
          filename: `ticket-${codigoUnico}-${folioActual}.pdf`,
        }),
      });

      const result = await responsePrint.json();
      if (!result.success) throw new Error(result.message || "Error al imprimir");

      console.log(`✅ Ticket ${i + 1}/${cantidadBoletas} (Folio ${folioActual}) impreso correctamente`);

      // --- ⏸ Pausa para corte manual antes del siguiente ---
      if (esLote && i + 1 < cantidadBoletas && typeof pausaParaCorte === "function") {
        await pausaParaCorte(i + 1, cantidadBoletas);
      }
    }

    // --- ✅ Confirmación final ---
    if (esLote && typeof confirmarImpresionExitosa === "function") {
      await confirmarImpresionExitosa(cantidadBoletas);
    }

    console.log("🎉 Todos los tickets del lote fueron impresos correctamente");
  } catch (error) {
    console.error("🛑 Error en imprimirTicket:", error.message);
  }
}

// Llamar al cargar la página
cargarServicios();

function cerrarModalPago() {
  document.getElementById("modalPago").style.display = "none";
  if (botonActivo) {
    botonActivo.disabled = false;
    botonActivo.classList.remove("disabled");
    botonActivo = null;
  }
  datosPendientes = null;
}

async function continuarConPago(metodoPago) {
  if (!datosPendientes) return;

  const { Codigo, hora, fecha, tipo } = datosPendientes;
  const estado_caja = localStorage.getItem('estado_caja');
  const precioFinal = getPrecio(tipo);
  const id_caja = localStorage.getItem('id_aperturas_cierres');

  // 🔹 Obtener ID del usuario desde el token
  const token = sessionStorage.getItem('authToken');
  const jwtPayload = parseJwt(token);
  if (!jwtPayload?.id) {
    alert('Sesión expirada. Inicia sesión nuevamente.');
    window.location.href = '/login.html';
    return;
  }
  const id_usuario = jwtPayload.id;

  // 🔹 Validación y pago con tarjeta (POS)
  if (metodoPago === "TARJETA") {
    const monto = Math.round(Number(precioFinal) || 0);

    try {
      showSpinner();

      const res = await fetch("http://localhost:3000/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: monto, ticketNumber: Codigo }),
      });

      const contentType = res.headers.get("content-type");
      const result = contentType?.includes("application/json") ? await res.json() : null;

      if (!result?.success || !result?.data) throw new Error(result?.message || "No se recibió respuesta del POS");

      const data = result.data;

      // Validar aprobación del POS
      if (data.responseCode !== 0) {
        throw new Error(`Transacción fallida: ${data.responseMessage || "No aprobado por el POS"}`);
      }

      console.log("✅ Transacción aprobada:", {
        operationNumber: data.operationNumber,
        authorizationCode: data.authorizationCode,
        amount: data.amount,
        last4Digits: data.last4Digits,
        cardType: data.cardType,
        cardBrand: data.cardBrand
      });

      // Generar QR y registrar movimiento local
      QR.makeCode(Codigo);
      await new Promise(resolve => setTimeout(resolve, 500));
      const qrCanvas = contenedorQR.querySelector("canvas");
      const qrBase64 = qrCanvas ? qrCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "") : "";

      await callApi({ Codigo, hora, fecha, tipo, valor: precioFinal });

      await fetch('http://localhost:3000/api/caja/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: Codigo,
          fecha,
          hora,
          tipo,
          valor: precioFinal,
          metodoPago,
          estado_caja,
          id_usuario,
          id_caja,
          operationNumber: data.operationNumber,
          authorizationCode: data.authorizationCode,
          last4Digits: data.last4Digits,
          cardType: data.cardType,
          cardBrand: data.cardBrand
        })
      });

      await imprimirTicket({ Codigo, hora, fecha, tipo, valor: precioFinal, qrBase64 });

      try {
        addUser(Codigo);
        setTimeout(() => addUserAccessLevel(Codigo.substring(0, 6)), 1000);
      } catch (e) {
        console.warn("ZKTeco: no se pudo registrar acceso para", Codigo, e);
      }

    } catch (err) {
      console.error("❌ Error durante el pago:", err);
      Swal.fire({
        icon: "error",
        title: "Pago fallido",
        text: err.message || "No se pudo completar el pago con tarjeta.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
      hideSpinner();
      cerrarModalPago();
      return;
    }
  }

  // 🔹 Mostrar datos en interfaz
  parrafoFecha.textContent = fecha;
  parrafoHora.textContent = hora;
  parrafoTipo.textContent = `${tipo} (${metodoPago})`;
  parrafoCodigo.textContent = Codigo;

  showSpinner();

  // 🔹 Flujo según método de pago
  if (metodoPago === "EFECTIVO") {
    const now = new Date();
    const horaI = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    const fechaI = now.toISOString().split("T")[0];
    const codigoI = generarTokenNumerico();

    QR.makeCode(codigoI);
    await new Promise(resolve => setTimeout(resolve, 500));
    const qrCanvas = contenedorQR.querySelector("canvas");
    const qrBase64 = qrCanvas ? qrCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/,"") : "";

    await callApi({ Codigo, hora, fecha, tipo, valor: precioFinal, medio_pago: metodoPago });

    await fetch('http://localhost:3000/api/caja/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: codigoI,
        fecha: fechaI,
        hora: horaI,
        tipo,
        valor: precioFinal,
        metodoPago,
        estado_caja,
        id_usuario,
        id_caja
      })
    });

    await imprimirTicket({ Codigo: codigoI, hora: horaI, fecha: fechaI, tipo, valor: precioFinal, qrBase64 });

    try {
      addUser(codigoI);
      setTimeout(() => addUserAccessLevel(codigoI.substring(0, 6)), 1000);
    } catch (e) {
      console.warn("ZKTeco: no se pudo registrar acceso para", codigoI, e);
    }

  } else if (metodoPago === "EFECTIVO_LOTE") {
  const cantidad = await seleccionarCantidadTicketsAccesible();
  if (!cantidad || cantidad <= 0) {
    hideSpinner();
    cerrarModalPago();
    return;
  }

  const now = new Date();
  const horaI = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  const fechaI = now.toISOString().split("T")[0];

  // ✅ Obtener id_aperturas_cierres desde localStorage
  const id_aperturas_cierres = localStorage.getItem('id_aperturas_cierres');

  let folioBase = null;
  let ficticiaLote = false;
  try {
    const resLote = await fetch("https://backend-banios.dev-wit.com/api/boletas/enviar-lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: tipo,
        precio: Number(precioFinal) || 0,
        cantidad: Number(cantidad),
        monto_total: (Number(precioFinal) || 0) * Number(cantidad)
      })
    });
    const loteData = await resLote.json();
    console.log("🔍 Respuesta enviar-lote:", loteData);

    if (!resLote.ok || !loteData?.folio) {
      throw new Error(loteData?.error || "No se recibió folio base del lote");
    }
    folioBase = loteData.folio.toString();
    ficticiaLote = loteData.ficticia === true;
  } catch (e) {
    console.error("❌ Error al solicitar enviar-lote:", e);
    Swal.fire({
      icon: "error",
      title: "Error al emitir boletas",
      text: e.message || "No fue posible obtener folios del SII.",
      customClass: { popup: "alert-card", title: "swal-font", confirmButton: "my-confirm-btn" },
      buttonsStyling: false
    });
    hideSpinner();
    cerrarModalPago();
    return;
  }

  await fetch("http://localhost:3000/api/caja/movimientos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codigo: `LOTE-${Date.now()}`,
      fecha: fechaI,
      hora: horaI,
      tipo,
      valor: (Number(precioFinal) || 0) * Number(cantidad),
      metodoPago: "EFECTIVO",
      estado_caja,
      id_usuario,
      id_caja: id_aperturas_cierres // ✅ Enviar id_aperturas_cierres como id_caja
    }),
  });

  const computeFolioCorrelativo = (base, offset) => {
    if (typeof base === "string" && base.includes("-")) {
      const parts = base.split("-");
      const sufijo = parts.pop();
      const prefijo = parts.join("-");
      const n = parseInt(sufijo);
      const next = isNaN(n) ? offset + 1 : n + offset;
      return `${prefijo}-${next}`;
    } else if (!isNaN(Number(base))) {
      return (Number(base) + offset).toString();
    }
    return `${base}-${offset + 1}`;
  };

  for (let i = 0; i < Number(cantidad); i++) {
    const codigoI = generarTokenNumerico();
    QR.makeCode(codigoI);
    await new Promise(resolve => setTimeout(resolve, 400));
    const qrCanvasI = contenedorQR.querySelector("canvas");
    const qrBase64I = qrCanvasI ? qrCanvasI.toDataURL("image/png").replace(/^data:image\/png;base64,/, "") : "";

    // ✅ CORRECCIÓN: Enviar id_aperturas_cierres como id_caja al save.php
    await callApi({ 
      Codigo: codigoI, 
      hora: horaI, 
      fecha: fechaI, 
      tipo, 
      valor: precioFinal, 
      id_caja: id_aperturas_cierres, // ✅ Esto es lo que save.php espera
      medio_pago: metodoPago 
    });

    const folioActual = computeFolioCorrelativo(folioBase, i);

    await imprimirTicket({
      Codigo: codigoI,
      hora: horaI,
      fecha: fechaI,
      tipo,
      valor: precioFinal,
      qrBase64: qrBase64I,
      folio: folioActual,
      cantidad: 1
    });

    if (i + 1 < Number(cantidad) && typeof pausaParaCorte === "function") {
      await pausaParaCorte(i + 1, Number(cantidad));
    }

    try {
      addUser(codigoI);
      setTimeout(() => addUserAccessLevel(codigoI.substring(0, 6)), 1000);
    } catch (e) {
      console.warn("ZKTeco: no se pudo registrar acceso para", codigoI, e);
    }
  }

  if (typeof confirmarImpresionExitosa === "function") {
    await confirmarImpresionExitosa(Number(cantidad));
  }
}

  if (botonActivo) {
    botonActivo.disabled = false;
    botonActivo.classList.remove("disabled");
    botonActivo = null;
  }

  document.getElementById("modalPago").style.display = "none";
  datosPendientes = null;
  hideSpinner();

  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
      return JSON.parse(jsonPayload);
    } catch (err) {
      console.error('Token inválido:', err);
      return null;
    }
  }
}

// 3.1) Modal accesible para elegir cantidad
async function seleccionarCantidadTicketsAccesible() {
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
      <input id="cantidadManual" type="number" min="1" max="25" class="cantidad-manual" aria-label="Cantidad manual" />
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Aceptar",
    cancelButtonText: "Cancelar",
    customClass: {
      popup: "alert-card",
      title: "swal-font",
      confirmButton: "my-confirm-btn",
      cancelButton: "my-cancel-btn"
    },
    buttonsStyling: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      const grid = Swal.getHtmlContainer().querySelector(".cantidad-grid");
      grid.querySelectorAll(".cantidad-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          grid.querySelectorAll(".cantidad-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
        });
      });
      const manual = Swal.getHtmlContainer().querySelector("#cantidadManual");
      manual.addEventListener("focus", () => {
        grid.querySelectorAll(".cantidad-btn").forEach(b => b.classList.remove("selected"));
      });
    },
    preConfirm: () => {
      const manual = Number(Swal.getHtmlContainer().querySelector("#cantidadManual").value);
      const selectedBtn = Swal.getHtmlContainer().querySelector(".cantidad-btn.selected");
      const quick = selectedBtn ? Number(selectedBtn.dataset.value) : null;
      
      if (manual && manual > 0 && manual <= 25) return manual;
      if (quick && quick > 0) return quick;
      
      Swal.showValidationMessage("Seleccione una cantidad válida (1 a 25).");
      return false;
    }
  }).then(r => r.isConfirmed ? Number(r.value) : null);
}

// 3.2) Pausa para corte manual (entre tickets)
async function pausaParaCorte(indice, total) {
  return Swal.fire({
    title: `✂️ Corte el boleto (${indice}/${total})`,
    text: "Cuando lo haya cortado, presione Continuar.",
    icon: "info",
    confirmButtonText: "Continuar impresión",
    customClass: {
      popup: "alert-card",
      title: "swal-font",
      confirmButton: "my-confirm-btn"
    },
    buttonsStyling: false,
    allowOutsideClick: false,
    allowEscapeKey: false
  });
}

// 3.3) Confirmación final
async function confirmarImpresionExitosa(total) {
  return Swal.fire({
    icon: "success",
    title: "🎉 ¡Boletos impresos!",
    text: `Se imprimieron ${total} boletos correctamente.`,
    confirmButtonText: "Finalizar",
    customClass: {
      popup: "alert-card",
      title: "swal-font",
      confirmButton: "my-confirm-btn"
    },
    buttonsStyling: false
  });
}

function generarTokenNumerico() {
  let token = (Math.floor(Math.random() * 9) + 1).toString();
  for (let i = 1; i < 10; i++) {
    token += Math.floor(Math.random() * 10);
  }
  return token;
}

function escribirTexto() {
  contenedorContador.innerHTML = "texto";
}

async function callApi(datos) {
  // ✅ Asegurar que siempre se incluya id_caja desde localStorage
  const id_caja = localStorage.getItem('id_aperturas_cierres');
  const payload = {
    ...datos,
    id_caja: datos.id_caja ?? id_caja ?? null
  };

  console.log("📦 Enviando datos a save.php:", payload);

  try {
    const response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const result = await response.text();
    console.log("✅ Respuesta del servidor:", result);
    return result;
  } catch (error) {
    console.error("❌ Error al enviar la solicitud:", error);
    return null;
  }
}


function printQR() {
  const ventanaImpr = window.open("", "_blank");

  // Obtenemos la fecha y hora actual
  const dateAct = new Date();
  const horaStr =
    dateAct.getHours().toString().padStart(2, "0") +
    ":" +
    dateAct.getMinutes().toString().padStart(2, "0") +
    ":" +
    dateAct.getSeconds().toString().padStart(2, "0");
  const fechaStr = dateAct.toISOString().split("T")[0];

  // Obtener el código QR generado
  const codigoQR = document.getElementById("keycont").value;
  const tipoSeleccionado = document.querySelector(
    'input[name="tipo"]:checked'
  ).value;

  if (!codigoQR) {
    alert("No hay código QR generado para imprimir.");
    return;
  }
  
  const precio =
    (serviciosDisponibles?.[tipoSeleccionado]?.precio ?? datosPendientes?.valor ?? null) != null
      ? `$${Number((serviciosDisponibles?.[tipoSeleccionado]?.precio ?? datosPendientes?.valor)).toLocaleString("es-CL")}`
      : "No definido";

  ventanaImpr.document.write(`
        <html>
            <head>
                <title>Imprimir QR</title>
                <style>
                    body { text-align: center; font-family: Arial, sans-serif; }
                    h1, h3 { margin: 5px; }
                    .qr-container { display: flex; justify-content: center; margin-top: 10px; }
                    .close-btn {
                        background-color: red;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-top: 20px;
                        border-radius: 5px;
                    }
                    .close-btn:hover {
                        background-color: darkred;
                    }
                    @media print {
                        .close-btn {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body onload="window.print(); setTimeout(() => window.close(), 500);">
                <h1>Ticket de Acceso</h1>
                <h3>Fecha: ${fechaStr}</h3>
                <h3>Hora: ${horaStr}</h3>
                <h3>Tipo: ${tipoSeleccionado}</h3>
                <h3>Precio: ${precio}</h3>
                <h3>Código: ${codigoQR}</h3>
                <div class="qr-container">
                    ${document.getElementById("contenedorQR").innerHTML}
                </div>
                <button type="button" class="close-btn" onclick="window.close();">Cerrar</button>
            </body>
        </html>
    `);
  ventanaImpr.document.close();
}

async function addUser(token) {
  const url = urlBase + "/TerminalCalama/PHP/Restroom/addUser.php";

  const userData = { pin: token, idNo: token };

  try {
    let response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    let result = await response.text(); // Esperar a que la respuesta se convierta en texto
    console.log("Respuesta de addUser:", result);
  } catch (error) {
    console.error("Error al agregar usuario:", error);
  }
}

// Función para asignar niveles de acceso al usuario
async function addUserAccessLevel(token) {
  const url = urlBase + "/TerminalCalama/PHP/Restroom/addLevelUser2.php";
  const accessData = { pin: token };

  try {
    let response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(accessData),
    });

    let result = await response.text();
    console.log("Respuesta de addLevelUser2:", result);
  } catch (error) {
    console.error("Error al asignar niveles de acceso:", error);
  }
}

// Eventos para botones de pago
document.getElementById("btnPagoEfectivo").addEventListener("click", () => {
  continuarConPago("EFECTIVO");
});

document.getElementById("btnPagoTarjeta").addEventListener("click", () => {
  continuarConPago("TARJETA");
});

document.getElementById("btnPagoEfectivoLote").addEventListener("click", () => {
  continuarConPago("EFECTIVO_LOTE");
});