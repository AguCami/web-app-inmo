/**
 * La versión en una esquina, chiquita: para saber de un vistazo si lo que se
 * ve es lo último que se publicó. Se muestra «mayor.menor» de package.json;
 * cada cambio publicado sube el número.
 */
const VERSION = __VERSION__.split('.').slice(0, 2).join('.');

const compilado = new Date(__COMPILADO__).toLocaleString('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function Version() {
  return (
    <span className="version" title={`Versión ${VERSION} · publicada el ${compilado}`}>
      v{VERSION}
    </span>
  );
}
