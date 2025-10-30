// server.js
const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 8080;

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos desde "public"
app.use(express.static(path.join(__dirname, 'public')));


// Ruta para mostrar el login (index.html dentro de views)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
