'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import Swal from 'sweetalert2';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export default function CajaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [datosCaja, setDatosCaja] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  
  // Totales
  const [totales, setTotales] = useState({
    inicial: 0,
    efectivo: 0,
    tarjeta: 0,
    retiros: 0,
    balance: 0,
  });

  // Modales states
  const [showModalInicio, setShowModalInicio] = useState(false);
  const [showModalAuthCierre, setShowModalAuthCierre] = useState(false);
  const [showModalAuthAdmin, setShowModalAuthAdmin] = useState(false);
  const [showModalRetiro, setShowModalRetiro] = useState(false);

  // Forms states
  const [montoInicial, setMontoInicial] = useState('');
  const [observacionesCaja, setObservacionesCaja] = useState('');
  const [cierreUsername, setCierreUsername] = useState('');
  const [cierrePassword, setCierrePassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [montoRetiro, setMontoRetiro] = useState('');
  const [motivoRetiro, setMotivoRetiro] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingCaja, setLoadingCaja] = useState(true);
  const [adminAutorizado, setAdminAutorizado] = useState(null);

  // Refs para inputs y teclado
  const montoInicialRef = useRef(null);
  const observacionesRef = useRef(null);
  const cierreUsernameRef = useRef(null);
  const cierrePasswordRef = useRef(null);
  const adminUsernameRef = useRef(null);
  const adminPasswordRef = useRef(null);
  const montoRetiroRef = useRef(null);
  const motivoRetiroRef = useRef(null);

  const [numeroCaja, setNumeroCaja] = useState('');
  // Proxy local — agrega el token automáticamente desde la cookie HttpOnly
  const backendUrl = '/api/proxy';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userRaw = sessionStorage.getItem('usuario');
      if (!userRaw) {
        router.push('/login');
        return;
      }
      setUsuario(JSON.parse(userRaw));

      const savedCaja = localStorage.getItem('numero_caja') || '';
      setNumeroCaja(savedCaja);

      cargarCaja(savedCaja);
    }
  }, []);

  const initTecladoListeners = () => {
    if (typeof window !== 'undefined' && window.tecladoVirtual) {
      window.tecladoVirtual.init();

      const setupTecladoInput = (ref, setter) => {
        if (ref.current) {
          ref.current.addEventListener('focus', () => {
            window.tecladoVirtual.show(ref.current);
            const interval = setInterval(() => {
              if (ref.current === document.activeElement) {
                setter(ref.current.value);
              } else {
                clearInterval(interval);
              }
            }, 100);
          });
        }
      };

      setupTecladoInput(montoInicialRef, setMontoInicial);
      setupTecladoInput(observacionesRef, setObservacionesCaja);
      setupTecladoInput(cierreUsernameRef, setCierreUsername);
      setupTecladoInput(cierrePasswordRef, setCierrePassword);
      setupTecladoInput(adminUsernameRef, setAdminUsername);
      setupTecladoInput(adminPasswordRef, setAdminPassword);
      setupTecladoInput(montoRetiroRef, setMontoRetiro);
      setupTecladoInput(motivoRetiroRef, setMotivoRetiro);
    }
  };

  const calcularTotales = (movs, inicial = 0) => {
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalRetiros = 0;

    movs.forEach((m) => {
      const monto = parseFloat(m.monto) || 0;
      const esRetiro =
        m.tipo_servicio === 'RETIRO' ||
        (m.medio_pago && m.medio_pago.toLowerCase().includes('retiro')) ||
        (m.nombre_servicio && m.nombre_servicio.toLowerCase().includes('retiro'));

      if (esRetiro) {
        totalRetiros += Math.abs(monto);
      } else if (m.medio_pago && m.medio_pago.toLowerCase().includes('efectivo')) {
        totalEfectivo += monto;
      } else if (
        m.medio_pago &&
        (m.medio_pago.toLowerCase().includes('tarjeta') ||
          m.medio_pago.toLowerCase().includes('débito') ||
          m.medio_pago.toLowerCase().includes('crédito'))
      ) {
        totalTarjeta += monto;
      }
    });

    const balance = parseFloat(inicial) + totalEfectivo - totalRetiros;
    setTotales({
      inicial: parseFloat(inicial),
      efectivo: totalEfectivo,
      tarjeta: totalTarjeta,
      retiros: totalRetiros,
      balance,
    });
  };

  const cargarCaja = async (cajaNum) => {
    const idAperturaCierre = localStorage.getItem('id_aperturas_cierres');
    const estado = localStorage.getItem('estado_caja');
    const activeCaja = cajaNum || localStorage.getItem('numero_caja') || '';

    if (!idAperturaCierre || estado !== 'abierta') {
      setCajaAbierta(false);
      setDatosCaja(null);
      setMovimientos([]);
      calcularTotales([], 0);
      setLoadingCaja(false);
      return;
    }

    setLoadingCaja(true);
    try {
      // 1. Obtener detalles de apertura de caja
      const resCaja = await fetch(`${backendUrl}/aperturas-cierres/${idAperturaCierre}`);
      if (!resCaja.ok) throw new Error('Error al cargar datos de caja');
      
      const resCajaData = await resCaja.json();
      setDatosCaja(resCajaData);
      setCajaAbierta(true);

      // 2. Obtener movimientos de la caja
      const resMovs = await fetch(`${backendUrl}/movimientos/por-caja?numero_caja=${activeCaja}`);
      if (!resMovs.ok) throw new Error('Error al cargar movimientos');

      const resMovsData = await resMovs.json();
      if (resMovsData.success && resMovsData.movimientos) {
        setMovimientos(resMovsData.movimientos);
        calcularTotales(resMovsData.movimientos, resCajaData.monto_inicial);
      } else {
        setMovimientos([]);
        calcularTotales([], resCajaData.monto_inicial);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCaja(false);
    }
  };

  const handleAbrirCaja = async (e) => {
    e.preventDefault();
    if (!montoInicial || isNaN(montoInicial) || parseFloat(montoInicial) <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Monto inválido',
        text: 'El monto inicial debe ser mayor a 0.',
      });
      return;
    }

    setLoading(true);

    try {
      const user = JSON.parse(sessionStorage.getItem('usuario'));
      const response = await fetch(`${backendUrl}/aperturas-cierres/abrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_caja: parseInt(numeroCaja),
          id_usuario_apertura: user.id,
          monto_inicial: parseFloat(montoInicial),
          observaciones: observacionesCaja,
          estado: 'abierta',
        }),
      });

      const res = await response.json();

      if (res.success) {
        localStorage.setItem('id_aperturas_cierres', res.id);
        localStorage.setItem('estado_caja', 'abierta');
        localStorage.setItem('numero_caja', res.numero_caja);
        localStorage.setItem('id_usuario_apertura', user.id);

        setShowModalInicio(false);
        setMontoInicial('');
        setObservacionesCaja('');

        Swal.fire({
          icon: 'success',
          title: '¡Caja abierta!',
          text: 'Caja abierta correctamente.',
          timer: 2000,
          showConfirmButton: false,
        });

        cargarCaja();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: res.error || 'No se pudo abrir la caja.',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error de conexión con el servidor.',
      });
    } finally {
      setLoading(false);
    }
  };

  const verificarAdmin = async (username, password, tipo = 'retiro') => {
    try {
      const response = await fetch(`${backendUrl}/auth/loginUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password }),
      });

      const result = await response.json();

      if (response.ok && result.message === 'Login exitoso' && result.user) {
        const rol = result.user.role.toLowerCase();
        const rolesPermitidos = ['admin', 'supervisor', 'recaudador', 'tesorero'];
        
        if (rolesPermitidos.includes(rol)) {
          return { esAutorizado: true, userData: result.user, rol };
        } else {
          return { esAutorizado: false, mensaje: `Su rol (${rol}) no tiene permisos para esta acción.` };
        }
      }
      return { esAutorizado: false, mensaje: 'Credenciales incorrectas.' };
    } catch (error) {
      throw new Error('Error al conectar con el servidor.');
    }
  };

  const handleAuthCierre = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const auth = await verificarAdmin(cierreUsername, cierrePassword, 'cierre');
      if (auth.esAutorizado) {
        setShowModalAuthCierre(false);
        setCierreUsername('');
        setCierrePassword('');

        Swal.fire({
          icon: 'success',
          title: 'Autenticación exitosa',
          text: 'Usuario autorizado.',
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          realizarCierreCaja(auth.userData.id);
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Acceso denegado',
          text: auth.mensaje,
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const realizarCierreCaja = async (idUsuarioCierre) => {
    const idSesion = localStorage.getItem('id_aperturas_cierres');
    
    Swal.fire({
      title: '¿Confirmar cierre de caja?',
      text: '¿Estás seguro de cerrar la caja actual?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'Cerrando caja...',
          text: 'Por favor espere, se está registrando el cierre e imprimiendo el comprobante.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        try {
          const user = JSON.parse(sessionStorage.getItem('usuario'));
          const response = await fetch(`${backendUrl}/aperturas-cierres/cerrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_aperturas_cierres: parseInt(idSesion),
              id_usuario_cierre: parseInt(idUsuarioCierre),
              observaciones: 'Cierre manual desde interfaz Next.js',
              nombre_cajero: user.username,
            }),
          });

          const res = await response.json();

          if (res.success) {
            // Imprimir copia de cierre
            const ahora = new Date();
            const datosImpresion = {
              nombre_caja: numeroCaja,
              nombre_cajero: user.username,
              nombre_usuario_cierre: user.username,
              fecha_cierre: ahora.toLocaleDateString('es-CL'),
              hora_cierre: ahora.toLocaleTimeString('es-CL'),
              monto_inicial: totales.inicial,
              total_efectivo: totales.efectivo,
              total_tarjeta: totales.tarjeta,
              total_retiros: totales.retiros,
              balance_final: totales.balance,
            };

            await imprimirCopiaCierre(datosImpresion);

            localStorage.removeItem('id_aperturas_cierres');
            localStorage.removeItem('estado_caja');
            localStorage.removeItem('numero_caja');
            localStorage.removeItem('id_usuario_apertura');

            Swal.fire({
              icon: 'success',
              title: '¡Caja cerrada!',
              text: 'Caja cerrada y ticket emitido correctamente.',
              timer: 2000,
              showConfirmButton: false,
            }).then(async () => {
              // Limpiar cookies y salir
              await fetch('/api/auth/logout', { method: 'POST' });
              sessionStorage.clear();
              router.push('/login');
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: res.error || 'No se pudo realizar el cierre.',
            });
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error de conexión con el servidor.',
          });
        }
      }
    });
  };

  const imprimirCopiaCierre = async (datosImpresion) => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([210, 780]);

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = 12;
      const x = 20;
      let y = 750;

      const lines = [
        "",
        ".",
        "",
        "",
        "",
        ".",
        "",
        "",
        "",
        ".",
        "",
        "",
        "CIERRE DE CAJA",
        "-------------------------",
        `Caja         : ${datosImpresion.nombre_caja}`,
        `Cajero       : ${datosImpresion.nombre_cajero}`,
        `Cerrado por  : ${datosImpresion.nombre_usuario_cierre}`,
        `Fecha        : ${datosImpresion.fecha_cierre}`,
        `Hora         : ${datosImpresion.hora_cierre}`,
        "",
        `Monto Inicial     : $${Number(datosImpresion.monto_inicial).toLocaleString('es-CL')}`,
        `Total Efectivo    : $${Number(datosImpresion.total_efectivo).toLocaleString('es-CL')}`,
        `Total Tarjeta     : $${Number(datosImpresion.total_tarjeta).toLocaleString('es-CL')}`,
        `Total Retirado    : $${Number(datosImpresion.total_retiros).toLocaleString('es-CL')}`,
        "-------------------------",
        `TOTAL VENTAS      : $${Number(Number(datosImpresion.total_efectivo) + Number(datosImpresion.total_tarjeta)).toLocaleString('es-CL')}`,
        "-------------------------",
        `BALANCE FINAL     : $${Number(datosImpresion.balance_final).toLocaleString('es-CL')}`,
        "-------------------------",
        "",
        ".",
        "",
        "",
      ];

      lines.forEach((line) => {
        const isTitle = line.includes("CIERRE DE CAJA");
        const isTotal = line.includes("TOTAL VENTAS") || line.includes("BALANCE FINAL");
        const currentFont = isTitle || isTotal ? boldFont : font;
        const currentSize = isTitle || isTotal ? fontSize + 1 : fontSize;

        page.drawText(line, { x, y, size: currentSize, font: currentFont });
        y -= 20;
      });

      const pdfBytes = await pdfDoc.save();
      
      const uint8ToBase64 = (u8Arr) => {
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < u8Arr.length; i += chunkSize) {
          const chunk = u8Arr.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
      };

      const pdfBase64 = uint8ToBase64(pdfBytes);

      // Consumir el endpoint local de impresión
      await fetch('/api/imprimir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfData: pdfBase64,
          filename: `cierre-${Date.now()}.pdf`,
        }),
      });
    } catch (error) {
      console.error('Error al imprimir cierre de caja:', error);
    }
  };

  const handleAuthAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const auth = await verificarAdmin(adminUsername, adminPassword, 'retiro');
      if (auth.esAutorizado) {
        setAdminAutorizado(auth.userData);
        setShowModalAuthAdmin(false);
        setAdminUsername('');
        setAdminPassword('');
        
        Swal.fire({
          icon: 'success',
          title: 'Autenticación exitosa',
          text: 'Administrador verificado.',
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          setShowModalRetiro(true);
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Acceso denegado',
          text: auth.mensaje,
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetiro = async (e) => {
    e.preventDefault();
    const monto = parseFloat(montoRetiro);

    if (isNaN(monto) || monto <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Monto inválido',
        text: 'Ingrese un monto mayor a cero.',
      });
      return;
    }

    Swal.fire({
      title: '¿Confirmar retiro?',
      html: `¿Está seguro de retirar <strong>$${monto.toLocaleString('es-CL')}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, retirar',
      cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'Realizando retiro...',
          text: 'Por favor espere, se está registrando el retiro y generando los comprobantes.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        try {
          const user = JSON.parse(sessionStorage.getItem('usuario'));
          const response = await fetch(`${backendUrl}/aperturas-cierres/retiro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              monto: monto,
              motivo: motivoRetiro,
              id_usuario: adminAutorizado.id,
              nombre_cajero: user.username,
              numero_caja: numeroCaja,
            }),
          });

          const resultData = await response.json();

          if (resultData.success) {
            let impresionFallida = false;

            // Imprimir copia 1
            try {
              await imprimirCopiaRetiro(resultData.datosImpresion);
            } catch (err) {
              console.error(err);
              impresionFallida = true;
            }

            // Alerta de corte e impresión 2
            if (!impresionFallida) {
              await mostrarAlertaCorte();
              try {
                await imprimirCopiaRetiro(resultData.datosImpresion);
              } catch (err) {
                console.error(err);
                impresionFallida = true;
              }
            }

            setShowModalRetiro(false);
            setMontoRetiro('');
            setMotivoRetiro('Retiro de efectivo');
            setAdminAutorizado(null);

            if (impresionFallida) {
              Swal.fire({
                icon: 'warning',
                title: 'Retiro Exitoso (Sin Impresión)',
                text: 'El retiro se registró exitosamente, pero hubo un problema al imprimir el comprobante. Revise la impresora.',
                confirmButtonText: 'Entendido',
              });
            } else {
              Swal.fire({
                icon: 'success',
                title: '¡Retiro exitoso!',
                text: 'Retiro realizado y comprobantes impresos correctamente.',
                timer: 2000,
                showConfirmButton: false,
              });
            }

            cargarCaja();
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: resultData.message || 'Error al realizar el retiro.',
            });
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al conectar con el servidor.',
          });
        }
      }
    });
  };

  const imprimirCopiaRetiro = async (datosImpresion) => {
    const pdfDoc = await PDFDocument.create();
    
    const detalle = [
      "COMPROBANTE DE RETIRO",
      datosImpresion.motivo ? `MOTIVO: ${datosImpresion.motivo}` : "DE EFECTIVO",
      "---------------------------------------------------",
      `Código: ${datosImpresion.codigo}`,
      `Fecha:  ${datosImpresion.fecha}`,
      `Hora:   ${datosImpresion.hora}`,
      `Caja:   ${datosImpresion.nombre_caja}`,
      `Cajero: ${datosImpresion.nombre_cajero}`,
      `Autorizado por: ${datosImpresion.nombre_usuario}`,
      "---------------------------------------------------",
      "MONTO RETIRADO:",
      `$${parseFloat(datosImpresion.monto).toLocaleString("es-CL")}`,
      "---------------------------------------------------",
    ];

    const footer = [
      " ",
      "FIRMA AUTORIZADA:",
      " ",
      "_________________________",
    ];

    const lineHeight = 15;
    const altura = 300;
    const page = pdfDoc.addPage([210, altura]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = altura - 30;

    detalle.forEach((line) => {
      const isTitle = line === "COMPROBANTE DE RETIRO" || line.startsWith("MOTIVO:");
      const isMonto = line.includes("MONTO RETIRADO") || line.includes("$");
      const isSeparator = line.includes("---");

      const currentFont = isTitle || isMonto ? boldFont : font;
      const currentSize = isMonto ? 13 : isTitle ? 13 : 12;

      if (isSeparator) {
        page.drawText(line, { x: 15, y, size: 12, font });
      } else {
        const textWidth = currentFont.widthOfTextAtSize(line, currentSize);
        const centeredX = (210 - textWidth) / 2;
        page.drawText(line, {
          x: centeredX,
          y,
          size: currentSize,
          font: currentFont,
        });
      }
      y -= lineHeight;
    });

    y -= 20;
    footer.forEach((line) => {
      page.drawText(line, { x: 30, y, size: 11, font });
      y -= lineHeight;
    });

    const pdfBytes = await pdfDoc.save();
    
    const uint8ToBase64 = (u8Arr) => {
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < u8Arr.length; i += chunkSize) {
        const chunk = u8Arr.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary);
    };

    const pdfBase64 = uint8ToBase64(pdfBytes);

    const res = await fetch('/api/imprimir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfData: pdfBase64,
        filename: `retiro-${datosImpresion.codigo}-${Date.now()}.pdf`,
      }),
    });

    const resJson = await res.json();
    if (!resJson.success) {
      throw new Error(resJson.message || 'Error al imprimir');
    }
  };

  const mostrarAlertaCorte = () => {
    return new Promise((resolve) => {
      Swal.fire({
        title: "Corte el primer comprobante",
        text: "Por favor, corte el primer comprobante antes de continuar.",
        icon: "info",
        confirmButtonText: "Continuar",
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(() => {
        resolve();
      });
    });
  };

  const handleReimprimirRetiro = async () => {
    if (!cajaAbierta) {
      Swal.fire({
        icon: 'warning',
        title: 'Caja no abierta',
        text: 'Debe abrir la caja primero.',
      });
      return;
    }

    Swal.fire({
      title: 'Buscando último retiro...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const res = await fetch(`${backendUrl}/movimientos/por-caja?numero_caja=${numeroCaja}`);
      const resData = await res.json();

      if (!resData.success || !resData.movimientos || !resData.movimientos.length) {
        Swal.fire({
          icon: 'info',
          title: 'Sin movimientos',
          text: 'No se encontraron movimientos registrados.',
        });
        return;
      }

      const retiros = resData.movimientos
        .filter((m) => {
          return (
            m.tipo_servicio === 'RETIRO' ||
            (m.medio_pago && m.medio_pago.toLowerCase().includes('retiro')) ||
            (m.nombre_servicio && m.nombre_servicio.toLowerCase().includes('retiro'))
          );
        })
        .sort((a, b) => b.id - a.id);

      if (!retiros.length) {
        Swal.fire({
          icon: 'info',
          title: 'Sin retiros',
          text: 'No hay retiros de efectivo registrados.',
        });
        return;
      }

      const ultimoRetiro = retiros[0];

      let fechaFormateada = '--/--/----';
      if (ultimoRetiro.fecha) {
        const soloFecha = ultimoRetiro.fecha.split('T')[0];
        const [anio, mes, dia] = soloFecha.split('-');
        fechaFormateada = `${dia}-${mes}-${anio}`;
      }

      const datosImpresion = {
        codigo: ultimoRetiro.id,
        fecha: fechaFormateada,
        hora: ultimoRetiro.hora || '--:--:--',
        nombre_caja: numeroCaja,
        nombre_cajero: ultimoRetiro.nombre_usuario || 'Cajero',
        nombre_usuario: ultimoRetiro.autorizado_por || ultimoRetiro.nombre_usuario || 'Admin',
        monto: Math.abs(parseFloat(ultimoRetiro.monto || 0)),
        motivo: ultimoRetiro.nombre_servicio || 'Retiro de efectivo',
      };

      Swal.fire({
        title: '¿Reimprimir último retiro?',
        html: `Se reimprimirá el retiro de <strong>$${datosImpresion.monto.toLocaleString('es-CL')}</strong> realizado a las ${datosImpresion.hora}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, reimprimir',
        cancelButtonText: 'Cancelar',
      }).then(async (result) => {
        if (result.isConfirmed) {
          Swal.fire({
            title: 'Reimprimiendo...',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          try {
            await imprimirCopiaRetiro(datosImpresion);
            await mostrarAlertaCorte();
            await imprimirCopiaRetiro(datosImpresion);

            Swal.fire({
              icon: 'success',
              title: 'Reimpresión exitosa',
              text: 'Los comprobantes se han reimpreso correctamente.',
              timer: 2000,
              showConfirmButton: false,
            });
          } catch (err) {
            Swal.fire({
              icon: 'error',
              title: 'Error al imprimir',
              text: 'No se pudo reimprimir el ticket. Verifique la impresora.',
            });
          }
        }
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error de conexión con el servidor.',
      });
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
      <link href="/css/caja.css" rel="stylesheet" />
      <link href="/css/teclado.css" rel="stylesheet" />

      <div className="d-flex min-vh-100 w-100">
        {/* Sidebar */}
        <aside className="sidebar text-center" style={{ width: '280px', backgroundColor: '#bce0fd', padding: '2rem 1rem' }}>
          <h1 style={{ fontSize: '1.8rem', color: '#2699fb', fontWeight: 'bold', marginBottom: '2rem' }}>
            CONTROL DE CAJA
          </h1>
          
          <button
            className="btn w-100 mb-3"
            onClick={() => setShowModalInicio(true)}
            disabled={cajaAbierta || loadingCaja}
          >
            Abrir Caja
          </button>
          
          <button
            className="btn w-100 mb-3"
            onClick={() => setShowModalAuthCierre(true)}
            disabled={!cajaAbierta}
          >
            Cerrar Caja
          </button>

          <button
            className="btn w-100 mb-3"
            onClick={cargarCaja}
          >
            Actualizar Movimientos
          </button>

          <button
            className="btn w-100 mb-3"
            onClick={() => setShowModalAuthAdmin(true)}
            disabled={!cajaAbierta}
          >
            Retiro de Efectivo
          </button>

          <button
            className="btn w-100 mb-3"
            onClick={handleReimprimirRetiro}
            disabled={!cajaAbierta}
          >
            Reimprimir Último Retiro
          </button>

          <button
            className="btn w-100 mb-3"
            onClick={() => router.push('/home')}
          >
            Volver
          </button>
        </aside>

        {/* Contenido principal */}
        <main className="content flex-grow-1 p-4" style={{ backgroundColor: '#f1f9ff' }}>
          {/* Card Info Caja Abierta */}
          {loadingCaja ? (
            <div className="alert alert-warning d-flex align-items-center gap-2">
              <div className="spinner-border spinner-border-sm text-warning" role="status"></div>
              <span>Verificando estado de la caja...</span>
            </div>
          ) : cajaAbierta && datosCaja ? (
            <div className="card shadow-sm border-primary mb-4">
              <div className="card-body">
                <h5 className="card-title mb-2">Caja Abierta por: {usuario?.username}</h5>
                <p className="mb-1"><strong>N° Caja:</strong> {numeroCaja}</p>
                <p className="mb-1"><strong>Fecha de Apertura:</strong> {datosCaja.fecha_apertura ? new Date(datosCaja.fecha_apertura).toLocaleDateString('es-CL') : '--/--/----'}</p>
                <p className="mb-0"><strong>Monto Inicial:</strong> ${totales.inicial.toLocaleString('es-CL')}</p>
              </div>
            </div>
          ) : (
            <div className="alert alert-info">No hay ninguna caja abierta en este momento.</div>
          )}



          {/* Tabla Movimientos */}
          <div className="card shadow-sm border-0 rounded overflow-hidden">
            <div className="card-header bg-primary text-white py-3 fw-bold">Movimientos de Caja</div>
            <div className="table-responsive">
              <table className="table table-hover table-striped align-middle mb-0">
                <thead className="table-light text-center">
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Servicio</th>
                    <th>Medio de Pago</th>
                    <th>Monto</th>
                    <th>Cajero</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length > 0 ? (
                    movimientos.slice(0, 11).map((m) => {
                      const esRet =
                        m.tipo_servicio === 'RETIRO' ||
                        (m.medio_pago && m.medio_pago.toLowerCase().includes('retiro'));
                      return (
                        <tr key={m.id} className="text-center">
                          <td>{m.id}</td>
                          <td>{m.fecha ? m.fecha.split('T')[0] : '--'}</td>
                          <td>{m.hora || '--'}</td>
                          <td>{m.nombre_servicio}</td>
                          <td>{m.medio_pago}</td>
                          <td className={esRet ? 'text-danger fw-bold' : 'text-success fw-bold'}>
                            {esRet ? '-' : ''}${Math.abs(parseFloat(m.monto)).toLocaleString('es-CL')}
                          </td>
                          <td>{m.nombre_usuario}</td>
                        </tr>
                      );
                    })
                  ) : loadingCaja ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                          <span>Cargando movimientos...</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">No hay movimientos registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* MODAL INICIAR CAJA */}
      {showModalInicio && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">Iniciar Caja</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => !loading && setShowModalInicio(false)} disabled={loading}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAbrirCaja}>
                  <div className="form-group mb-3">
                    <label>Monto Inicial</label>
                    <input
                      ref={montoInicialRef}
                      type="text"
                      className="form-control usar-teclado"
                      value={montoInicial}
                      onChange={(e) => setMontoInicial(e.target.value)}
                      placeholder="Ej: 10000"
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label>Observaciones</label>
                    <textarea
                      ref={observacionesRef}
                      className="form-control usar-teclado"
                      rows="3"
                      value={observacionesCaja}
                      onChange={(e) => setObservacionesCaja(e.target.value)}
                    ></textarea>
                  </div>
                  <button type="submit" className="btn w-100 py-2" disabled={loading}>
                    {loading ? 'Abriendo caja...' : 'Abrir Caja'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUTENTICACION CIERRE */}
      {showModalAuthCierre && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-warning">
                <h5 className="modal-title text-dark">Autenticación Requerida para Cierre</h5>
                <button type="button" className="btn-close" onClick={() => !loading && setShowModalAuthCierre(false)} disabled={loading}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAuthCierre}>
                  <div className="mb-3">
                    <label>Usuario Autorizado</label>
                    <input
                      ref={cierreUsernameRef}
                      type="text"
                      className="form-control usar-teclado"
                      value={cierreUsername}
                      onChange={(e) => setCierreUsername(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div className="mb-3">
                    <label>Contraseña</label>
                    <input
                      ref={cierrePasswordRef}
                      type="password"
                      className="form-control usar-teclado"
                      value={cierrePassword}
                      onChange={(e) => setCierrePassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <button type="submit" className="btn btn-warning w-100 py-2" disabled={loading}>
                    {loading ? 'Verificando...' : 'Verificar y Proceder'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUTENTICACION RETIRO */}
      {showModalAuthAdmin && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-warning">
                <h5 className="modal-title text-dark">Autenticación de Administrador</h5>
                <button type="button" className="btn-close" onClick={() => !loading && setShowModalAuthAdmin(false)} disabled={loading}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAuthAdmin}>
                  <div className="mb-3">
                    <label>Usuario Administrador</label>
                    <input
                      ref={adminUsernameRef}
                      type="text"
                      className="form-control usar-teclado"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div className="mb-3">
                    <label>Contraseña</label>
                    <input
                      ref={adminPasswordRef}
                      type="password"
                      className="form-control usar-teclado"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <button type="submit" className="btn btn-warning w-100 py-2" disabled={loading}>
                    {loading ? 'Verificando...' : 'Verificar'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RETIRO EFECTIVO */}
      {showModalRetiro && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">Retirar Efectivo</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => !loading && setShowModalRetiro(false)} disabled={loading}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-secondary py-2 mb-3">
                  <small>Autorizado por: <strong>{adminAutorizado?.username}</strong></small>
                </div>
                <form onSubmit={handleRetiro}>
                  <div className="form-group mb-3">
                    <label>Monto a Retirar</label>
                    <input
                      ref={montoRetiroRef}
                      type="text"
                      className="form-control usar-teclado"
                      value={montoRetiro}
                      onChange={(e) => setMontoRetiro(e.target.value)}
                      placeholder="Ej: 5000"
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label>Observaciones</label>
                    <textarea
                      ref={motivoRetiroRef}
                      className="form-control usar-teclado"
                      value={motivoRetiro}
                      onChange={(e) => setMotivoRetiro(e.target.value)}
                      rows={3}
                      autoComplete="off"
                    />
                  </div>
                  <button type="submit" className="btn w-100 py-2">Realizar Retiro</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor del teclado */}
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
        onLoad={() => {
          const script = document.createElement('script');
          script.src = '/js/teclado.js';
          script.onload = initTecladoListeners;
          document.body.appendChild(script);
        }}
      />
    </>
  );
}
