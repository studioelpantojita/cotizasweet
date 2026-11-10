import {catalog, addons, projectTypes, type ProjectType} from './quote';
import {showcase} from './sweet-showcase';

export const quoteCtaLabel = 'Cotizar mi proyecto';
export const quoteHref = (project: ProjectType = 'custom') => `/cotizar?proyecto=${project}`;

type Presentation = {
  headline: string;
  description: string;
  image: string;
  imageAlt: string;
  contain?: boolean;
  services: string[];
  pieces: string[];
  details: string;
};

// Editorial suggestions reference the existing services; they do not create a package or a price.
export const projectPresentations: Record<ProjectType, Presentation> = {
  bodas: {
    headline: 'Un sí. Mil pequeños detalles.',
    description: 'Una mesa dulce y obsequios que acompañan la celebración. Combina mini repostería, macarons y una presentación en armonía con tu boda.',
    image: 'wedding.jpg', imageAlt: 'Torta de dos pisos con flores en tonos borgoña, inspiración para una boda',
    services: ['sweet', 'minibox', 'macarons', 'empaque'],
    pieces: ['cheesecake-frutos-rojos', 'macarons-napoleon', 'chocolates-royale'],
    details: 'Número de invitados, paleta de colores, selección de sabores y coordinación del montaje y la entrega.',
  },
  cumpleanos: {
    headline: 'Una vuelta al sol, a tu manera.',
    description: 'Elige piezas para compartir y pequeños detalles para tus invitados. La temática y los colores orientan una composición personal para el cumpleaños.',
    image: 'sweet-delicia-fresas.png', imageAlt: 'Torta de fresas en capas como referencia para un cumpleaños',
    services: ['sweet', 'minibox', 'macarons', 'etiquetas'],
    pieces: ['delicia-fresas', 'ositos-leche', 'macarons-valentin'],
    details: 'Edad, temática, cantidad de invitados, sabores y fecha de la celebración.',
  },
  quinceaneras: {
    headline: 'Una celebración con sello propio.',
    description: 'Mini repostería, colores y obsequios reunidos alrededor de una misma idea. Define una selección que dialogue con el estilo de tus quince años.',
    image: 'sweet-macarons-valentin.png', imageAlt: 'Estuche rosa de macarons, inspiración de color para una celebración de quince años', contain: true,
    services: ['sweet', 'minibox', 'etiquetas', 'empaque'],
    pieces: ['macarons-valentin', 'tarta-frutos-rojos', 'ositos-oscuro'],
    details: 'Temática, paleta, invitados, etiquetas y presentación de cada obsequio.',
  },
  'baby-shower': {
    headline: 'La más dulce de las bienvenidas.',
    description: 'Pequeñas piezas y cajas para compartir la ilusión. Combina mini repostería y acabados delicados para los invitados a tu Baby Shower VIP.',
    image: 'sweet-ositos-leche.png', imageAlt: 'Dúo de ositos de chocolate en cajas verdes, referencia de obsequio para Baby Shower', contain: true,
    services: ['minibox', 'macarons', 'etiquetas', 'empaque'],
    pieces: ['ositos-leche', 'macarons-intemporel', 'cheesecake-frutos-rojos'],
    details: 'Cantidad de obsequios, colores, mensaje de las etiquetas y modalidad de entrega.',
  },
  empresas: {
    headline: 'El buen gusto también comunica.',
    description: 'Atenciones para equipos, clientes y encuentros empresariales. Cajas de mini repostería o desayunos con opciones de empaque y etiquetas para tu identidad corporativa.',
    image: 'minibox.jpg', imageAlt: 'Caja de mini repostería con lazo de satén, referencia de regalo corporativo',
    services: ['breakfast', 'minibox', 'etiquetas', 'empaque'],
    pieces: ['chocolates-royale', 'macarons-napoleon', 'chocolates-champs'],
    details: 'Destinatarios, cantidades, logotipo, aprobación del arte y coordinación de la entrega.',
  },
  rrpp: {
    headline: 'Un detalle que cuenta tu historia.',
    description: 'Obsequios de prensa y selecciones para invitados de agencias. Vincula la composición dulce con el concepto de campaña mediante etiquetas y acabados por coordinar.',
    image: 'sweet-macarons-eugenie.png', imageAlt: 'Estuche desplegable de macarons, referencia de presentación para una campaña', contain: true,
    services: ['minibox', 'sweet', 'etiquetas', 'empaque'],
    pieces: ['macarons-eugenie', 'chocolates-royale', 'ositos-oscuro'],
    details: 'Concepto de campaña, lista de destinatarios, identidad visual y fecha de presentación.',
  },
  bancos: {
    headline: 'Atenciones que dejan huella.',
    description: 'Presentaciones para bancos, entidades y organizaciones que buscan agradecer o recibir a sus invitados. Define el formato y los detalles de identidad institucional.',
    image: 'sweet-chocolates-champs.png', imageAlt: 'Estuche de chocolates de presentación sobria, referencia de atención institucional', contain: true,
    services: ['breakfast', 'minibox', 'etiquetas', 'empaque'],
    pieces: ['chocolates-champs', 'macarons-napoleon', 'chocolates-royale'],
    details: 'Tipo de entidad, destinatarios, cantidad de cajas, logotipo y coordinación de entrega.',
  },
  custom: {
    headline: 'Tu idea es el punto de partida.',
    description: 'Construye una selección con los packs y adicionales del catálogo. Comparte el propósito de tu proyecto y define con el negocio los ingredientes, formatos y acabados.',
    image: 'sweet-pera-tropical.jpg', imageAlt: 'Torta con frutas de distintos colores, inspiración para un proyecto a medida',
    services: ['breakfast', 'minibox', 'sweet', 'macarons', 'etiquetas', 'empaque'],
    pieces: ['pera-tropical', 'macarons-intemporel', 'chocolates-champs'],
    details: 'Objetivo, presupuesto, cantidades, preferencias, fecha y alcance de la propuesta.',
  },
  fitness: {
    headline: 'Tus preferencias, en cada elección.',
    description: 'Comparte tus preferencias de ingredientes y porciones para que el negocio evalúe una selección. Las adaptaciones y cualquier información nutricional requieren confirmación.',
    image: 'sweet-tarta-pistacho.png', imageAlt: 'Tarta de pistacho como referencia visual; composición nutricional por verificar',
    services: ['breakfast', 'minibox', 'sweet'],
    pieces: ['tarta-pistacho', 'pera-tropical', 'cheesecake-new-york'],
    details: 'Preferencias, porciones, ingredientes solicitados y revisión de la ficha de insumos. Las fotografías no garantizan propiedades nutricionales.',
  },
  alergias: {
    headline: 'Cada ingrediente merece atención.',
    description: 'Registra los alérgenos y las necesidades de tu proyecto. El negocio revisa ingredientes, proveedores y posible contacto cruzado antes de confirmar cualquier adaptación.',
    image: 'sweet-cheesecake-frutos-rojos.jpg', imageAlt: 'Cheesecake de frutos rojos como referencia visual, sin garantía de ausencia de alérgenos',
    services: ['breakfast', 'minibox', 'sweet'],
    pieces: ['cheesecake-frutos-rojos', 'tarta-frutos-rojos', 'tocino-cielo'],
    details: 'Alérgenos declarados, restricciones y resultado de la revisión del negocio. Ninguna imagen implica que un producto sea apto para una alergia.',
  },
  cocteles: {
    headline: 'Pequeñas piezas. Una gran ocasión.',
    description: 'Mini repostería y macarons para acompañar recepciones y cócteles de moda. Define una composición de degustación acorde con la estética y el ritmo de tu encuentro.',
    image: 'sweet.jpg', imageAlt: 'Selección de mini postres, cupcakes y macarons para una recepción',
    services: ['minibox', 'sweet', 'macarons'],
    pieces: ['macarons-intemporel', 'chocolates-champs', 'tarta-pistacho'],
    details: 'Número de asistentes, cantidad de piezas, horario, presentación y montaje por coordinar.',
  },
  lanzamientos: {
    headline: 'Tu marca, en una nueva expresión.',
    description: 'Una selección dulce inspirada en el concepto de tu lanzamiento. Combina packs, macarons, etiquetas con logotipo y empaques para construir una presentación coherente.',
    image: 'sweet.jpg', imageAlt: 'Mesa con mini repostería y macarons, referencia de composición para un lanzamiento de marca',
    services: ['sweet', 'minibox', 'macarons', 'etiquetas', 'empaque'],
    pieces: ['macarons-eugenie', 'chocolates-royale', 'osito-xxl'],
    details: 'Concepto creativo, paleta, logotipo, número de invitados y coordinación de la presentación.',
  },
};

export function projectsInCollection(group: typeof projectTypes[number]['group']) {
  const projects = projectTypes.filter(p => p.group === group);
  return group === 'amedida' ? [...projects].sort((a,b) => Number(b.id === 'custom') - Number(a.id === 'custom')) : projects;
}

export function presentationFor(project: ProjectType) {
  const presentation = projectPresentations[project];
  return {
    ...presentation,
    services: presentation.services.map(id => [...catalog, ...addons].find(s => s.id === id)!),
    pieces: presentation.pieces.map(id => showcase.find(p => p.id === id)!),
  };
}
