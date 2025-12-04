// config/firebase.js
const admin = require('firebase-admin');

// Importamos la llave que acabas de descargar
const serviceAccount = require('./serviceAccountKey.json');

// Inicializamos la conexión
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log("🔥 Firebase conectado correctamente.");

module.exports = admin;