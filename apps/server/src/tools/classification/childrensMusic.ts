/**
 * Children's-music classification.
 *
 * Spotify exposes no authoritative "this is for children" flag, so this
 * combines the two signals that research showed to be reliable:
 *
 * 1. Spotify's own genre vocabulary. "children's music" is a real Spotify
 *    genre tag (observed in production data), and Spotify's published genre
 *    vocabulary also contains `nursery`, `kids dance party`, `kids hip hop`,
 *    `kindie rock`, `lullaby`, `children's story`, `children's folk`,
 *    `children's choir`, `preschool children's music` and regional variants
 *    such as `british children's music`.
 * 2. A curated list of well-known children's brands whose artists frequently
 *    carry an empty or wrong genre list. Spotify marks artist `genres` as
 *    deprecated and it is empty for a large share of artists, so genre alone
 *    under-detects.
 *
 * Deliberately excluded from matching: bare words like "baby", "kids",
 * "family" or "story". They match mainstream adult tracks (for example
 * "Kids" by MGMT or "Baby" by Justin Bieber) far too often, which is why the
 * brand patterns below are specific multi-word phrases. Everything matched is
 * reviewable and reversible in Settings.
 */

/** Multi-word children's brands; matched against the whole artist name. */
export const CHILDRENS_MUSIC_ARTIST_PATTERNS: readonly RegExp[] = [
  /cocomelon/i,
  /pinkfong/i,
  /kidz ?bop/i,
  /super simple (songs|learning)/i,
  /mother goose club/i,
  /the kiboomers/i,
  /learning station/i,
  /story ?bots/i,
  /peppa pig/i,
  /paw patrol/i,
  /sesame street/i,
  /disney junior/i,
  /nick ?jr/i,
  /toddler tunes/i,
  /nursery rhymes?/i,
  /songs for children/i,
  /children'?s songs?/i,
  /kids songs?/i,
  /the wiggles/i,
  /daniel tiger/i,
  /thomas (and|&) friends/i,
  /veggie ?tales/i,
  /teletubbies/i,
  /octonauts/i,
  /dora the explorer/i,
  /blue'?s clues/i,
  /little baby bum/i,
  /chuchu ?tv/i,
  /dave and ava/i,
  /blippi/i,
  /barney (and|&) friends/i,
  /blues clues/i,
  /hey duggee/i,
  /mr ?tumble/i,
  /baby einstein/i,
  /melody ?kids/i,
  /melo\.?kids/i,
  /sing.?along (songs|kids)/i,
  /the learning groove/i,
  /jack hartmann/i,
  /dr\.? jean/i,
  /have fun teaching/i,
  /kid ?stories/i,
  /bounce patrol/i,
  /the singing walrus/i,
  /noodle ?loos/i,
  /go ?noodle/i,
  /twinkle little songs?/i,
  /looloo kids/i,
  /farmees/i,
  /toy ?orchestra/i,
  /kids learning tube/i,
  /story ?time with/i,
];

/** Genre labels (normalized) that identify children's content. */
const CHILDRENS_MUSIC_EXACT_GENRES = new Set([
  "childrens music",
  "preschool childrens music",
  "childrens folk",
  "childrens choir",
  "childrens story",
  "childrens songs",
  "kids dance party",
  "kids hip hop",
  "kindie rock",
  "kindie",
  "nursery",
  "lullaby",
  "instrumental lullaby",
  "baby music",
  "childrens rhyme",
  "nursery rhyme",
]);

/** Normalizes a Spotify genre for comparison. */
export function normalizeGenre(genre: string): string {
  return genre
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when any of Spotify's genres marks the artist as children's music. */
export function hasChildrensMusicGenre(
  genres: readonly string[] | undefined,
): boolean {
  if (!genres || genres.length === 0) {
    return false;
  }
  return genres.some((genre) => {
    const normalized = normalizeGenre(genre);
    if (CHILDRENS_MUSIC_EXACT_GENRES.has(normalized)) {
      return true;
    }
    // Regional variants: "british children's music", "nz children's music".
    return (
      normalized.endsWith("childrens music") ||
      normalized.endsWith("childrens story")
    );
  });
}

/** True when the artist name matches a known children's brand. */
export function hasChildrensMusicArtistName(name: string | undefined): boolean {
  if (!name) {
    return false;
  }
  return CHILDRENS_MUSIC_ARTIST_PATTERNS.some((pattern) => pattern.test(name));
}

export type ChildrensMusicArtistSignal = "genre" | "artist" | null;

/**
 * Classifies an artist as children's music using the genre signal first
 * (most precise) and the curated brand list second.
 */
export function classifyChildrensMusicArtist(artist: {
  name?: string | undefined;
  genres?: readonly string[] | undefined;
}): ChildrensMusicArtistSignal {
  if (hasChildrensMusicGenre(artist.genres)) {
    return "genre";
  }
  if (hasChildrensMusicArtistName(artist.name)) {
    return "artist";
  }
  return null;
}

/**
 * Curated album titles that identify children's content even when the artist
 * carries an empty or wrong genre list. Bare stems such as "lullaby" are
 * intentionally not matched: "Lullabies to Paralyze" by Queens of the Stone
 * Age is an adult rock album, so only full phrases qualify.
 *
 * The Hebrew entry is the canonical Israeli children's record "The Sixteenth
 * Sheep", which is credited to several adult artists and therefore cannot be
 * detected from artist metadata at all.
 */
export const CHILDRENS_MUSIC_ALBUM_PATTERNS: readonly RegExp[] = [
  /nursery rhymes?/i,
  /children'?s (songs|music|album|favourites|favorites|stories)/i,
  /kids (songs?|hits|sing|pop|party)/i,
  /songs for (kids|children|baby|babies|little ones|wiggleworms)/i,
  /lullaby renditions?/i,
  /lullaby versions?/i,
  /lullabies for (little|baby|babies|children|little ones)/i,
  /baby lullab(y|ies)/i,
  /lullababy/i,
  /sing.?along (songs|sessions|book)/i,
  /sing and learn/i,
  /baby shark/i,
  /pete the cat/i,
  /sesame street/i,
  /toddler (tunes|songs|learning)/i,
  /cocomelon/i,
  /kidz ?bop/i,
  /mother goose/i,
  /story ?bots/i,
  /pinkfong/i,
  /super simple songs/i,
  /bluey the album/i,
  /peppa pig/i,
  /paw patrol/i,
  /הכבש השישה עשר/i,
  /שירי ילדים/i,
  /בייבי/i,
];

/** True when an album title identifies children's content. */
export function hasChildrensMusicAlbumName(
  albumName: string | undefined,
): boolean {
  if (!albumName) {
    return false;
  }
  return CHILDRENS_MUSIC_ALBUM_PATTERNS.some((pattern) =>
    pattern.test(albumName),
  );
}

export type ChildrensMusicSignal = "genre" | "artist" | "album" | null;

/**
 * Classifies a play as children's content from artist metadata and the album
 * title. Artist genre is the most precise signal; the curated artist and album
 * lists recover content Spotify does not tag.
 */
export function classifyChildrensMusic(play: {
  artistName?: string | undefined;
  artistGenres?: readonly string[] | undefined;
  albumName?: string | undefined;
}): ChildrensMusicSignal {
  const artistSignal = classifyChildrensMusicArtist({
    name: play.artistName,
    genres: play.artistGenres,
  });
  if (artistSignal) {
    return artistSignal;
  }
  if (hasChildrensMusicAlbumName(play.albumName)) {
    return "album";
  }
  return null;
}
