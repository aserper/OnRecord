import assert from "node:assert/strict";
import test from "node:test";

import { excludedByPredicate, withExclusions } from "./exclusions";

test("the manual artist blacklist is always excluded", () => {
  assert.deepEqual(excludedByPredicate({}), {
    blacklistedBy: { $nin: ["artist"] },
  });
  assert.deepEqual(excludedByPredicate(undefined), {
    blacklistedBy: { $nin: ["artist"] },
  });
});

test("automatic reasons apply only when their setting is enabled", () => {
  assert.deepEqual(excludedByPredicate({ excludeChildrensMusic: true }), {
    blacklistedBy: { $nin: ["artist", "childrens-music"] },
  });
  assert.deepEqual(excludedByPredicate({ excludePodcasts: true }), {
    blacklistedBy: { $nin: ["artist", "podcast"] },
  });
  assert.deepEqual(
    excludedByPredicate({ excludeChildrensMusic: true, excludePodcasts: true }),
    { blacklistedBy: { $nin: ["artist", "childrens-music", "podcast"] } },
  );
});

test("a disabled automatic filter does not mention its reason", () => {
  const predicate = excludedByPredicate({ excludeChildrensMusic: false });
  assert.deepEqual(predicate, { blacklistedBy: { $nin: ["artist"] } });
  const reasons = (predicate!.blacklistedBy as { $nin: string[] }).$nin;
  assert.equal(reasons.includes("childrens-music"), false);
});

test("withExclusions preserves the existing match and adds the predicate", () => {
  const merged = withExclusions(
    { owner: "user-1", played_at: { $gt: new Date(0) } },
    { excludePodcasts: true },
  );
  assert.equal(merged.owner, "user-1");
  assert.deepEqual(merged.blacklistedBy, { $nin: ["artist", "podcast"] });
});

test("$nin semantics keep plays that carry no exclusion tag", () => {
  // Regression guard: the previous `blacklistedBy: { $exists: 0 }` predicate
  // hid any play that carried a tag, even with every filter disabled. Applying
  // the predicate by hand documents the intended MongoDB behaviour: documents
  // without the field match, and a tag is only excluded when listed.
  const predicate = excludedByPredicate({ excludeChildrensMusic: false })!;
  const { $nin } = predicate.blacklistedBy as { $nin: string[] };

  const matchesField = (blacklistedBy?: string[]) =>
    blacklistedBy === undefined || !blacklistedBy.some((r) => $nin.includes(r));

  assert.equal(matchesField(undefined), true, "untagged play stays visible");
  assert.equal(matchesField([]), true, "empty tag list stays visible");
  assert.equal(
    matchesField(["childrens-music"]),
    true,
    "children's play stays visible while its filter is off",
  );
  assert.equal(matchesField(["artist"]), false, "blacklisted artist is hidden");
});
