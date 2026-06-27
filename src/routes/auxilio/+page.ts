/**
 * /auxilio es 100% contenido ESTÁTICO (guías + contactos importados del bundle,
 * sin datos por request). Lo prerenderizamos a HTML estático en el build → el
 * service worker lo precachea → Faro Auxilio (primeros auxilios que salvan vidas)
 * funciona SIN conexión. No cambia nada del comportamiento online.
 */
export const prerender = true;
