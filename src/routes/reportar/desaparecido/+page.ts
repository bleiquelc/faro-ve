/**
 * Formulario de reporte — SHELL estático (los datos viven en estado de cliente
 * y en la cola cifrada, nunca en el HTML). Se PRERENDERIZA → precacheado → carga
 * SIN conexión (offline-fresh) para poder llenar y ENCOLAR el reporte sin señal.
 */
export const prerender = true;
