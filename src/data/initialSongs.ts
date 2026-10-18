import { Song } from '../types/song';

export const INITIAL_SONGS: Song[] = [
  {
    id: 'noches-de-cristal',
    title: 'Noches de Cristal',
    status: 'published',
    year: 2024,
    genre: 'Indie Folk / Autor',
    key: 'Am',
    tempo: 92,
    timeSignature: '4/4',
    tuning: 'Estándar (EADGBE)',
    duration: '3:48',
    spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    youtubeUrl: 'https://www.youtube.com/watch?v=kXYiU_JCYtU',
    soundcloudUrl: 'https://soundcloud.com/tonygb-music/noches-de-cristal',
    audioUrl: 'https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3', // sample demo audio
    coverImage: '/src/assets/images/songwriter_studio_banner_1792313088629.jpg',
    notes: 'Compuesta en una noche lluviosa de noviembre. Arreglo principal con guitarra acústica de cuerdas de fósforo y bronce en fingerpicking lento. El puente añade cuarteto de cuerdas sutil.',
    tags: ['acústico', 'en vivo', 'guitarra', 'nocturno'],
    lyrics: `## Estrofa 1
[Am] Caminando por la calle ancha de los [F] faroles rotos,
[C] voy juntando en el bolsillo pedazos [G] de viejas fotos.
[Am] El asfalto devuelve un brillo [F] de plata y frío,
[C] mientras la ciudad olvida que alguna vez [G] tuviste un río.

## Estribillo
[F] Y en estas noches de [C] cristal,
[G] donde nadie se atreve [Am] a hablar,
[F] dejamos la persiana [C] abierta
[G] para ver el tiempo [Am] pasar.
[F] Si me buscas al final de la [C] acera,
[G] quédate con lo que [Am] queda.

## Estrofa 2
[Am] Hay campanas que suenan lejos pero [F] ya no llaman a misa,
[C] solo marcan las horas lentas de los [G] que llevan prisa.
[Am] Tuve un mapa doblado en cuatro que [F] perdió su tinta,
[C] cada vez que volvemos al principio la [G] verdad es distinta.

## Puente
[Dm] No es nostalgia de lo que [Am] fuimos,
[F] es el eco de las piedras que [C] pisamos de niños.
[Dm] Si la tormenta no apaga [Am] el faro,
[G] sabremos que valió la pena pagar lo más caro.

## Estribillo
[F] Y en estas noches de [C] cristal,
[G] donde nadie se atreve [Am] a hablar,
[F] dejamos la persiana [C] abierta
[G] para ver el tiempo [Am] pasar.

## Coda
[Am] [F] [C] [G]
[Am] Pedazos de cristal... pedazos de cristal. [Am]`,
    createdAt: '2024-04-10T12:00:00Z',
    updatedAt: '2025-01-15T18:30:00Z',
    gitHash: '7b2a9f1'
  },
  {
    id: 'faro-de-sal',
    title: 'Faro de Sal',
    status: 'published',
    year: 2025,
    genre: 'Balada Acústica',
    key: 'G',
    tempo: 84,
    timeSignature: '3/4',
    tuning: 'Drop D (DADGBE)',
    duration: '4:12',
    spotifyUrl: 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp',
    youtubeUrl: 'https://www.youtube.com/watch?v=2Vv-BfVoq4g',
    soundcloudUrl: 'https://soundcloud.com/tonygb-music/faro-de-sal',
    audioUrl: 'https://cdn.freesound.org/previews/566/566435_5674468-lq.mp3',
    notes: 'Inspirada en los acantilados de la costa gallega. Compás en 3/4 estilo vals marino con afinación Drop D para darle profundidad al bajo.',
    tags: ['acústico', 'colaboración', 'mar', 'vals'],
    lyrics: `## Estrofa 1
[G] La marea sube lenta hacia el [Em] muelle,
[C] el salitre quema el casco de [D] roble.
[G] Hay un viento que nunca se [Em] duerme
[C] y un farero de mirada [D] noble.

## Estrofa 2
[G] Encendemos la lámpara de [Em] aceite,
[C] que la niebla borró el horizonte.
[G] Si la barca de Pedro no [Em] vuelve,
[C] dejaremos su red en el [D] monte.

## Estribillo
[C] Faro de sal, vela de [G] espuma,
[Em] guíanos antes de que caiga [D] la luna.
[C] Quién pudiera coser la orilla al [G] mar
[Am] y no tener que [D] naufragar. [G]

## Puente
[Bm] Los secretos que guarda la [C] roca
[Am] no los dice ninguna [D] boca.
[Bm] Solo el oleaje al romper [C] bajito
[Am] recuerda lo que un día fue un [D] grito.

## Estribillo
[C] Faro de sal, vela de [G] espuma,
[Em] guíanos antes de que caiga [D] la luna.
[C] Quién pudiera coser la orilla al [G] mar
[Am] y no tener que [D] naufragar. [G]`,
    createdAt: '2025-02-14T09:00:00Z',
    updatedAt: '2025-08-20T11:15:00Z',
    gitHash: 'c4e819b'
  },
  {
    id: 'la-raiz-del-viento',
    title: 'La Raíz del Viento',
    status: 'published',
    year: 2025,
    genre: 'Folk Rock de Autor',
    key: 'D',
    tempo: 116,
    timeSignature: '4/4',
    tuning: 'Estándar (EADGBE)',
    duration: '3:30',
    spotifyUrl: 'https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3',
    youtubeUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
    audioUrl: 'https://cdn.freesound.org/previews/689/689320_5674468-lq.mp3',
    notes: 'Tema rítmico con percusión acústica sobre el cuerpo de la guitarra y armónica en re mayor en la introducción.',
    tags: ['en vivo', 'banda', 'armónica', 'enérgico'],
    lyrics: `## Introducción (Armónica en Re)
[D] [G] [Bm] [A]

## Estrofa 1
[D] Nací en un valle donde los álamos
[G] doblan la espalda sin protestar,
[Bm] aprendí temprano que lo que arraiga hondo
[A] nunca se aprende a soltar.

## Estrofa 2
[D] Traigo en las botas el polvo rojo
[G] de los caminos que nadie andó,
[Bm] y en la garganta la misma espina
[A] que a los veintidós me dolió.

## Estribillo
[G] Porque el viento no tiene [D] raíz,
[A] pero mueve la copa del [Bm] pino.
[G] Si me pierdo buscando un [D] país,
[A] que me busquen detrás del [D] camino.

## Puente
[Em] Déjame correr contra la loma,
[Bm] deja que el aire me limpie la voz.
[G] Toda frontera que el hombre levanta
[A] se cae cuando soplamos los dos.

## Estribillo Final
[G] Porque el viento no tiene [D] raíz,
[A] pero mueve la copa del [Bm] pino.
[G] Si me pierdo buscando un [D] país,
[A] que me busquen detrás del [D] camino.`,
    createdAt: '2025-06-01T15:00:00Z',
    updatedAt: '2025-11-04T16:45:00Z',
    gitHash: 'e1d93aa'
  },
  {
    id: 'laberintos-de-otono',
    title: 'Laberintos de Otoño',
    status: 'draft',
    year: 2026,
    genre: 'Canción de Autor / Acústica',
    key: 'Em',
    tempo: 96,
    timeSignature: '4/4',
    tuning: 'Estándar (EADGBE)',
    notes: 'Borrador en proceso de revisión. Pendiente de cerrar el texto del estribillo (ver notas entre corchetes). El tempo puede oscilar entre 90 y 98 bpm.',
    tags: ['maqueta', 'acústico', 'otoño', 'balada'],
    lyrics: `## Estrofa 1 (Revisada)
[Em] Caían las hojas como billetes viejos
[C] sobre los bancos de hierro del bulevar.
[G] Nos prometimos mirarnos desde lejos
[D] sin la tentación de volver a cruzar.

## Estrofa 2
[Em] El té se enfría en la taza de porcelana,
[C] suena de fondo una radio de transistores.
[G] Hay un canario que canta en la ventana
[D] de un piso habitado por inventores.

## Estribillo (Borrador - Versión B)
[C] Y en estos laberintos de [G] otoño,
[D] donde cada esquina huele a leña [Em] mojada,
[C] no sé si busco tu mano o tu [G] sombra
[D] o simplemente no busco [Em] nada.

## Ideas para el Puente (Sin pulir)
[Am] [Em] Probar modulando a Sol mayor
Verso tentativo: "La ciudad se apaga antes de las diez / y la lluvia es una aguja en la piel..."`,
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-10-15T09:20:00Z',
    gitHash: '93f0b42'
  },
  {
    id: 'memoria-del-agua',
    title: 'Memoria del Agua',
    status: 'draft',
    year: 2026,
    genre: 'Poesía Musicalizada',
    key: 'C#m',
    tempo: 78,
    timeSignature: '6/8',
    tuning: 'DADGAD (Cejilla al 2)',
    notes: 'Composición modal en DADGAD. Muy etérea. Falta grabar maqueta de voz con micro de condensador.',
    tags: ['maqueta', 'poesía', 'modal', 'DADGAD'],
    lyrics: `## Estrofa 1
[C#m] Dicen que el río que baja del puerto
[A] guarda los nombres de los que se fueron,
[E] que si te agachas con el oído despierto
[B] oyes sus risas en los aguaceros.

## Estrofa 2
[C#m] Yo vine aquí sin maleta ni rumbo,
[A] solo con esta madera curvada,
[E] para cantar lo que pasa en un segundo
[B] cuando no queda razón ni coartada.

## Estribillo (En prueba)
[A] El agua no olvida la [E] piedra,
[B] la piedra no frena el [C#m] caudal.
[A] Todo lo dulce se [E] enreda
[B] cuando regresa al canal.`,
    createdAt: '2026-07-04T18:00:00Z',
    updatedAt: '2026-09-28T22:10:00Z',
    gitHash: '4a18ce0'
  },
  {
    id: 'el-ultimo-tren-a-finisterre',
    title: 'El Último Tren a Finisterre',
    status: 'private',
    year: 2026,
    genre: 'Canción Inédita / Íntima',
    key: 'C',
    tempo: 104,
    timeSignature: '4/4',
    tuning: 'Estándar (Capo al 3)',
    notes: 'Canción privada / confidencial. Escrita para familiares y círculo cercano. No distribuir enlaces públicos por el momento.',
    tags: ['íntimo', 'colaboración', 'acústico', 'inédita'],
    lyrics: `## Estrofa 1
[C] Compré el billete de ida en ventanilla,
[Am] la señora del cristal me miró raro.
[F] "¿Seguro que va al fin de la orilla?",
[G] "Seguro, que allá todo es más claro".

## Estrofa 2
[C] Los vagones olían a tabaco negro,
[Am] a maletas de cartón y a despedida.
[F] A través de la ventana yo celebro
[G] que todavía me importe esta vida.

## Estribillo
[F] Y rueda el tren sobre las [C] traviesas,
[G] dejando atrás promesas y [Am] tristeza.
[F] Si llegamos antes del [C] amanecer,
[G] veremos el océano [C] arder.

## Estrofa 3
[C] Cuando lleguemos a la última estación,
[Am] tiraré las llaves al acantilado.
[F] Ya no hace falta cerrar la habitación
[G] de quien viaja sin ningún pecado.

## Coda
[F] [C] [G] [C]
[C] Finisterre... fin del mundo y fin de la sed. [C]`,
    createdAt: '2026-08-12T14:00:00Z',
    updatedAt: '2026-10-02T11:40:00Z',
    gitHash: '6d7e25a'
  }
];
