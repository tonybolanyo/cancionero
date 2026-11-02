import { Album } from '../types/album';

export const INITIAL_ALBUMS: Album[] = [
  {
    id: 'cartas-sin-sello',
    title: 'Cartas sin sello',
    artist: 'Tony Bolaño',
    year: 2024,
    coverImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop', // subtle fallback or styled CSS
    spotifyUrl: 'https://open.spotify.com/album/2OxjqlugoDnXgt3EbAdmRk',
    youtubeUrl: 'https://www.youtube.com/results?search_query=Tony+Bola%C3%B1o+Cartas+sin+sello',
    appleMusicUrl: 'https://music.apple.com/search?term=Tony+Bola%C3%B1o+Cartas+sin+sello',
    soundcloudUrl: 'https://soundcloud.com/search?q=Tony%20Bola%C3%B1o%20Cartas%20sin%20sello',
    notes: 'Primer disco de estudio de Tony Bolaño. Colección de quince canciones nacidas entre la madera de la guitarra acústica y la tinta de cuadernos viejos. Canciones de autor honestas, grabadas con cercanía y sin artificios, donde la memoria, la nostalgia y la poesía cotidiana tejen un mapa de pequeñas verdades.',
    tracks: [
      {
        id: 'track-1',
        songId: 'cartas-sin-sello',
        title: 'Cartas sin sello',
        order: 1,
        duration: '3:35'
      },
      {
        id: 'track-2',
        songId: 'agua-que-no-se-puede-evitar',
        title: 'Agua que no se puede evitar',
        order: 2,
        duration: '3:56'
      },
      {
        id: 'track-3',
        songId: 'boleros-y-verdades',
        title: 'Boleros y verdades',
        order: 3,
        duration: '3:20'
      },
      {
        id: 'track-4',
        songId: 'barco-que-no-sabe-flotar',
        title: 'Barco que no sabe flotar',
        order: 4,
        duration: '3:45'
      },
      {
        id: 'track-5',
        songId: 'blancanieves-de-oficina',
        title: 'Blancanieves de oficina',
        order: 5,
        duration: '3:50'
      },
      {
        id: 'track-6',
        songId: 'cancion-para-los-cuerdos',
        title: 'Canción para los cuerdos',
        order: 6,
        duration: '4:10'
      },
      {
        id: 'track-7',
        songId: 'cinco-anos-y-un-faro',
        title: 'Cinco años y un faro',
        order: 7,
        duration: '3:30'
      },
      {
        id: 'track-8',
        songId: 'danza-de-marionetas',
        title: 'Danza de marionetas',
        order: 8,
        duration: '3:15'
      },
      {
        id: 'track-9',
        songId: 'el-anden-de-los-invisibles',
        title: 'El andén de los invisibles',
        order: 9,
        duration: '3:40'
      },
      {
        id: 'track-10',
        songId: 'emilio-y-dolores-version-acustica',
        title: 'Emilio y Dolores (Versión acústica)',
        order: 10,
        duration: '3:55'
      },
      {
        id: 'track-11',
        songId: 'erase-una-vez',
        title: 'Érase una vez',
        order: 11,
        duration: '3:25'
      },
      {
        id: 'track-12',
        songId: 'fragil-y-valiente',
        title: 'Frágil y valiente',
        order: 12,
        duration: '3:18'
      },
      {
        id: 'track-13',
        songId: 'la-cortesia-del-filo',
        title: 'La cortesía del filo',
        order: 13,
        duration: '3:42'
      },
      {
        id: 'track-14',
        songId: 'me-quedo',
        title: 'Me quedo',
        order: 14,
        duration: '3:10'
      },
      {
        id: 'track-15',
        songId: 'secreto-al-oido',
        title: 'Secreto al oído',
        order: 15,
        duration: '3:38'
      }
    ],
    createdAt: '2024-05-10T12:00:00.000Z',
    updatedAt: '2026-11-01T16:00:00.000Z'
  },
  {
    id: 'sesiones-acusticas-ineditas',
    title: 'Sesiones Acústicas & Inéditas',
    artist: 'Tony Bolaño',
    year: 2025,
    spotifyUrl: '',
    youtubeUrl: 'https://www.youtube.com',
    appleMusicUrl: '',
    soundcloudUrl: 'https://soundcloud.com',
    notes: 'Grabaciones directas a micrófono abierto. Temas en proceso, composiciones recientes y arreglos desnudos en afinación estándar y compases compuestos.',
    tracks: [
      {
        id: 'track-s1',
        songId: 'algo-quiere-salir',
        title: 'Algo quiere salir',
        order: 1,
        duration: '3:12'
      },
      {
        id: 'track-s2',
        songId: 'mapas-de-papel',
        title: 'Mapas de papel',
        order: 2,
        duration: '3:44'
      },
      {
        id: 'track-s3',
        songId: 'deja-de-quejarte',
        title: 'Deja de quejarte',
        order: 3,
        duration: '3:28'
      },
      {
        id: 'track-s4',
        songId: 'lunes-en-zubrowka',
        title: 'Lunes en Zubrowka',
        order: 4,
        duration: '4:02'
      },
      {
        id: 'track-s5',
        songId: 'emilio-y-dolores',
        title: 'Emilio y Dolores',
        order: 5,
        duration: '3:50'
      },
      {
        id: 'track-s6',
        songId: 'derecho-a-olvidar',
        title: 'Derecho a olvidar',
        order: 6,
        duration: '2:45'
      },
      {
        id: 'track-s7',
        songId: 'si-me-pierdo',
        title: 'Si me pierdo',
        order: 7,
        duration: '3:05'
      },
      {
        id: 'track-s8',
        songId: 'cuerdas-que-no-callan',
        title: 'Cuerdas que no callan',
        order: 8,
        duration: '3:34'
      }
    ],
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2026-10-30T16:00:00.000Z'
  }
];
