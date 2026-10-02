// Every tunable gameplay number lives here, so tuning never means touching logic.
// Units: meters, seconds, meters/second. Court coordinates:
//   x = across the court (0 = center line, + = screen right)
//   y = along the court (0 = net, + = near side / player 1, - = far side / player 2)
//   z = height above the ground

export const CONFIG = {
  /** Fixed simulation rate. Logic always steps at this rate regardless of display fps. */
  simHz: 120,
  /** Global speed multiplier for the whole simulation (1 = real time). */
  simSpeed: 1,

  court: {
    /** Real pickleball court: 20ft x 44ft. */
    width: 6.1,
    length: 13.41,
    /** Non-volley zone ("kitchen") depth on each side of the net: 7ft. */
    kitchenDepth: 2.13,
    netHeight: 0.86,
    /** How far players may wander past the sidelines and baselines. */
    sideRunoff: 1.6,
    backRunoff: 2.6,
  },

  rules: {
    pointsToWin: 7,
    winBy: 2,
    /** Serve and return must each bounce before being hit. Off for the prototype. */
    twoBounceRule: false,
  },

  ball: {
    gravity: 9.8,
    radius: 0.037,
    /** Fraction of vertical speed kept on a bounce. */
    restitution: 0.62,
    /** Fraction of horizontal speed kept on a bounce. */
    bounceFriction: 0.82,
    /** Below this vertical speed the ball stops bouncing and just rolls. */
    restSpeed: 0.4,
    rollFriction: 2.5,
  },

  player: {
    moveSpeed: 4.6,
    /** Body radius, only used for drawing and keeping players off the net. */
    radius: 0.28,
    /** Closest a player can get to the net. */
    netGap: 0.3,
    /** Horizontal distance from the player at which the ball can be hit. */
    reach: 1.05,
    /** Highest ball that can be hit (overhead). */
    reachHeight: 2.3,
    /** Height of the "ideal" contact point used when judging timing. */
    sweetSpotHeight: 0.75,
    /** Vertical distance counts this much toward the sweet-spot distance. */
    sweetSpotHeightWeight: 0.6,
  },

  timing: {
    /** A press this long before the ball reaches reach still counts (input buffer). */
    inputBuffer: 0.16,
    /** Timing error (seconds from the ideal contact moment) that still counts as perfect. */
    perfectWindow: 0.04,
    /** Timing error at which shot quality bottoms out at 0. */
    window: 0.2,
    /** Incoming balls faster than this (horizontal m/s) shrink the timing window... */
    fastBallSpeed: 7,
    /** ...down to this fraction of it. Fast balls are harder to time: that is what makes a drive an attack. */
    fastBallMinScale: 0.3,
    /** Quality of the automatic "panic block" when a bounced ball is about to get past you. */
    autoHitQuality: 0.15,
    /** Quality thresholds for the on-screen timing label. */
    perfectLabel: 0.95,
    goodLabel: 0.6,
  },

  shots: {
    dink: {
      /** How far past the net a dink lands (inside the 2.13m kitchen). */
      depth: 1.2,
      /** Height the ball clears the net by at perfect quality. */
      netClearance: 0.12,
      /** Extra apex height added at quality 0. This is what makes a pop-up. */
      float: 1.7,
      /** Extra landing depth at quality 0: a floater sails past the kitchen where it can be volleyed. */
      floatDepth: 2.3,
      /** Random landing scatter (meters) at quality 0. */
      scatter: 0.9,
      /** Max sideways aim offset from the stick, in meters. */
      aimWidth: 2.3,
    },
    drive: {
      /** How far from the opponent's baseline a drive lands. */
      depthFromBaseline: 1.3,
      netClearance: 0.22,
      float: 1.0,
      scatter: 1.9,
      /** Landing scatter even when perfectly timed: hard shots always carry some risk. */
      baseScatter: 0.6,
      aimWidth: 2.4,
      /** Contacts below this height must be lifted, making the drive less accurate. */
      lowContactHeight: 0.6,
      /** Extra apex height and scatter multiplier for a drive from a very low ball. */
      lowContactFloat: 0.7,
      lowContactScatter: 1.0,
    },
    serve: {
      /** Distance in front of the receiver's baseline the serve aims for. */
      depthFromBaseline: 1.5,
      softNetClearance: 0.9,
      hardNetClearance: 0.3,
      scatter: 0.35,
      aimWidth: 1.0,
    },
  },

  pressure: {
    /** Pressure added to both meters by each dink in a row (0..1 scale). */
    perDink: 0.1,
    /** Per-player multiplier on how fast their own meter fills (characters will vary this). */
    fillRate: [1, 1],
    /** At full pressure, timing windows shrink to (1 - this) of normal. */
    maxWindowShrink: 0.6,
  },

  smash: {
    /** A shot whose apex is at least this high gives the opponent a smash opportunity. */
    opportunityApex: 2.0,
    /** Ideal contact height for a smash (overhead), used when judging smash timing. */
    sweetSpotHeight: 1.8,
    /** Horizontal speed of a smash (m/s). */
    speed: 19,
    /** Shortest flight allowed (so a smash from right at the net isn't instant). */
    minFlightTime: 0.22,
    /** A smash slows down (up to this flight time) if that's what it takes to clear the net. */
    maxFlightTime: 0.55,
    netClearance: 0.08,
    /** How far past the net a smash lands. */
    depth: 3.4,
    aimWidth: 2.4,
    /** Landing scatter at quality 0. */
    scatter: 1.6,
    /** Smashing a ball below this height: more scatter. Physics (the net) does the rest. */
    lowContactHeight: 1.4,
    lowContactScatter: 1.2,
    /** Presentation: slow motion while the attacker lines up a high ball. */
    slowMoScale: 0.55,
    slowMoMinHeight: 1.0,
    /** Presentation: freeze-frame on smash contact, and screen shake. */
    hitStop: 0.09,
    shakeDuration: 0.18,
    shakeIntensity: 0.012,
  },

  flow: {
    /** Pause after a point before players reset for the next serve. */
    pointOverDelay: 1.6,
  },

  view: {
    width: 1280,
    height: 800,
    /** Screen y of the net's base. */
    netScreenY: 432,
    pxPerMeterY: 37,
    pxPerMeterX: 82,
    pxPerMeterZ: 64,
    /** Width scale change per meter of depth: far side draws narrower than the near side. */
    perspective: 0.026,
    /** Minimum font size in px at 1280x800 (about 9pt on a 7" Steam Deck screen is ~12px). */
    minFontPx: 18,
  },
}

export type GameConfig = typeof CONFIG
