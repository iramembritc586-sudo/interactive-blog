export type RotationDirection = "left" | "right";

export type RotationStep = {
  direction: RotationDirection;
  turns: number;
  degrees: number;
};

export const ANGLE_TOLERANCE = 24;
const MIN_STEP_DEGREES = 35;

export const demoCredentials = {
  username: "traveler",
  sequence: [
    { direction: "left", turns: 3, degrees: 1080 },
    { direction: "right", turns: 0.5, degrees: 180 },
    { direction: "left", turns: 1, degrees: 360 },
  ] as RotationStep[],
};

export function normalizeDegrees(rawDegrees: number) {
  const absolute = Math.abs(rawDegrees);
  const roundedTurns = Number((absolute / 360).toFixed(2));

  return {
    turns: roundedTurns,
    degrees: absolute,
  };
}

export function buildRotationStep(rawDegrees: number): RotationStep | null {
  if (Math.abs(rawDegrees) < MIN_STEP_DEGREES) {
    return null;
  }

  const direction: RotationDirection = rawDegrees < 0 ? "left" : "right";
  const normalized = normalizeDegrees(rawDegrees);

  return {
    direction,
    ...normalized,
  };
}

export function matchSequence(input: RotationStep[], expected: RotationStep[]) {
  if (input.length !== expected.length) {
    return false;
  }

  return input.every((step, index) => {
    const target = expected[index];
    return (
      step.direction === target.direction &&
      Math.abs(step.degrees - target.degrees) <= ANGLE_TOLERANCE
    );
  });
}
