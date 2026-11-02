import test from 'node:test';
import assert from 'node:assert/strict';
import { Album } from '../src/types/album';
import { INITIAL_ALBUMS } from '../src/data/initialAlbums';
import { parseHashToRoute, routeToHash } from '../src/context/NavigationContext';

test('Album requires only title, and all other fields are optional', () => {
  const minimalAlbum: Album = {
    id: 'disco-minimo',
    title: 'Mi Disco Acústico',
    tracks: []
  };

  assert.strictEqual(minimalAlbum.title, 'Mi Disco Acústico');
  assert.strictEqual(minimalAlbum.artist, undefined);
  assert.strictEqual(minimalAlbum.year, undefined);
  assert.strictEqual(minimalAlbum.spotifyUrl, undefined);
  assert.strictEqual(minimalAlbum.youtubeUrl, undefined);
  assert.strictEqual(minimalAlbum.appleMusicUrl, undefined);
  assert.strictEqual(minimalAlbum.soundcloudUrl, undefined);
  assert.strictEqual(minimalAlbum.notes, undefined);
});

test('Album includes full streaming links, publication notes, and ordered tracks', () => {
  const cartasSinSello = INITIAL_ALBUMS.find(a => a.id === 'cartas-sin-sello');
  assert.ok(cartasSinSello, 'Cartas sin sello album must exist');
  assert.strictEqual(cartasSinSello.title, 'Cartas sin sello');
  assert.strictEqual(cartasSinSello.artist, 'Tony Bolaño');
  assert.strictEqual(cartasSinSello.year, 2024);
  assert.ok(cartasSinSello.spotifyUrl?.includes('spotify.com'));
  assert.ok(cartasSinSello.appleMusicUrl?.includes('apple.com'));
  assert.ok(cartasSinSello.youtubeUrl?.includes('youtube.com'));
  assert.ok(cartasSinSello.soundcloudUrl?.includes('soundcloud.com'));
  assert.ok(cartasSinSello.notes && cartasSinSello.notes.length > 20);

  // Check tracklist ordering and duration
  assert.strictEqual(cartasSinSello.tracks.length, 15);
  cartasSinSello.tracks.forEach((track, idx) => {
    assert.strictEqual(track.order, idx + 1);
    assert.ok(track.title.length > 0);
    assert.ok(track.songId, 'Track should link to songId in catalog');
  });
});

test('NavigationContext parseHashToRoute correctly parses independent pages for browser history', () => {
  assert.deepStrictEqual(parseHashToRoute(''), { name: 'catalog' });
  assert.deepStrictEqual(parseHashToRoute('#/'), { name: 'catalog' });
  assert.deepStrictEqual(parseHashToRoute('#/albumes'), { name: 'albums' });
  assert.deepStrictEqual(parseHashToRoute('#/discografia'), { name: 'albums' });
  assert.deepStrictEqual(parseHashToRoute('#/album/cartas-sin-sello'), {
    name: 'album-detail',
    albumId: 'cartas-sin-sello'
  });
  assert.deepStrictEqual(parseHashToRoute('#/album/nuevo'), { name: 'album-new' });
  assert.deepStrictEqual(parseHashToRoute('#/album/editar/cartas-sin-sello'), {
    name: 'album-edit',
    albumId: 'cartas-sin-sello'
  });
  assert.deepStrictEqual(parseHashToRoute('#/cancion/agua-que-no-se-puede-evitar'), {
    name: 'song-detail',
    songId: 'agua-que-no-se-puede-evitar'
  });
  assert.deepStrictEqual(parseHashToRoute('#/cancion/nueva'), {
    name: 'song-new',
    initialAlbumId: undefined
  });
  assert.deepStrictEqual(parseHashToRoute('#/cancion/nueva?albumId=cartas-sin-sello'), {
    name: 'song-new',
    initialAlbumId: 'cartas-sin-sello'
  });
  assert.deepStrictEqual(parseHashToRoute('#/cancion/editar/algo-quiere-salir'), {
    name: 'song-edit',
    songId: 'algo-quiere-salir'
  });
  assert.deepStrictEqual(parseHashToRoute('#/cancionero-atril'), { name: 'songbook' });
  assert.deepStrictEqual(parseHashToRoute('#/analizador-audio'), { name: 'audio-analyzer' });
  assert.deepStrictEqual(parseHashToRoute('#/acerca-de'), { name: 'about' });
  assert.deepStrictEqual(parseHashToRoute('#/git-sync'), { name: 'git-sync' });
  assert.deepStrictEqual(parseHashToRoute('#/importar-spotify'), { name: 'spotify-import' });
});

test('NavigationContext routeToHash converts routes to corresponding browser hash', () => {
  assert.strictEqual(routeToHash({ name: 'catalog' }), '#/');
  assert.strictEqual(routeToHash({ name: 'albums' }), '#/albumes');
  assert.strictEqual(routeToHash({ name: 'album-detail', albumId: 'cartas-sin-sello' }), '#/album/cartas-sin-sello');
  assert.strictEqual(routeToHash({ name: 'song-detail', songId: 'agua-que-no-se-puede-evitar' }), '#/cancion/agua-que-no-se-puede-evitar');
  assert.strictEqual(routeToHash({ name: 'songbook' }), '#/cancionero-atril');
});
