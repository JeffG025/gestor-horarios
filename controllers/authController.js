// controllers/authController.js
const db = require('../config/db');

const authController = {
    
    login: (req, res) => {
        const { email, password } = req.body;

        // 🕵️‍♂️ ESPÍA 1: Ver qué llegó del formulario
        console.log("------------------------------------------------");
        console.log("🔍 Intento de Login recibido:");
        console.log("   Email enviado:", email);
        console.log("   Password enviado:", password);

        // Consultamos solo por EMAIL primero para ver si el usuario existe
        const sql = "SELECT * FROM maestros WHERE email = ?";
        
        db.query(sql, [email], (err, resultados) => {
            if (err) {
                console.error("❌ Error de SQL:", err);
                return res.status(500).json({ error: "Error en el servidor" });
            }
            
            // 🕵️‍♂️ ESPÍA 2: Ver qué encontró la base de datos
            if (resultados.length === 0) {
                console.log("❌ El usuario NO EXISTE en la base de datos.");
                return res.status(401).json({ exito: false, mensaje: "📧 Usuario no encontrado" });
            }

            const usuario = resultados[0];
            console.log("✅ Usuario encontrado en BD:", usuario.nombre);
            console.log("🔐 Contraseña en BD:", usuario.contrasena);

            // Comparar contraseñas manualmente
            if (password !== usuario.contrasena) {
                console.log("❌ Las contraseñas NO COINCIDEN.");
                return res.status(401).json({ exito: false, mensaje: "🔑 Contraseña incorrecta" });
            }

            // ¡Login Exitoso!
            console.log("🎉 ¡LOGIN EXITOSO!");
            res.json({
                exito: true,
                mensaje: "Bienvenido",
                usuario: {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    email: usuario.email,
                    rol: usuario.rol,
                    horas: usuario.horas_max_semana
                }
            });
        });
    }
};

module.exports = authController;