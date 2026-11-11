import { useState } from 'react';
import { CONTACTO, LOCALIDADES, TIPOS, enlaceWhatsapp } from '../datos';
import { IcoEscritura, IcoSuperficie, IcoUbicacion, IcoWhatsapp, IcoMail } from './iconos';
import { Desplegable } from './Desplegable';

/**
 * Tasaciones: para quien quiere vender y saber cuánto vale su
 * propiedad. Explica cómo es y tiene un formulario que arma el pedido y lo
 * manda por WhatsApp o email (los de CONTACTO en datos.ts). Mientras esos
 * datos no estén cargados, el pedido se muestra armado y se invita a pasar
 * por la oficina.
 */
const PASOS = [
  { titulo: 'Nos contás de tu propiedad', texto: 'Dónde está, qué es y cómo es. Con eso ya podemos darte una primera idea.' },
  { titulo: 'La visitamos', texto: 'Coordinamos un día para verla en persona y revisar la documentación.' },
  { titulo: 'Te damos el valor', texto: 'Comparamos con lo que se vende en la zona y te pasamos un valor real de mercado.' },
];

export function Tasaciones() {
  const [d, setD] = useState({ nombre: '', telefono: '', tipo: 'Casa', localidad: '', direccion: '', superficie: '', comentario: '' });
  const [listo, setListo] = useState<string | null>(null);
  const cambiar = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target.value });

  // Todo es obligatorio menos el comentario. Hasta que esté completo, el botón
  // no se puede apretar. El teléfono tiene que tener al menos 8 números.
  const faltan = [
    !d.nombre.trim() && 'nombre',
    d.telefono.replace(/\D/g, '').length < 8 && 'teléfono',
    !d.localidad.trim() && 'localidad',
    !d.superficie.trim() && 'superficie',
    !d.direccion.trim() && 'dirección o barrio',
  ].filter(Boolean) as string[];
  const completo = faltan.length === 0;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completo) return;
    const mensaje = [
      'Hola, les escribo desde la web. Quiero tasar una propiedad para venderla.',
      `Tipo: ${d.tipo}`,
      `Localidad: ${d.localidad}`,
      `Dirección o barrio: ${d.direccion}`,
      `Superficie aproximada: ${d.superficie}`,
      d.comentario && `Comentario: ${d.comentario}`,
      `Nombre: ${d.nombre}`,
      `Teléfono: ${d.telefono}`,
    ].filter(Boolean).join('\n');
    const wa = enlaceWhatsapp(mensaje);
    if (wa) {
      window.open(wa, '_blank', 'noopener');
      return;
    }
    if (CONTACTO.email) {
      window.location.href = `mailto:${CONTACTO.email}?subject=${encodeURIComponent('Pedido de tasación')}&body=${encodeURIComponent(mensaje)}`;
      return;
    }
    setListo(mensaje);
  };

  return (
    <>
      <section className="seccion">
        <div className="pagina__cab">
          <p className="pagina__pre">Tasaciones</p>
          <h1>¿Cuánto vale tu propiedad?</h1>
          <p>
            Si estás pensando en vender, el primer paso es saber su valor real. Te la tasamos
            según el mercado de la zona.
          </p>
        </div>

        <div className="pasos">
          {PASOS.map((p, i) => (
            <div key={p.titulo} className="paso vidrio">
              <span className="paso__num">{i + 1}</span>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="seccion">
        <div className="tasar vidrio">
          <div className="tasar__lado">
            <h2>Pedí tu tasación</h2>
            <p>Completá lo que sepas y te contactamos para coordinar la visita.</p>
            <ul className="tasar__lista">
              <li><IcoUbicacion /> Casas, departamentos, lotes, locales y campos</li>
              <li><IcoSuperficie /> Valor según lo que se vende en la zona</li>
              <li><IcoEscritura /> Revisamos la documentación con vos</li>
            </ul>
          </div>

          {listo ? (
            <div className="tasar__listo">
              <h3>¡Gracias! Este es tu pedido</h3>
              <pre>{listo}</pre>
              <p>
                Acercate a la oficina en {CONTACTO.direccion}, {CONTACTO.localidad}, o llamanos, y lo
                coordinamos.
              </p>
              <button type="button" className="btn btn--suave" onClick={() => setListo(null)}>Volver al formulario</button>
            </div>
          ) : (
            <form className="formulario" onSubmit={enviar}>
              <label className="campo">
                <span className="campo__et">Nombre <span className="obligatorio" aria-hidden="true">*</span></span>
                <input required value={d.nombre} onChange={cambiar('nombre')} autoComplete="name" />
              </label>
              <label className="campo">
                <span className="campo__et">Teléfono <span className="obligatorio" aria-hidden="true">*</span></span>
                <input required type="tel" inputMode="tel" value={d.telefono} onChange={cambiar('telefono')} autoComplete="tel" placeholder="Ej.: 3525 123456" />
              </label>
              <div className="campo">
                <span className="campo__et">Tipo <span className="obligatorio" aria-hidden="true">*</span></span>
                <Desplegable
                  clase="despl--campo"
                  ariaLabel="Tipo de propiedad"
                  valor={d.tipo}
                  opciones={[...TIPOS, 'Local', 'Galpón', 'Otro'].map((t) => ({ valor: t, texto: t }))}
                  alCambiar={(v) => setD({ ...d, tipo: v })}
                />
              </div>
              <label className="campo">
                <span className="campo__et">Localidad <span className="obligatorio" aria-hidden="true">*</span></span>
                <input required list="tasar-localidades" value={d.localidad} onChange={cambiar('localidad')} />
                <datalist id="tasar-localidades">
                  {LOCALIDADES.map((l) => <option key={l} value={l} />)}
                </datalist>
              </label>
              <label className="campo">
                <span className="campo__et">Superficie aproximada <span className="obligatorio" aria-hidden="true">*</span></span>
                <input required value={d.superficie} onChange={cambiar('superficie')} placeholder="Ej.: 300 m² de terreno" />
              </label>
              <label className="campo campo--entero">
                <span className="campo__et">Dirección o barrio <span className="obligatorio" aria-hidden="true">*</span></span>
                <input required value={d.direccion} onChange={cambiar('direccion')} />
              </label>
              <label className="campo campo--entero">
                <span className="campo__et">Algo más que quieras contarnos <span className="opcional">(opcional)</span></span>
                <textarea value={d.comentario} onChange={cambiar('comentario')} rows={3} />
              </label>
              <p className="formulario__nota" aria-live="polite">
                {completo ? 'Listo, ya podés enviarlo.' : `Para enviar falta completar: ${faltan.join(', ')}.`}
              </p>
              <button className="btn btn--primario formulario__enviar" type="submit" disabled={!completo}>
                {CONTACTO.whatsapp ? <><IcoWhatsapp /> Enviar por WhatsApp</> : CONTACTO.email ? <><IcoMail /> Enviar por email</> : 'Pedir tasación'}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
