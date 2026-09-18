import semver from "semver";

export class Version {
  private constructor(private readonly value: string) {}

  static from(version: string) {
    const parsed = semver.valid(version);
    if (!parsed) throw new Error(`Invalid version: ${version}`);
    return new Version(parsed);
  }

  toString() { return this.value; }

  isNewerThan(version: Version) {
    return semver.gt(this.value, version.value);
  }
}
