// config/firebase.js
const admin = require('firebase-admin');
require('dotenv').config();

let serviceAccount;

try {
    // OPCIÓN A: Estamos en Render (Nube)
    // Leemos la llave desde una variable de texto invisible
    if (process.env.FIREBASE_CREDENTIALS) {
        serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
        console.log("☁️ Usando credenciales de entorno (Render)");
    } 
    // OPCIÓN B: Estamos en tu PC (Local)
    // Leemos el archivo físico
    else {
        serviceAccount = require('./serviceAccountKey.json');
        console.log("💻 Usando archivo local serviceAccountKey.json");
    }

    // Inicializar
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    
    console.log("🔥 Firebase conectado correctamente.");

} catch (error) {
    console.error("❌ ERROR CRÍTICO FIREBASE:", error.message);
    console.error("💡 PISTA: Si estás en Render, asegúrate de haber creado la variable 'FIREBASE_CREDENTIALS'.");
}

const dbFirestore = admin.firestore();

module.exports = { admin, dbFirestore };