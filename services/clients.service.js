const db = require("../config/database.js");

const getClientsService = async () => {
  try {
    const query = `SELECT * FROM clients WHERE id != 1 ORDER BY id DESC`;
    const [clients] = await db.query(query);
    return clients;
  } catch (error) {
    throw new Error("Error al obtener clientes: " + error.message);
  }
};

const createClientService = async (data) => {
  try {
    const query = `
      INSERT INTO clients (name, email, phone, address, postal_code, rfc, tax_regime)
      VALUES (UPPER(?), ?, ?, ?, ?, UPPER(?), ?)
    `;

    const values = [
      data.name,
      data.email,
      data.phone,
      data.address || null,
      data.postal_code,
      data.rfc,
      data.tax_regime
    ];

    const [result] = await db.query(query, values);

    return { id: result.insertId, ...data };

  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {

      if (error.sqlMessage.includes("email")) {
        throw { status: 409, message: "El email ya está registrado" };
      }

      if (error.sqlMessage.includes("rfc")) {
        throw { status: 409, message: "El RFC ya está registrado" };
      }

      throw { status: 409, message: "Dato duplicado" };
    }

    throw {
      status: 500,
      message: "Error al crear cliente"
    };
  }
};

const updateClientService = async (id, data) => {
  try {
    const query = `
      UPDATE clients 
      SET name = UPPER(?), email = ?, phone = ?, address = ?, postal_code = ?, rfc = UPPER(?), tax_regime = ?
      WHERE id = ?
    `;

    const values = [
      data.name,
      data.email,
      data.phone,
      data.address || null,
      data.postal_code,
      data.rfc,
      data.tax_regime,
      id,
    ];

    await db.query(query, values);

    return { id, ...data };

  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {

      if (error.sqlMessage.includes("email")) {
        throw { status: 409, message: "El email ya está registrado" };
      }

      if (error.sqlMessage.includes("rfc")) {
        throw { status: 409, message: "El RFC ya está registrado" };
      }

      throw { status: 409, message: "Dato duplicado" };
    }

    throw {
      status: 500,
      message: "Error al crear cliente"
    };
  }
};

const deleteClientService = async (id) => {
  try {
    const query = `DELETE FROM clients WHERE id = ?`;
    await db.query(query, [id]);
  } catch (error) {
    throw {
      status: 500,
      message: "Error al eliminar cliente"
    };
  }
};

module.exports = {
  getClientsService,
  createClientService,
  updateClientService,
  deleteClientService
};