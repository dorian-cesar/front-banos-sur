document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('authToken');
  const usuarioJSON = sessionStorage.getItem('usuario');

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

  if (!token || !usuarioJSON) {
    alert('Debes iniciar sesión primero.');
    window.location.href = '/login.html';
    return;
  }

  let usuario;
  try {
    usuario = JSON.parse(usuarioJSON);
  } catch (e) {
    console.error('Error al parsear usuario:', e);
    sessionStorage.clear();
    window.location.href = '/login.html';
    return;
  }

  // Validación extra por si el objeto está mal formado
  if (!usuario.username || !usuario.email || !usuario.role) {
    alert('Datos de usuario inválidos. Inicia sesión nuevamente.');
    sessionStorage.clear();
    window.location.href = '/login.html';
    return;
  }

  const payload = parseJwt(token);
  if (!payload || !payload.id) {
    alert('Token inválido. Vuelve a iniciar sesión.');
    sessionStorage.clear();
    window.location.href = '/login.html';
    return;
  }

  // VERIFICACIÓN DE USUARIO VS APERTURA DE CAJA
  const idUsuarioApertura = localStorage.getItem('id_usuario_apertura');
  const estadoCaja = localStorage.getItem('estado_caja');

  // DEBUG: Mostrar valores para verificación
  console.log('ID Usuario Apertura (localStorage):', idUsuarioApertura, 'Tipo:', typeof idUsuarioApertura);
  console.log('ID Usuario Actual (token):', payload.id, 'Tipo:', typeof payload.id);
  console.log('¿Coinciden?', parseInt(idUsuarioApertura) === parseInt(payload.id));

  // Convertir ambos a número para comparación correcta
  const idAperturaNum = parseInt(idUsuarioApertura);
  const idUsuarioNum = parseInt(payload.id);

  // Si hay una caja abierta y el usuario que la abrió no es el mismo que inició sesión
  if (estadoCaja === 'abierta' && idUsuarioApertura && idAperturaNum !== idUsuarioNum) {
    // Obtener información del usuario que abrió la caja
    fetch(`https://backend-banios.dev-wit.com/api/users/${idUsuarioApertura}`, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al obtener usuario: ' + response.status);
      }
      return response.json();
    })
    .then(usuarioApertura => {
      Swal.fire({
        icon: 'warning',
        title: 'Usuario incorrecto',
        html: `La caja fue abierta por el usuario: <strong>${usuarioApertura.nombre || usuarioApertura.username}</strong>.<br>
              Debes cerrar la caja con el usuario correspondiente antes de continuar.`,
        confirmButtonText: 'Entendido',
        customClass: {
          title: 'swal-font',
          htmlContainer: 'swal-font',
          popup: 'alert-card',
          confirmButton: 'swal-confirm-btn', // Cambiado a una clase más específica
        },
        buttonsStyling: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        // Cerrar sesión forzadamente
        sessionStorage.clear();
        window.location.href = '/login.html';
      });
    })
    .catch(error => {
      console.error('Error al obtener información del usuario:', error);
      // Mostrar mensaje alternativo sin información del usuario
      Swal.fire({
        icon: 'warning',
        title: 'Usuario incorrecto',
        html: `La caja fue abierta por otro usuario (ID: ${idUsuarioApertura}).<br>
              Debes cerrar la caja con el usuario correspondiente antes de continuar.`,
        confirmButtonText: 'Entendido',
        customClass: {
          title: 'swal-font',
          htmlContainer: 'swal-font',
          popup: 'alert-card',
          confirmButton: 'swal-confirm-btn', // Cambiado a una clase más específica
        },
        buttonsStyling: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        sessionStorage.clear();
        window.location.href = '/login.html';
      });
    });
    
    // Detener la ejecución del resto del código
    return;
  }

  // Si llegamos aquí, la verificación fue exitosa o no hay caja abierta
  console.log('Verificación de caja: OK');
});

document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("ticket-overlay");
  const inputField = document.getElementById("ticketInput");
  const closeBtn = document.querySelector(".close-button");
  const reimprimirBtn2 = document.getElementById("reimprimirBtn2");
  const searchBtn = document.getElementById("searchTicketBtn");
  // const url = urlBase + "/TerminalCalama/PHP/Restroom/load.php";

  const tipoEl = modal.querySelector(".info-item:nth-child(1) .info-value");
  const codigoEl = modal.querySelector(".info-item:nth-child(2) .info-value");
  const fechaEl = modal.querySelector(".info-item:nth-child(3) .info-value");
  const horaEl = modal.querySelector(".info-item:nth-child(4) .info-value");
  const estadoEl = modal.querySelector(".info-item:nth-child(5) .info-value");

  searchBtn.addEventListener("click", async function () {
    const codigo = inputField.value.trim();

    if (!/^\d{10}$/.test(codigo)) {
      Swal.fire({
        icon: "warning",
        title: "Código inválido",
        text: "El código debe contener exactamente 10 números.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
      return;
    }

    if (!codigo) return;

    showSpinner();

    const userPin = codigo.slice(0, 6);

    const url = `${urlBase}/TerminalCalama/PHP/Restroom/getCodigo.php?codigo=${codigo}`;
    const urlEstado = `${urlBase}/TerminalCalama/PHP/Restroom/estadoBoleto.php?userPin=${userPin}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const ticket = data.find((t) => t.Codigo === codigo);
      console.log(ticket);

      const resEstado = await fetch(urlEstado);
      const dataEstado = await resEstado.json();
      let estadoTicket = dataEstado.message || "No encontrado";
      estadoTicket = estadoTicket.toUpperCase().replace(/\.$/, "");

      estadoEl.textContent = estadoTicket;
      estadoEl.style.fontWeight = "bold";

      if (estadoTicket === "BOLETO SIN USAR") {
        estadoEl.style.color = "green";
      } else {
        estadoEl.style.color = "red";
      }

      if (ticket) {
        tipoEl.textContent = ticket.tipo;
        codigoEl.textContent = ticket.Codigo;
        fechaEl.textContent = ticket.date;
        horaEl.textContent = ticket.time;

        const numeroT = ticket.Codigo;

        const contenedorTicketQR2 = document.getElementById(
          "contenedorTicketQR2"
        );
        contenedorTicketQR2.innerHTML = "";

        const qr = new QRCode(contenedorTicketQR2, {
          text: numeroT,
        });

        modal.style.display = "flex";
      } else {
        Swal.fire({
          icon: "error",
          title: "No encontrado",
          text: "No se encontró ningún ticket con ese código.",
          customClass: {
            title: "swal-font",
            htmlContainer: "swal-font",
            popup: "alert-card",
            confirmButton: "my-confirm-btn",
          },
          buttonsStyling: false,
        });
        modal.style.display = "none";
      }
    } catch (err) {
      console.error("Error al buscar ticket:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al buscar el ticket. Intenta nuevamente.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
    } finally {
      hideSpinner();
    }
  });

  closeBtn.addEventListener("click", function () {
    modal.style.display = "none";
    inputField.value = "";
  });

  window.addEventListener("click", function (event) {
    if (event.target === modal) {
      modal.style.display = "none";
      inputField.value = "";
    }
  });

  // Variable para controlar impresión del segundo modal
  let isPrinting2 = false;

  reimprimirBtn2.addEventListener("click", async function () {
    if (isPrinting2) return;
    isPrinting2 = true;

    const codigo = document.querySelector(".info-item:nth-child(2) .info-value").textContent.trim();
    const tipo = document.querySelector(".info-item:nth-child(1) .info-value").textContent.trim();
    const fecha = document.querySelector(".info-item:nth-child(3) .info-value").textContent.trim();
    const hora = document.querySelector(".info-item:nth-child(4) .info-value").textContent.trim();
    const estado = document.querySelector(".info-item:nth-child(5) .info-value").textContent.trim().toUpperCase();

    if (estado !== "BOLETO SIN USAR") {
      Swal.fire({
        icon: "warning",
        title: "Reimpresión no permitida",
        text: "No se puede reimprimir un boleto que ya ha sido ocupado.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
      isPrinting2 = false;
      return;
    }

    showSpinner();

    try {
      const contenedorQR = document.getElementById("contenedorTicketQR2");
      const qrCanvas = contenedorQR.querySelector("canvas");
      let qrBase64 = "";
      if (qrCanvas) {
        qrBase64 = qrCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
      }

      const payload = { Codigo: codigo, tipo, fecha, hora, qrBase64 };

      await reimprimirTicket(payload);

      Swal.fire({
        icon: "success",
        title: "Reimpresión enviada",
        text: `El ticket ${codigo} ha sido enviado a impresión.`,
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });

    } catch (err) {
      console.error("Error al imprimir:", err);
      Swal.fire({
        icon: "error",
        title: "Error al imprimir",
        text: err.message || "No se pudo imprimir el ticket.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
    } finally {
      hideSpinner();
      isPrinting2 = false;
    }
  });

  function openResumen() {
    const modal = document.getElementById("resumen-overlay");
    // const spinner = document.getElementById("spinner");

    showSpinner();
    cargarTabla().then(() => {
      hideSpinner();
      modal.style.display = "flex";
    });
  }

  function cargarTabla() {
    const endpointURL = urlBase + "/TerminalCalama/PHP/Restroom/load.php";
    const tableBody = document.getElementById("sales-table-body");

    tableBody.innerHTML = "";

    return fetch(endpointURL)
      .then((response) => response.json())
      .then((data) => {
        const ordenado = data.sort((a, b) => {
          const fechaA = new Date(`${a.date} ${a.time}`);
          const fechaB = new Date(`${b.date} ${b.time}`);
          return fechaB - fechaA;
        });

        const ultimos = ordenado.slice(0, 8);

        ultimos.forEach((item) => {
          const row = document.createElement("tr");

          const tipoCell = document.createElement("td");
          tipoCell.textContent = item.tipo;
          row.appendChild(tipoCell);

          const codigoCell = document.createElement("td");
          codigoCell.textContent = item.Codigo;
          row.appendChild(codigoCell);

          const fechaCell = document.createElement("td");
          fechaCell.textContent = item.date;
          row.appendChild(fechaCell);

          const horaCell = document.createElement("td");
          horaCell.textContent = item.time;
          row.appendChild(horaCell);

          const printCell = document.createElement("td");
          printCell.style.textAlign = "center";

          const printButton = document.createElement("button");
          printButton.className = "print-button";
          printButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
          `;
          
          // Event listener para el botón de imprimir
          printButton.addEventListener("click", function () {
            abrirModalImpresion(item);
          });

          printCell.appendChild(printButton);
          row.appendChild(printCell);
          tableBody.appendChild(row);
        });
      })
      .catch((error) => {
        console.error("Error al obtener datos:", error);
      });
  }

  // Variable para controlar si ya se está imprimiendo
  let isPrinting = false;

  // Función para abrir el modal de impresión
  function abrirModalImpresion(item) {
    const overlay = document.getElementById("ticket-print-overlay");
    const modal = document.getElementById("ticket-print-modal");
    const modalResume = document.getElementById("resumen-overlay");
    modalResume.style.display = "none";
    overlay.style.display = "none";

    showSpinner();

    const userPin = item.Codigo.slice(0, 6);
    const urlEstado = `${urlBase}/TerminalCalama/PHP/Restroom/estadoBoleto.php?userPin=${userPin}`;

    fetch(urlEstado)
      .then(resEstado => {
        if (!resEstado.ok) {
          throw new Error("Error al obtener estado del boleto.");
        }
        return resEstado.json();
      })
      .then(dataEstado => {
        let estadoTicket = dataEstado.message || "No encontrado";
        estadoTicket = estadoTicket.toUpperCase().replace(/\.$/, "");

        const infoItems = modal.querySelectorAll(".info-item");
        infoItems.forEach((infoItem) => {
          const label = infoItem
            .querySelector(".info-label")
            .textContent.trim();
          const value = infoItem.querySelector(".info-value");

          if (label === "ESTADO") {
            value.textContent = estadoTicket;
            value.style.fontWeight = "bold";
            if (estadoTicket === "EL BOLETO HA SIDO OCUPADO") {
              value.style.color = "red";
            } else {
              value.style.color = "green";
            }
          }

          if (label === "TIPO") value.textContent = item.tipo;
          if (label === "CÓDIGO") value.textContent = item.Codigo;
          if (label === "FECHA") value.textContent = item.date;
          if (label === "HORA") value.textContent = item.time;
        });

        const numeroT = item.Codigo;
        const contenedorTicketQR1 = document.getElementById("contenedorTicketQR1");
        contenedorTicketQR1.innerHTML = "";
        new QRCode(contenedorTicketQR1, {
          text: numeroT,
        });

        // Configurar el evento de reimpresión una sola vez
        const reimprimirBtn1 = document.getElementById("reimprimirBtn1");
        
        // Remover event listeners previos para evitar duplicados
        const newReimprimirBtn = reimprimirBtn1.cloneNode(true);
        reimprimirBtn1.parentNode.replaceChild(newReimprimirBtn, reimprimirBtn1);
        
        // Agregar el nuevo event listener
        newReimprimirBtn.addEventListener("click", function() {
          manejarReimpresion(item, estadoTicket, contenedorTicketQR1);
        });

        hideSpinner();
        overlay.style.display = "flex";
      })
      .catch(error => {
        console.error("Error:", error);
        hideSpinner();
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo cargar la información del ticket.",
          customClass: {
            title: "swal-font",
            htmlContainer: "swal-font",
            popup: "alert-card",
            confirmButton: "my-confirm-btn",
          },
          buttonsStyling: false,
        });
      });
  }

  // Función para manejar la reimpresión
  async function manejarReimpresion(item, estadoTicket, contenedorTicketQR1) {
    if (estadoTicket !== "BOLETO SIN USAR") {
      Swal.fire({
        icon: "warning",
        title: "No permitido",
        text: "Solo se pueden reimprimir boletos sin usar.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
      return;
    }

    if (isPrinting) return;
    isPrinting = true;

    showSpinner();

    try {
      // 🔹 Obtener QR ya renderizado en pantalla
      const qrCanvas = contenedorTicketQR1.querySelector("canvas");
      let qrBase64 = "";
      if (qrCanvas) {
        qrBase64 = qrCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
      }

      // 🔹 Payload para el ticket
      const payload = {
        Codigo: item.Codigo,
        fecha: item.date,
        hora: item.time,
        tipo: item.tipo,
        valor: item.valor,
        qrBase64,
      };

      // 🔹 Generar comprobante en el front y enviarlo a impresión
      await reimprimirTicket(payload);

      Swal.fire({
        icon: "success",
        title: "Reimpresión enviada",
        text: `El ticket ${item.Codigo} ha sido enviado a impresión.`,
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
    } catch (err) {
      console.error("Error al imprimir:", err);
      Swal.fire({
        icon: "error",
        title: "Error al imprimir",
        text: err.message || "No se pudo imprimir el ticket.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
    } finally {
      hideSpinner();
      isPrinting = false;
    }
  }

  document
    .getElementById("resumen-overlay")
    .addEventListener("click", function (e) {
      if (e.target.id === "resumen-overlay") {
        closeResumen();
      }
    });

  document
    .getElementById("resumen-button")
    .addEventListener("click", openResumen);

  document
    .getElementById("ticket-print-overlay")
    .addEventListener("click", function (e) {
      if (e.target.id === "ticket-print-overlay") {
        closeTicketModal();
      }
    });
});

function closeResumen() {
  const modal = document.getElementById("resumen-overlay");
  modal.style.display = "none";
}

function closeTicketModal() {
  document.getElementById("ticket-print-overlay").style.display = "none";
}
// animacion codigo qr
let rotation = 0;

function rotateQR() {
  rotation += 90;
  document.querySelector(".img-qr").style.transform = `rotate(${rotation}deg)`;
}

document.querySelector(".btn-genera-baño").addEventListener("click", rotateQR);
document.querySelector(".btn-genera-ducha").addEventListener("click", rotateQR);

// spinner
function showSpinner() {
  const spinner = document.getElementById("spinner");
  if (spinner) {
    spinner.style.display = "flex";
  }
}

function hideSpinner() {
  const spinner = document.getElementById("spinner");
  if (spinner) {
    spinner.style.display = "none";
  }
}

async function reimprimirTicket({ Codigo, hora, fecha, tipo, valor, qrBase64 }) {
  try {
    console.log("🟢 Iniciando proceso de REIMPRESIÓN de ticket");
    const { PDFDocument, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    // Formatear fecha
    const fechaObj = new Date(fecha);
    const dia = String(fechaObj.getDate()).padStart(2, "0");
    const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
    const anio = String(fechaObj.getFullYear());
    const fechaFormateada = `${dia}-${mes}-${anio}`;

    // Altura dinámica
    const lineHeight = 15;
    const qrHeight = 120;
    let altura = 500;
    const page = pdfDoc.addPage([210, altura]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;

    let y = altura - 20;

    // --- Encabezado ---
    const encabezado = ["REIMPRESIÓN", "---------------------------------------------"];
    encabezado.forEach(line => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, { x: (210 - textWidth) / 2, y, size: fontSize, font });
      y -= lineHeight;
    });

    // --- Código del ticket ---
    const codigoText = `Código : ${Codigo}`;
    const codigoWidth = font.widthOfTextAtSize(codigoText, fontSize);
    page.drawText(codigoText, { x: (210 - codigoWidth) / 2, y, size: fontSize, font });
    y -= lineHeight;

    // --- QR ---
    if (qrBase64) {
      const qrImage = await pdfDoc.embedPng(`data:image/png;base64,${qrBase64}`);
      const qrDims = qrImage.scale(0.5);
      page.drawImage(qrImage, {
        x: (210 - qrDims.width) / 2,
        y: y - qrHeight,
        width: qrDims.width,
        height: qrDims.height,
      });
      y = y - qrHeight - 10;
    }

    // --- Detalle ---
    const detalle = [
      "---------------------------------------------",
      `Fecha : ${fechaFormateada}`,
      `Hora  : ${hora}`,
      `Tipo  : ${tipo}`,
      valor ? `Monto : $${valor}` : null,
      "---------------------------------------------",
    ].filter(Boolean);
    detalle.forEach(line => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, { x: (210 - textWidth) / 2, y, size: fontSize, font });
      y -= lineHeight;
    });

    // --- Footer ---
    const footer = ["COMPROBANTE DE REIMPRESIÓN", "Válido solo como comprobante"];
    footer.forEach(line => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, { x: (210 - textWidth) / 2, y, size: fontSize, font });
      y -= lineHeight;
    });

    // Guardar y enviar a impresión
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    const res = await fetch("http://localhost:3000/api/imprimir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfData: pdfBase64,
        printer: "POS58",
        filename: `reimpresion-${Codigo}-${Date.now()}.pdf`,
      }),
    });

    const result = await res.json();
    if (!result.success) throw new Error(result.message || "Error al imprimir");

    console.log("✅ Reimpresión enviada correctamente");
  } catch (error) {
    console.error("🛑 Error en reimprimirTicket:", error.message);
  }
}