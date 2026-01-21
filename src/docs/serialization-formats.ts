/**
 * Serialization Format Documentation
 *
 * Documents JSON serialization formats for Roblox datatypes used by the MCP bridge.
 * Complex types must be formatted as JSON objects with a `_type` field.
 */

export interface DataTypeFormat {
  name: string;
  description: string;
  example: unknown;
  notes?: string;
}

/**
 * All supported datatype serialization formats
 */
export const DATATYPE_FORMATS: Record<string, DataTypeFormat> = {
  Vector3: {
    name: "Vector3",
    description: "3D vector with x, y, z components",
    example: { _type: "Vector3", x: 10, y: 5, z: 10 },
  },

  Vector2: {
    name: "Vector2",
    description: "2D vector with x, y components",
    example: { _type: "Vector2", x: 100, y: 50 },
  },

  Color3: {
    name: "Color3",
    description: "RGB color (0-1 floats, NOT 0-255)",
    example: { _type: "Color3", r: 1, g: 0.5, b: 0 },
    notes: "r=1,g=0,b=0 is red. r=1,g=1,b=1 is white.",
  },

  CFrame: {
    name: "CFrame",
    description: "Position and rotation (XYZ euler angles in degrees)",
    example: {
      _type: "CFrame",
      position: { x: 0, y: 10, z: 0 },
      rotation: { x: 0, y: 45, z: 0 },
    },
    notes:
      "Rotation is XYZ euler angles in degrees. Omit rotation for identity.",
  },

  NumberRange: {
    name: "NumberRange",
    description: "Min/max range",
    example: { _type: "NumberRange", min: 1, max: 5 },
  },

  NumberSequence: {
    name: "NumberSequence",
    description: "Values over time (0-1). First keypoint time=0, last time=1.",
    example: {
      _type: "NumberSequence",
      keypoints: [
        { time: 0, value: 0 },
        { time: 1, value: 1 },
      ],
    },
    notes: "Optional 'envelope' on each keypoint (defaults to 0).",
  },

  ColorSequence: {
    name: "ColorSequence",
    description: "Colors over time (0-1). First keypoint time=0, last time=1.",
    example: {
      _type: "ColorSequence",
      keypoints: [
        { time: 0, color: { r: 1, g: 0, b: 0 } },
        { time: 1, color: { r: 0, g: 0, b: 1 } },
      ],
    },
  },

  UDim: {
    name: "UDim",
    description: "1D UI dimension (scale + offset)",
    example: { _type: "UDim", scale: 0.5, offset: 10 },
  },

  UDim2: {
    name: "UDim2",
    description: "2D UI dimension",
    example: {
      _type: "UDim2",
      x: { scale: 0.5, offset: 0 },
      y: { scale: 0, offset: 100 },
    },
  },

  Rect: {
    name: "Rect",
    description: "2D rectangle with min/max corners",
    example: {
      _type: "Rect",
      min: { x: 0, y: 0 },
      max: { x: 100, y: 100 },
    },
  },

  Font: {
    name: "Font",
    description: "Text font with family, weight, and style",
    example: {
      _type: "Font",
      family: "rbxasset://fonts/families/SourceSansPro.json",
      weight: "Regular",
      style: "Normal",
    },
    notes:
      "Weight: Thin, ExtraLight, Light, Regular, Medium, SemiBold, Bold, ExtraBold, Heavy. Style: Normal, Italic.",
  },

  BrickColor: {
    name: "BrickColor",
    description: "Legacy color by name or number",
    example: { _type: "BrickColor", name: "Bright red" },
    notes: "Use 'name' OR 'number', not both. Prefer Color3.",
  },

  Enum: {
    name: "Enum",
    description: "Roblox enum value",
    example: { _type: "Enum", enum: "Material", value: "Neon" },
  },

  Instance: {
    name: "Instance",
    description: "Reference to another instance",
    example: { _type: "Instance", path: "Workspace.SpawnLocation" },
    notes: "Dot-separated path starting with service name.",
  },
};

/**
 * Get serialization format for a specific datatype
 */
export function getDataTypeFormat(typeName: string): DataTypeFormat | null {
  return DATATYPE_FORMATS[typeName] || null;
}

/**
 * Get all available datatype names
 */
export function getAvailableDataTypes(): string[] {
  return Object.keys(DATATYPE_FORMATS);
}

/**
 * Generate concise format summary from DATATYPE_FORMATS (auto-maintained)
 */
export function getFormatSummary(): string {
  const examples = Object.entries(DATATYPE_FORMATS)
    .map(([name, fmt]) => `${name}: ${JSON.stringify(fmt.example)}`)
    .join("\n");
  return `Complex types need _type field. Use get_datatype_format for details.\n${examples}`;
}
