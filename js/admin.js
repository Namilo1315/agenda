import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs,
  setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ==================== FIREBASE INIT ====================
  const firebaseConfig = {
    apiKey: "AIzaSyBs3V8rJ6cKI08IADuzecAI9XUL3740Gb4",
    authDomain: "savia-74c89.firebaseapp.com",
    projectId: "savia-74c89",
    storageBucket: "savia-74c89.firebasestorage.app",
    messagingSenderId: "627564458830",
    appId: "1:627564458830:web:deb7ee624592236a91241f"
  };
// TODO: reemplazá los valores de arriba con los de tu consola Firebase

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// negocio actual por ?negocio=bellezza
const params = new URLSearchParams(window.location.search);
const negocioId = params.get("negocio") || "demo";

const negocioRef = doc(db, "negocios", negocioId);
const serviciosCol = collection(negocioRef, "servicios");
const turnosCol = collection(negocioRef, "turnos");

// ==================== STATE EN MEMORIA ====================
const state = {
  negocio: {
    nombre: "Estética Bellezza",
    rubro: "Estéticas · Uñas · Masajes",
    whatsapp: "2613387305",
    instagram: "",
    facebook: "",
    color: "#4BAF8C"
  },
  config: {
    apertura: "09:00",
    cierre: "20:00",
    duracionMin: 30,
    aliasPago: ""
  },
  servicios: [],
  turnos: []
};

// ==================== HELPERS ====================
function isoFechaOffset(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const diasCortos = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function formateaFechaCorta(iso) {
  if (!iso) return "-";
  const partes = iso.split("-");
  if (partes.length !== 3) return iso;
  const y = Number(partes[0]);
  const m = Number(partes[1]);
  const d = Number(partes[2]);
  const fecha = new Date(y, m - 1, d);
  if (isNaN(fecha)) return iso;
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yyyy = fecha.getFullYear();
  const dia = diasCortos[fecha.getDay()];
  return `${dia} ${dd}/${mm}/${yyyy}`;
}

function generarSlots(config) {
  const apertura = config.apertura || "09:00";
  const cierre = config.cierre || "20:00";
  const paso = config.duracionMin || 30;
  const [ah, am] = apertura.split(":").map(Number);
  const [ch, cm] = cierre.split(":").map(Number);
  let inicio = ah * 60 + am;
  const fin = ch * 60 + cm;
  const slots = [];
  while (inicio < fin) {
    const hh = String(Math.floor(inicio / 60)).padStart(2, "0");
    const mm = String(inicio % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
    inicio += paso;
  }
  return slots;
}

function formateaPrecio(n) {
  const num = Number(n) || 0;
  return "$ " + num.toLocaleString("es-AR");
}

function parsePrecio(str) {
  if (!str) return 0;
  const limpio = String(str).replace(/[^\d]/g, "");
  return limpio ? Number(limpio) : 0;
}

function aplicarColorAccent() {
  const color = state.negocio.color || "#4BAF8C";
  document.documentElement.style.setProperty("--accent", color);
}

// ==================== DOM REFS ====================
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

const headerNombre = document.getElementById("header-nombre-negocio");
const headerRubro = document.getElementById("header-rubro");

const kpiGanancia = document.getElementById("kpi-ganancia");
const kpiTurnos7 = document.getElementById("kpi-turnos7");
const kpiCancelaciones = document.getElementById("kpi-cancelaciones");

const formNuevoTurno = document.getElementById("form-nuevo-turno");
const ntServicio = document.getElementById("nt-servicio");
const ntFecha = document.getElementById("nt-fecha");
const ntHora = document.getElementById("nt-hora");
const ntCliente = document.getElementById("nt-cliente");
const ntWa = document.getElementById("nt-wa");
const ntNotas = document.getElementById("nt-notas");
const msgTurno = document.getElementById("msg-turno");
const tablaTurnos = document.getElementById("tabla-turnos");
const filtroMes = document.getElementById("filtro-mes");
const filtroFecha = document.getElementById("filtro-fecha");
const btnLimpiarFiltros = document.getElementById("btn-limpiar-filtros");

const formNegocio = document.getElementById("form-negocio");
const cfgNombre = document.getElementById("cfg-nombre");
const cfgRubro = document.getElementById("cfg-rubro");
const cfgWa = document.getElementById("cfg-wa");
const cfgColor = document.getElementById("cfg-color");
const cfgIg = document.getElementById("cfg-ig");
const cfgFb = document.getElementById("cfg-fb");

const formHorario = document.getElementById("form-horario");
const cfgApertura = document.getElementById("cfg-apertura");
const cfgCierre = document.getElementById("cfg-cierre");
const cfgDuracion = document.getElementById("cfg-duracion");
const cfgAlias = document.getElementById("cfg-alias");

const formServicio = document.getElementById("form-servicio");
const svcIdEdit = document.getElementById("svc-id-edit");
const svcCategoria = document.getElementById("svc-categoria");
const svcNombre = document.getElementById("svc-nombre");
const svcDuracion = document.getElementById("svc-duracion");
const svcPrecio = document.getElementById("svc-precio");
const btnGuardarServicio = document.getElementById("btn-guardar-servicio");
const btnLimpiarServicio = document.getElementById("btn-limpiar-servicio");
const listaServicios = document.getElementById("lista-servicios");

const tablaResumenServicios = document.getElementById("tabla-resumen-servicios");
const btnSalir = document.getElementById("btn-salir");

// ==================== TABS ====================
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.tabPanel === tab);
    });
  });
});

// ==================== HEADER & KPI ====================
function renderHeader() {
  headerNombre.textContent = state.negocio.nombre || "Nombre del negocio";
  headerRubro.textContent = state.negocio.rubro || "Rubro";
  document.title = "Savia Admin · " + (state.negocio.nombre || "Panel profesional");
  aplicarColorAccent();
}

function calcularKpis() {
  const hoy = new Date();
  const ms7 = 7 * 24 * 60 * 60 * 1000;
  let turnos7 = 0;
  let cancelaciones = 0;
  let ingresos = 0;

  state.turnos.forEach((t) => {
    if (!t.fecha) return;
    const partes = t.fecha.split("-");
    let fecha;
    if (partes.length === 3) {
      fecha = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    } else {
      fecha = new Date(t.fecha);
    }
    if (!isNaN(fecha)) {
      const diff = hoy - fecha;
      if (diff >= 0 && diff <= ms7) {
        turnos7++;
        if (t.estado === "cancelado") cancelaciones++;
      }
    }
    if (t.estado === "confirmado") {
      const serv = state.servicios.find((s) => s.id === t.servicioId);
      if (serv) ingresos += serv.precio || 0;
    }
  });

  return { turnos7, cancelaciones, ingresos };
}

function renderKpis() {
  const k = calcularKpis();
  if (kpiGanancia) kpiGanancia.textContent = formateaPrecio(k.ingresos);
  if (kpiTurnos7) kpiTurnos7.textContent = k.turnos7;
  if (kpiCancelaciones) kpiCancelaciones.textContent = k.cancelaciones;
}

// ==================== TURNOS ====================
function pasaFiltros(turno) {
  if (filtroMes && filtroMes.value) {
    const pref = filtroMes.value; // yyyy-mm
    if (!turno.fecha || !turno.fecha.startsWith(pref)) return false;
  }
  if (filtroFecha && filtroFecha.value) {
    if (turno.fecha !== filtroFecha.value) return false;
  }
  return true;
}

function renderTurnosTabla() {
  if (!tablaTurnos) return;
  tablaTurnos.innerHTML = "";
  const ordenados = [...state.turnos].sort((a, b) => {
    const aKey = (a.fecha || "") + " " + (a.hora || "");
    const bKey = (b.fecha || "") + " " + (b.hora || "");
    return aKey.localeCompare(bKey);
  });
  const filtrados = ordenados.filter(pasaFiltros);

  if (!filtrados.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7">Todavía no hay turnos para los filtros seleccionados.</td>`;
    tablaTurnos.appendChild(tr);
    return;
  }

  filtrados.forEach((t) => {
    const serv = state.servicios.find((s) => s.id === t.servicioId);
    const servicioNombre = serv ? serv.nombre : "—";
    const tr = document.createElement("tr");
    const claseEstado =
      t.estado === "cancelado"
        ? "badge-cancelado"
        : t.estado === "pendiente"
        ? "badge-pendiente"
        : "badge-confirmado";

    tr.innerHTML = `
      <td>${formateaFechaCorta(t.fecha)}</td>
      <td>${t.hora || ""}</td>
      <td>${servicioNombre}</td>
      <td>${t.cliente || ""}</td>
      <td>${t.whatsapp ? `<a href="https://wa.me/54${String(t.whatsapp).replace(/[^\d]/g,"")}" target="_blank" style="color:#2563eb;text-decoration:none;">${t.whatsapp}</a>` : ""}</td>
      <td><span class="badge-estado ${claseEstado}">${t.estado || ""}</span></td>
      <td>
        ${
          t.estado !== "confirmado"
            ? `<button type="button" class="btn-table confirm" data-accion="confirmar" data-id="${t.id}">Confirmar</button>`
            : ""
        }
        ${
          t.estado !== "cancelado"
            ? `<button type="button" class="btn-table cancel" data-accion="cancelar" data-id="${t.id}">Cancelar</button>`
            : ""
        }
        <button type="button" class="btn-table" data-accion="borrar" data-id="${t.id}">Borrar</button>
      </td>
    `;
    tablaTurnos.appendChild(tr);
  });
}

tablaTurnos?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const id = btn.dataset.id;
  const accion = btn.dataset.accion;
  if (!id || !accion) return;

  const ref = doc(turnosCol, id);

  try {
    if (accion === "confirmar") {
      await updateDoc(ref, { estado: "confirmado" });
    } else if (accion === "cancelar") {
      await updateDoc(ref, { estado: "cancelado" });
    } else if (accion === "borrar") {
      await deleteDoc(ref);
    }
  } catch (err) {
    console.error("Error actualizando turno", err);
    alert("Ocurrió un error al actualizar el turno.");
  }
});

// HORARIOS SELECT
function renderHorarioOptions() {
  if (!ntHora) return;
  ntHora.innerHTML = "";
  const slots = generarSlots(state.config);
  slots.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    ntHora.appendChild(opt);
  });
}

function renderServiciosEnSelect() {
  if (!ntServicio) return;
  ntServicio.innerHTML = "";
  if (!state.servicios.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Cargá servicios en Config";
    ntServicio.appendChild(opt);
    ntServicio.disabled = true;
    return;
  }
  ntServicio.disabled = false;
  state.servicios.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.nombre} — ${formateaPrecio(s.precio || 0)}`;
    ntServicio.appendChild(opt);
  });
}

// Crear nuevo turno desde el panel
formNuevoTurno?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!ntServicio.value) {
    alert("Cargá al menos un servicio en la pestaña Config.");
    return;
  }

  const nuevo = {
    fecha: ntFecha.value,
    hora: ntHora.value,
    servicioId: ntServicio.value,
    cliente: ntCliente.value.trim(),
    whatsapp: ntWa.value.trim(),
    notas: ntNotas.value.trim(),
    estado: "confirmado",
    origen: "admin",
    creadoEn: serverTimestamp()
  };

  if (!nuevo.fecha || !nuevo.hora || !nuevo.cliente || !nuevo.whatsapp) {
    alert("Completá fecha, hora, nombre y WhatsApp.");
    return;
  }

  try {
    await addDoc(turnosCol, nuevo);
    formNuevoTurno.reset();
    const hoyIsoVal = isoFechaOffset(0);
    ntFecha.value = hoyIsoVal;

    msgTurno?.classList.add("show");
    setTimeout(() => msgTurno?.classList.remove("show"), 3000);
  } catch (err) {
    console.error("Error creando turno", err);
    alert("No se pudo guardar el turno.");
  }
});

filtroMes?.addEventListener("change", renderTurnosTabla);
filtroFecha?.addEventListener("change", renderTurnosTabla);
btnLimpiarFiltros?.addEventListener("click", () => {
  if (filtroMes) filtroMes.value = "";
  if (filtroFecha) filtroFecha.value = "";
  renderTurnosTabla();
});

// ==================== NEGOCIO & HORARIO ====================
function rellenarFormNegocio() {
  if (cfgNombre) cfgNombre.value = state.negocio.nombre || "";
  if (cfgRubro) cfgRubro.value = state.negocio.rubro || "";
  if (cfgWa) cfgWa.value = state.negocio.whatsapp || "";
  if (cfgColor) cfgColor.value = state.negocio.color || "#4BAF8C";
  if (cfgIg) cfgIg.value = state.negocio.instagram || "";
  if (cfgFb) cfgFb.value = state.negocio.facebook || "";
}

function rellenarFormHorario() {
  if (cfgApertura) cfgApertura.value = state.config.apertura || "09:00";
  if (cfgCierre) cfgCierre.value = state.config.cierre || "20:00";
  if (cfgDuracion) cfgDuracion.value = state.config.duracionMin || 30;
  if (cfgAlias) cfgAlias.value = state.config.aliasPago || "";
}

formNegocio?.addEventListener("submit", async (e) => {
  e.preventDefault();
  state.negocio.nombre = cfgNombre.value.trim() || "Nombre del negocio";
  state.negocio.rubro = cfgRubro.value.trim() || "Rubro";
  state.negocio.whatsapp = cfgWa.value.trim();
  state.negocio.color = cfgColor.value || "#4BAF8C";
  state.negocio.instagram = cfgIg.value.trim();
  state.negocio.facebook = cfgFb.value.trim();

  try {
    await setDoc(
      negocioRef,
      {
        nombre: state.negocio.nombre,
        rubro: state.negocio.rubro,
        whatsapp: state.negocio.whatsapp,
        color: state.negocio.color,
        instagram: state.negocio.instagram,
        facebook: state.negocio.facebook
      },
      { merge: true }
    );
    renderHeader();
    renderServiciosEnSelect();
    renderTurnosTabla();
    alert("Datos del negocio guardados.");
  } catch (err) {
    console.error("Error guardando negocio", err);
    alert("No se pudieron guardar los datos del negocio.");
  }
});

formHorario?.addEventListener("submit", async (e) => {
  e.preventDefault();
  state.config.apertura = cfgApertura.value || "09:00";
  state.config.cierre = cfgCierre.value || "20:00";
  state.config.duracionMin = Number(cfgDuracion.value) || 30;
  state.config.aliasPago = cfgAlias.value.trim();

  try {
    await setDoc(
      negocioRef,
      {
        apertura: state.config.apertura,
        cierre: state.config.cierre,
        duracionMin: state.config.duracionMin,
        aliasPago: state.config.aliasPago
      },
      { merge: true }
    );
    renderHorarioOptions();
    renderTurnosTabla();
    alert("Horario guardado. Los horarios disponibles se actualizaron.");
  } catch (err) {
    console.error("Error guardando horario", err);
    alert("No se pudieron guardar los horarios.");
  }
});

// ==================== SERVICIOS ====================
function limpiarServicioForm() {
  if (svcIdEdit) svcIdEdit.value = "";
  if (svcCategoria) svcCategoria.value = "";
  if (svcNombre) svcNombre.value = "";
  if (svcDuracion) svcDuracion.value = "";
  if (svcPrecio) svcPrecio.value = "";
  if (btnGuardarServicio) btnGuardarServicio.textContent = "Guardar servicio";
}

function renderServiciosLista() {
  if (!listaServicios) return;
  listaServicios.innerHTML = "";
  if (!state.servicios.length) {
    const li = document.createElement("li");
    li.textContent = "Todavía no hay servicios cargados.";
    li.style.fontSize = ".78rem";
    li.style.color = "#6b7280";
    listaServicios.appendChild(li);
    return;
  }

  state.servicios.forEach((s) => {
    const li = document.createElement("li");
    li.className = "svc-item";
    li.innerHTML = `
      <div class="svc-left">
        <div class="svc-name">${s.nombre}</div>
        <div class="svc-meta">${s.categoria || "General"} · ${s.duracionMin || 30} min</div>
      </div>
      <div class="svc-right">
        <div class="svc-precio">${formateaPrecio(s.precio || 0)}</div>
        <div class="svc-actions">
          <button type="button" class="btn btn-outline" data-accion="editar-servicio" data-id="${s.id}">Editar</button>
          <button type="button" class="btn btn-outline" data-accion="borrar-servicio" data-id="${s.id}">Borrar</button>
        </div>
      </div>
    `;
    listaServicios.appendChild(li);
  });
}

listaServicios?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const id = btn.dataset.id;
  const accion = btn.dataset.accion;
  if (!id || !accion) return;

  if (accion === "editar-servicio") {
    const servicio = state.servicios.find((s) => s.id === id);
    if (!servicio) return;
    if (svcIdEdit) svcIdEdit.value = servicio.id;
    if (svcCategoria) svcCategoria.value = servicio.categoria || "";
    if (svcNombre) svcNombre.value = servicio.nombre || "";
    if (svcDuracion) svcDuracion.value = servicio.duracionMin || "";
    if (svcPrecio) svcPrecio.value = servicio.precio ? formateaPrecio(servicio.precio) : "";
    if (btnGuardarServicio) btnGuardarServicio.textContent = "Actualizar servicio";
  } else if (accion === "borrar-servicio") {
    if (!confirm("¿Borrar este servicio?")) return;
    try {
      await deleteDoc(doc(serviciosCol, id));
    } catch (err) {
      console.error("Error borrando servicio", err);
      alert("No se pudo borrar el servicio.");
    }
  }
});

formServicio?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cat = (svcCategoria.value || "").trim() || "General";
  const nom = (svcNombre.value || "").trim() || "Servicio sin nombre";
  const dur = Number(svcDuracion.value) || 30;
  const precio = parsePrecio(svcPrecio.value);

  const data = {
    categoria: cat,
    nombre: nom,
    duracionMin: dur,
    precio: precio
  };

  try {
    if (svcIdEdit.value) {
      await updateDoc(doc(serviciosCol, svcIdEdit.value), data);
    } else {
      await addDoc(serviciosCol, data);
    }
    limpiarServicioForm();
  } catch (err) {
    console.error("Error guardando servicio", err);
    alert("No se pudo guardar el servicio.");
  }
});

btnLimpiarServicio?.addEventListener("click", limpiarServicioForm);

// ==================== DASHBOARD RESUMEN ====================
function renderDashboard() {
  if (!tablaResumenServicios) return;
  tablaResumenServicios.innerHTML = "";
  const conteo = {};

  state.turnos.forEach((t) => {
    if (t.estado === "cancelado") return;
    const serv = state.servicios.find((s) => s.id === t.servicioId);
    if (!serv) return;
    if (!conteo[serv.id]) {
      conteo[serv.id] = { servicio: serv, cantidad: 0 };
    }
    conteo[serv.id].cantidad++;
  });

  const entries = Object.values(conteo).sort((a, b) => b.cantidad - a.cantidad);
  if (!entries.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3">Todavía no hay datos para el resumen.</td>`;
    tablaResumenServicios.appendChild(tr);
    return;
  }

  entries.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.servicio.nombre}</td>
      <td>${item.cantidad}</td>
      <td>${formateaPrecio(item.cantidad * (item.servicio.precio || 0))}</td>
    `;
    tablaResumenServicios.appendChild(tr);
  });
}

// ==================== SALIR ====================
btnSalir?.addEventListener("click", () => {
  window.location.href = "turnos.html?negocio=" + encodeURIComponent(negocioId);
});

// ==================== FIREBASE LOADERS (NEGOCIO, SERVICIOS, TURNOS) ====================
async function cargarNegocioDesdeFirebase() {
  try {
    const snap = await getDoc(negocioRef);
    if (snap.exists()) {
      const d = snap.data();
      state.negocio.nombre = d.nombre || state.negocio.nombre;
      state.negocio.rubro = d.rubro || state.negocio.rubro;
      state.negocio.whatsapp = d.whatsapp || state.negocio.whatsapp;
      state.negocio.instagram = d.instagram || state.negocio.instagram;
      state.negocio.facebook = d.facebook || state.negocio.facebook;
      state.negocio.color = d.color || state.negocio.color;

      state.config.apertura = d.apertura || state.config.apertura;
      state.config.cierre = d.cierre || state.config.cierre;
      state.config.duracionMin = d.duracionMin || state.config.duracionMin;
      state.config.aliasPago = d.aliasPago || state.config.aliasPago;
    } else {
      // si no existe, lo creo con datos por defecto
      await setDoc(negocioRef, {
        nombre: state.negocio.nombre,
        rubro: state.negocio.rubro,
        whatsapp: state.negocio.whatsapp,
        instagram: state.negocio.instagram,
        facebook: state.negocio.facebook,
        color: state.negocio.color,
        apertura: state.config.apertura,
        cierre: state.config.cierre,
        duracionMin: state.config.duracionMin,
        aliasPago: state.config.aliasPago
      });
    }
    renderHeader();
    rellenarFormNegocio();
    rellenarFormHorario();
    renderHorarioOptions();
  } catch (err) {
    console.error("Error cargando negocio", err);
  }
}

function escucharServiciosFirebase() {
  const q = query(serviciosCol, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    state.servicios = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
    renderServiciosLista();
    renderServiciosEnSelect();
    renderDashboard();
    renderTurnosTabla();
  });
}

function escucharTurnosFirebase() {
  const q = query(turnosCol, orderBy("fecha"));
    return onSnapshot(q, (snap) => {
    state.turnos = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
    renderTurnosTabla();
    renderDashboard();
    renderKpis();
  });
}

// ==================== INIT ====================
async function initAdmin() {
  const hoy = isoFechaOffset(0);
  if (ntFecha) ntFecha.value = hoy;
  if (filtroFecha) filtroFecha.value = hoy;
  if (filtroMes) filtroMes.value = hoy.slice(0, 7);

  await cargarNegocioDesdeFirebase();
  escucharServiciosFirebase();
  escucharTurnosFirebase();
}

initAdmin().catch((err) => console.error("Error inicializando admin", err));
