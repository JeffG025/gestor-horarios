// app.js - Versión Final Limpia
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');

// 1. Cargar configuraciones
dotenv.config();

// 2. Conexiones a Base de Datos
require('./config/db');       // MySQL
require('./config/firebase'); // Firebase

// 3. Configurar Servidor
const app = express();
const PORT = process.env.PORT || 3000;

// 4. Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 5. RUTAS (Aquí está el cambio importante)
// Importamos tu archivo de rutas que contiene el Login y el Horario
const misRutas = require('./routes/rutas');
app.use('/', misRutas); 

// 6. Arrancar
app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`📂 Sistema listo.`);
    console.log(`==================================================\n`);
});
// Versión final para producción