const db = require("../config/database.js");

const buscarPorNombre = async (texto) => {
    const [rows] = await db.query(
        `SELECT id, ref_producto, etiqueta, precio_venta 
         FROM products 
         WHERE etiqueta LIKE ? 
         LIMIT 10`,
        [`%${texto}%`]
    );

    return rows;
}; 

module.exports = {
    buscarPorNombre
};