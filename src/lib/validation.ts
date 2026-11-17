import type { SolidDimensions, SolidType } from '../types/geometry';

export interface DimensionValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateDimensions(
  solidType: SolidType,
  dims: SolidDimensions
): DimensionValidationResult {
  const errors: Record<string, string> = {};
  const isCurved = solidType === 'cylinder' || solidType === 'cone' || solidType === 'hemisphere';
  const isCustom = solidType === 'custom_prism' || solidType === 'custom_pyramid';

  if (isCurved) {
    if (!Number.isFinite(dims.baseRadius) || dims.baseRadius <= 0) {
      errors.baseRadius = 'Base radius must be greater than 0 mm.';
    } else if (dims.baseRadius > 200) {
      errors.baseRadius = 'Base radius must be 200 mm or less.';
    }
  } else {
    if (!Number.isFinite(dims.sideLength) || dims.sideLength <= 0) {
      errors.sideLength = 'Side length must be greater than 0 mm.';
    } else if (dims.sideLength > 200) {
      errors.sideLength = 'Side length must be 200 mm or less.';
    }

    if (solidType === 'square_prism' && dims.rectangularBase) {
      if (!Number.isFinite(dims.baseWidth) || dims.baseWidth <= 0) {
        errors.baseWidth = 'Base width must be greater than 0 mm.';
      } else if (dims.baseWidth > 200) {
        errors.baseWidth = 'Base width must be 200 mm or less.';
      }
    }
  }

  if (!Number.isFinite(dims.axisLength) || dims.axisLength <= 0) {
    errors.axisLength = 'Axis length / height must be greater than 0 mm.';
  } else if (dims.axisLength > 300) {
    errors.axisLength = 'Axis length / height must be 300 mm or less.';
  }

  if (isCustom) {
    if (!Number.isInteger(dims.numSides) || dims.numSides < 3 || dims.numSides > 12) {
      errors.numSides = 'Number of sides must be an integer between 3 and 12.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
