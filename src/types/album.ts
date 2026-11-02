export interface AlbumTrack {
  id?: string;
  songId?: string; // ID of the Song in the catalog (if linked)
  title: string;
  order: number;
  duration?: string; // e.g. "3:45"
}

export interface Album {
  id: string; // Unique slug e.g. 'cartas-sin-sello'
  title: string; // Required (Solo el título es obligatorio)
  artist?: string; // Artista del álbum (opcional)
  year?: number; // Año de publicación (opcional)
  coverImage?: string; // Enlace o imagen de portada (opcional)
  spotifyUrl?: string; // Enlace a Spotify (opcional)
  youtubeUrl?: string; // Enlace a YouTube (opcional)
  appleMusicUrl?: string; // Enlace a Apple Music (opcional)
  soundcloudUrl?: string; // Enlace a SoundCloud (opcional)
  notes?: string; // Notas de publicación o acerca del álbum (opcional)
  tracks: AlbumTrack[]; // Listado de canciones con orden, duración y enlace a la ficha de la canción
  createdAt?: string;
  updatedAt?: string;
}
