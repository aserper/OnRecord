import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyChildrensMusic,
  classifyChildrensMusicArtist,
  hasChildrensMusicAlbumName,
  hasChildrensMusicArtistName,
  hasChildrensMusicGenre,
  normalizeGenre,
  CHILDRENS_MUSIC_ALBUM_PATTERNS,
} from "./childrensMusic";

test("recognizes Spotify's children's genre vocabulary", () => {
  for (const genre of [
    "children's music",
    "childrens music",
    "lullaby",
    "nursery",
    "kids dance party",
    "kids hip hop",
    "kindie rock",
    "children's story",
    "preschool children's music",
    "british children's music",
    "nz children's music",
    "instrumental lullaby",
  ]) {
    assert.equal(
      hasChildrensMusicGenre([genre]),
      true,
      `expected ${genre} to classify as children's music`,
    );
  }
});

test("does not classify adult genres", () => {
  for (const genres of [
    ["grunge", "post-grunge"],
    ["heavy metal", "metal"],
    ["britpop"],
    ["mizrahi"],
    ["hymns", "gregorian chant"],
    ["comedy"],
    [],
    undefined,
  ]) {
    assert.equal(hasChildrensMusicGenre(genres), false);
  }
});

test("normalizes curly apostrophes and punctuation", () => {
  assert.equal(normalizeGenre("Children’s Music"), "childrens music");
  assert.equal(normalizeGenre("children's music"), "childrens music");
  assert.equal(normalizeGenre("  Kids   Dance Party "), "kids dance party");
});

test("matches curated children's brands by artist name", () => {
  for (const name of [
    "CoComelon",
    "Pinkfong",
    "Kidz Bop Kids",
    "Super Simple Songs",
    "Mother Goose Club",
    "The Kiboomers",
    "StoryBots",
    "Peppa Pig Stories",
    "PAW Patrol",
    "Sesame Street's Elmo",
    "Little Baby Bum Nursery Rhyme Friends",
    "The Wiggles",
    "Blippi",
    "Melo.Kids",
  ]) {
    assert.equal(
      hasChildrensMusicArtistName(name),
      true,
      `expected ${name} to classify as children's music`,
    );
  }
});

test("does not flag mainstream adult artists that contain kids words", () => {
  for (const name of [
    "Radiohead",
    "MGMT",
    "Justin Bieber",
    "Kid Cudi",
    "Kids See Ghosts",
    "Baby Keem",
    "Family of the Year",
    "Story of the Year",
    "Sing Street",
    "The Beatles",
    "Drake",
    "Taylor Swift",
    "Metallica",
    "Miles Davis",
  ]) {
    assert.equal(
      hasChildrensMusicArtistName(name),
      false,
      `expected ${name} NOT to classify as children's music`,
    );
  }
});

test("genre signal takes precedence over the artist list", () => {
  assert.equal(
    classifyChildrensMusicArtist({
      name: "Some Unknown Artist",
      genres: ["children's music"],
    }),
    "genre",
  );
  assert.equal(
    classifyChildrensMusicArtist({ name: "Pinkfong", genres: [] }),
    "artist",
  );
  assert.equal(
    classifyChildrensMusicArtist({ name: "Radiohead", genres: ["art rock"] }),
    null,
  );
});

test("recognizes children's album titles", () => {
  for (const album of [
    "Nursery Rhymes",
    "Lullaby Renditions of Abba",
    "Lullaby Versions of The Beatles",
    "Songs for Baby Sleep",
    "Children's Songs",
    "Kids Hits, Vol. 1",
    "Sing and Learn, Vol. 1 - A Collection of Nursery Rhymes",
    "CoComelon Kids Hits, Vol. 1",
    "Sesame Street: What's the Number?",
    "Peppa Pig: Family Stories",
    "PAW Patrol Official Theme Song & More",
    "הכבש השישה עשר (Remastered)",
  ]) {
    assert.equal(
      hasChildrensMusicAlbumName(album),
      true,
      `expected album ${album} to classify as children's music`,
    );
  }
});

test("does not match adult albums containing lullaby-like words", () => {
  for (const album of [
    "Lullabies To Paralyze",
    "Skunkworks",
    "Cure for Pain",
    "Definitely Maybe (Remastered) [Deluxe Edition]",
    "10 Hours of Continuous Rain Sounds for Sleeping",
    "White Noise Comfort",
  ]) {
    assert.equal(
      hasChildrensMusicAlbumName(album),
      false,
      `expected album ${album} NOT to classify as children's music`,
    );
  }
});

test("album signal recovers children's content when the artist is untagged", () => {
  // The canonical Israeli children's record is credited to adult artists with
  // empty or unrelated genres, so only the album title identifies it.
  assert.equal(
    classifyChildrensMusic({
      artistName: "Gidi Gov",
      artistGenres: ["mizrahi"],
      albumName: "הכבש השישה עשר (Remastered)",
    }),
    "album",
  );
  assert.equal(
    classifyChildrensMusic({
      artistName: "Yehonatan Geffen",
      artistGenres: [],
      albumName: "הכבש השישה עשר",
    }),
    "album",
  );
});

test("mainstream adult albums stay unclassified end to end", () => {
  assert.equal(
    classifyChildrensMusic({
      artistName: "Queens of the Stone Age",
      artistGenres: ["stoner rock", "alternative rock"],
      albumName: "Lullabies To Paralyze",
    }),
    null,
  );
});

test("every album pattern is specific enough to avoid bare stems", () => {
  // Guards against regressions where a short stem like /lullab/i sneaks in.
  // Non-Latin entries (Hebrew, for example) are counted by code point, so a
  // compact but unambiguous word such as "בייבי" is acceptable.
  for (const pattern of CHILDRENS_MUSIC_ALBUM_PATTERNS) {
    const source = pattern.source.replace(/\\/g, "");
    const hasLatin = /[a-z]/i.test(source);
    const minimum = hasLatin ? 8 : 4;
    assert.ok(
      [...source].length >= minimum,
      `album pattern "${pattern.source}" is too short to be safe`,
    );
  }
});
