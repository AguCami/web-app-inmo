import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LOCALIDADES, PROPIEDADES, TIPOS, precioOrdenable, recientes, tipoDeFiltro, type Propiedad } from '../datos';
import { Tarjeta } from './Tarjeta';
import { IcoBuscar } from './iconos';

const DE_A = 24;

type Orden = 'recientes' | 'menor' | 'mayor';

function sinAcentos(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Todas las propiedades, con filtros. Los filtros viven en la dirección
 * (?tipo=Casa&loc=…), así una búsqueda se puede compartir o volver atrás.
 */
export function Listado() {
  const [params, setParams] = useSearchParams();
  const tipo = params.get('tipo') ?? '';
  const loc = params.get('loc') ?? '';
  const texto = params.get('q') ?? '';
  const orden = (params.get('orden') as Orden) || 'recientes';
  const [cuantas, setCuantas] = useState(DE_A);

  const cambiar = (clave: string, valor: string) => {
    const nuevo = new URLSearchParams(params);
    if (valor) nuevo.set(clave, valor);
    else nuevo.delete(clave);
    setParams(nuevo, { replace: true });
    setCuantas(DE_A);
  };

  const lista = useMemo(() => {
    const q = sinAcentos(texto.trim());
    let r: Propiedad[] = PROPIEDADES.filter(
      (p) =>
        (!tipo || tipoDeFiltro(p) === tipo) &&
        (!loc || p.localidad === loc) &&
        (!q || sinAcentos(`${p.titulo} ${p.localidad} ${p.codigo} ${p.tipo}`).includes(q)),
    );
    r = recientes(r);
    if (orden !== 'recientes') {
      // Los que no tienen un precio comparable («Consultar», por hectárea) van al final.
      r.sort((a, b) => {
        const pa = precioOrdenable(a);
        const pb = precioOrdenable(b);
        if (pa === null) return pb === null ? 0 : 1;
        if (pb === null) return -1;
        return orden === 'menor' ? pa - pb : pb - pa;
      });
    }
    return r;
  }, [tipo, loc, texto, orden]);

  const hayFiltros = tipo || loc || texto;

  return (
    <section className="seccion seccion--listado">
      <div className="seccion__cab">
        <div>
          <h1>Propiedades</h1>
          <p>
            {lista.length === PROPIEDADES.length
              ? `${lista.length} publicadas`
              : `${lista.length} de ${PROPIEDADES.length}`}
          </p>
        </div>
      </div>

      <div className="filtros vidrio">
        <div className="filtros__tipos" role="group" aria-label="Tipo de propiedad">
          {['', ...TIPOS, 'Otros'].map((t) => (
            <button
              key={t || 'todas'}
              type="button"
              className={tipo === t ? 'filtro filtro--activa' : 'filtro'}
              aria-pressed={tipo === t}
              onClick={() => cambiar('tipo', t)}
            >
              {t === '' ? 'Todas' : t === 'Lote' ? 'Lotes' : t === 'Otros' ? 'Otros' : `${t}s`}
            </button>
          ))}
        </div>
        <div className="filtros__resto">
          <label className="filtros__buscar">
            <IcoBuscar />
            <input
              type="search"
              placeholder="Buscar por barrio, calle o código"
              value={texto}
              onChange={(e) => cambiar('q', e.target.value)}
              aria-label="Buscar"
            />
          </label>
          <select value={loc} onChange={(e) => cambiar('loc', e.target.value)} aria-label="Localidad">
            <option value="">Todas las localidades</option>
            {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={orden} onChange={(e) => cambiar('orden', e.target.value === 'recientes' ? '' : e.target.value)} aria-label="Orden">
            <option value="recientes">Más recientes</option>
            <option value="menor">Menor precio</option>
            <option value="mayor">Mayor precio</option>
          </select>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="sin-resultados vidrio">
          <p>No hay propiedades con esos filtros.</p>
          {hayFiltros && (
            <button className="btn btn--suave" type="button" onClick={() => setParams({}, { replace: true })}>
              Ver todas
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grilla">
            {lista.slice(0, cuantas).map((p) => <Tarjeta key={p.codigo} p={p} />)}
          </div>
          {cuantas < lista.length && (
            <div className="mas">
              <button className="btn btn--suave" type="button" onClick={() => setCuantas((c) => c + DE_A)}>
                Ver más ({lista.length - cuantas} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
