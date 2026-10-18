/**
 * Scale-degree naming for chords.
 *
 * A chord is described by the semitones each tone sits above the root, which is
 * what actually defines it. Every label the UI shows is derived from that list,
 * so adding a chord means listing its intervals and nothing else — there are no
 * per-chord label strings to write or keep in sync.
 */

const FLAT = "♭";
const SHARP = "♯";

/** Degree name for each semitone distance above the root, within one octave. */
const DEGREE_BY_PITCH_CLASS: Record<number, string> = {
  0: "Root",
  1: `${FLAT}9`,
  2: "9",
  3: `${FLAT}3`,
  4: "3",
  5: "11",
  6: `${FLAT}5`,
  7: "5",
  8: `${SHARP}5`,
  9: "6",
  10: `${FLAT}7`,
  11: "7",
};

/**
 * With no third in the chord there is nothing for a 2nd or 4th to be a tension
 * against, so they are suspensions: sus2 and sus4 rather than 9 and 11.
 */
const SUSPENDED_BY_PITCH_CLASS: Record<number, string> = {
  2: "2",
  5: "4",
};

/**
 * Written an octave or more above the root, a 6th is a 13th. (2 and 5 already
 * spell as 9 and 11 in the table above, which is how they read as tensions.)
 */
const TENSION_BY_PITCH_CLASS: Record<number, string> = {
  9: "13",
};

/**
 * Over a diminished triad, 9 semitones is the diminished 7th rather than a 6th:
 * the chord stacks in thirds, so that tone is a (doubly flattened) 7th degree.
 */
function isDiminishedTriad(classes: readonly number[]): boolean {
  return classes.includes(3) && classes.includes(6);
}

function pitchClass(semitones: number): number {
  return ((semitones % 12) + 12) % 12;
}

/**
 * Turn semitone distances above the root into scale-degree labels, in the order
 * given. Intervals of 12 or more are treated as upper-octave tensions.
 */
export function chordDegreeLabels(semitones: readonly number[]): string[] {
  const classes = semitones.map(pitchClass);
  const hasThird = classes.includes(3) || classes.includes(4);

  return semitones.map((semitone) => {
    const pc = pitchClass(semitone);

    if (!hasThird && pc in SUSPENDED_BY_PITCH_CLASS) {
      return SUSPENDED_BY_PITCH_CLASS[pc];
    }
    if (pc === 9 && isDiminishedTriad(classes)) {
      return `${FLAT}${FLAT}7`;
    }
    if (semitone >= 12 && pc in TENSION_BY_PITCH_CLASS) {
      return TENSION_BY_PITCH_CLASS[pc];
    }
    return DEGREE_BY_PITCH_CLASS[pc];
  });
}
