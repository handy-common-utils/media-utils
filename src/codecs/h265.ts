/**
 * @param profileIdc Profile IDC
 * @returns Profile name
 */
export function h265ProfileName(profileIdc: number): string {
  switch (profileIdc) {
    case 1: {
      return 'Main';
    }
    case 2: {
      return 'Main 10';
    }
    default: {
      return `Profile${profileIdc}`;
    }
  }
}

/**
 * @param levelIdc Level IDC
 * @returns Level string
 */
export function h265LevelString(levelIdc: number): string {
  return `L${levelIdc / 30}`;
}
