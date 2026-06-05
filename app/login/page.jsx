'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const router = useRouter();

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const emailRecuperarRef = useRef(null);

  useEffect(() => {
    const user = sessionStorage.getItem('usuario');
    if (user) {
      router.push('/home');
    }
  }, [router]);

  const handleTecladoInit = () => {
    if (typeof window !== 'undefined' && window.tecladoVirtual) {
      window.tecladoVirtual.init();

      const setupKeyboard = (inputEl, setter) => {
        if (!inputEl) return;
        inputEl.addEventListener('focus', () => {
          window.tecladoVirtual.show(inputEl);
          const interval = setInterval(() => {
            if (inputEl === document.activeElement) {
              setter(inputEl.value);
            } else {
              clearInterval(interval);
            }
          }, 100);
        });
      };

      setupKeyboard(emailInputRef.current, setEmail);
      setupKeyboard(passwordInputRef.current, setPassword);
      setupKeyboard(emailRecuperarRef.current, setEmailRecuperar);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        sessionStorage.setItem('usuario', JSON.stringify(result.user));
        if (result.token) {
          sessionStorage.setItem('authToken', result.token);
        }

        // Intentar restaurar caja si hay una abierta
        try {
          const numero_caja = process.env.NEXT_PUBLIC_NUMERO_CAJA || '77';
          const resCaja = await fetch(
            `https://backend-banios.dev-wit.com/api/aperturas-cierres/u/${numero_caja}`
          );
          if (resCaja.ok) {
            const cajaData = await resCaja.json();
            if (cajaData && cajaData.id && cajaData.estado !== 'cerrada') {
              localStorage.setItem('id_aperturas_cierres', cajaData.id);
              localStorage.setItem('estado_caja', 'abierta');
              localStorage.setItem('numero_caja', cajaData.numero_caja);
              localStorage.setItem('id_usuario_apertura', cajaData.id_usuario_apertura);
            }
          }
        } catch (err) {
          console.error('Error al restaurar estado de la caja:', err);
        }

        router.push('/home');
      } else {
        alert(result.error || 'Credenciales incorrectas.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error en el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async (e) => {
    e.preventDefault();
    alert('Se enviará un correo a: ' + emailRecuperar);
    setShowModal(false);
  };

  const apagarSistema = () => {
    if (confirm('¿Estás seguro que deseas apagar el sistema?')) {
      fetch('/api/apagar', { method: 'POST' }).catch((err) => {
        alert('No se pudo apagar el sistema: ' + err.message);
      });
    }
  };

  const recargarYLimpiarStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  return (
    <>
      <header>
        <nav>
          <img
            src="/images/LOGOTIPO_PB_NARANJO_NORMA@2x.png"
            alt="Logo Pullman"
            className="logo-pullman"
          />
          <h1>SUITE SERVICIOS PULLMAN</h1>
          <img src="/images/wit@2x.png" alt="Logo Wit" className="logo-wit" />
        </nav>
      </header>

      <main className="login-main">
        <form id="loginForm" className="login-form" onSubmit={handleSubmit}>
          <h2 className="login-title">Iniciar Sesión</h2>

          <div className="form-group">
            <label>Usuario</label>
            <input
              ref={emailInputRef}
              type="email"
              id="email"
              required
              className="user-input usar-teclado"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div className="password-wrapper">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                id="password"
                required
                className="user-input usar-teclado"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                id="togglePassword"
                className={`toggle-password${showPassword ? ' active' : ''}`}
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Mostrar/Ocultar contraseña"
                aria-pressed={String(showPassword)}
              >
                <svg id="iconEye" viewBox="0 0 24 24" aria-hidden="true">
                  {/* OJO ABIERTO */}
                  <g className="eye-open" style={{ display: showPassword ? 'none' : 'inline' }}>
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </g>
                  {/* OJO CERRADO */}
                  <g className="eye-closed" style={{ display: showPassword ? 'inline' : 'none' }}>
                    <path d="M9.9 4.24A10.94 10.94 0 0112 5c7 0 11 7 11 7a22.05 22.05 0 01-5.08 5.96" />
                    <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a22.05 22.05 0 015.08-5.96" />
                    <path d="M1 1L23 23" />
                    <path d="M14.12 14.12A3 3 0 119.88 9.88" />
                  </g>
                </svg>
              </button>
            </div>
          </div>

          <div className="text-center">
            <button type="submit" className="ingresar-button" disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </div>

          <div className="olvido-contrasena">
            <a
              href="#"
              id="olvidoContrasena"
              onClick={(e) => {
                e.preventDefault();
                setShowModal(true);
              }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </form>
      </main>

      {/* Modal recuperar contraseña */}
      <div
        id="modalRecuperar"
        className={`modal-recuperar${showModal ? ' show' : ''}`}
        onClick={(e) => {
          if (e.target.id === 'modalRecuperar') setShowModal(false);
        }}
      >
        <div className="modal-content-recuperar">
          <button className="modal-close" onClick={() => setShowModal(false)}>
            &times;
          </button>
          <h2>Recuperar Contraseña</h2>
          <p>Te enviaremos un correo con un enlace para reestablecer tu contraseña.</p>
          <form id="formRecuperar" onSubmit={handleRecuperar}>
            <div className="form-group" style={{ display: 'flex', justifyContent: 'center' }}>
              <input
                ref={emailRecuperarRef}
                type="email"
                id="emailRecuperar"
                required
                className="user-input usar-teclado"
                placeholder="Correo electrónico"
                value={emailRecuperar}
                onChange={(e) => setEmailRecuperar(e.target.value)}
                style={{ width: '100%', maxWidth: '300px' }}
              />
            </div>
            <div className="text-center">
              <button type="submit" className="ingresar-button">
                Enviar
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Botones totem (inferior izquierda) */}
      <div
        style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          zIndex: 1000,
          display: 'flex',
          gap: '10px',
        }}
      >
        <button
          onClick={apagarSistema}
          className="btn btn-danger"
          style={{
            background: '#dc3545',
            color: 'white',
            border: 'none',
            margin: '4px',
            padding: '4px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Apagar
        </button>
        <button
          onClick={recargarYLimpiarStorage}
          className="btn-reload"
          onMouseOver={(e) => (e.currentTarget.style.transform = 'rotate(45deg)')}
          onMouseOut={(e) => (e.currentTarget.style.transform = 'rotate(0deg)')}
          aria-label="Reiniciar sesión"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Contenedor teclado virtual */}
      <div
        id="tecladoContainer"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          width: '100%',
          zIndex: 1001,
          background: '#fff',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
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
          script.onload = handleTecladoInit;
          document.body.appendChild(script);
        }}
      />
    </>
  );
}
