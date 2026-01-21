/**
 * Roblox Documentation Loader
 * Downloads and caches documentation from the same sources as luau-lsp
 */

// Data source URLs (same as luau-lsp)
const API_DUMP_URL =
  "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/API-Dump.json";
const API_DOCS_URL = "https://luau-lsp.pages.dev/api-docs/en-us.json";

// Types for API Dump
interface APIDumpMember {
  MemberType: "Property" | "Function" | "Event" | "Callback";
  Name: string;
  Description?: string;
  Tags?: string[];
  Security?:
    | string
    | {
        Read?: string;
        Write?: string;
      };
}

interface APIDumpProperty extends APIDumpMember {
  MemberType: "Property";
  ValueType: {
    Category: string;
    Name: string;
  };
  Category?: string;
  Default?: string;
}

interface APIDumpFunction extends APIDumpMember {
  MemberType: "Function";
  Parameters: Array<{
    Name: string;
    Type: {
      Category: string;
      Name: string;
    };
    Default?: string;
  }>;
  ReturnType: {
    Category: string;
    Name: string;
  };
}

interface APIDumpEvent extends APIDumpMember {
  MemberType: "Event";
  Parameters: Array<{
    Name: string;
    Type: {
      Category: string;
      Name: string;
    };
  }>;
}

interface APIDumpClass {
  Name: string;
  Superclass: string;
  Tags?: string[];
  Members: Array<APIDumpProperty | APIDumpFunction | APIDumpEvent>;
}

interface APIDumpEnum {
  Name: string;
  Items: Array<{
    Name: string;
    Value: number;
  }>;
}

interface APIDump {
  Version: number;
  Classes: APIDumpClass[];
  Enums: APIDumpEnum[];
}

// Types for API Documentation
interface APIDocMember {
  name: string;
  description?: string;
  code_sample?: string;
  deprecated?: boolean;
  learn_more_link?: string;
}

interface APIDocClass {
  name: string;
  description?: string;
  code_sample?: string;
  properties?: Record<string, APIDocMember>;
  functions?: Record<string, APIDocMember>;
  events?: Record<string, APIDocMember>;
}

interface APIDocDataType {
  name: string;
  description?: string;
  code_sample?: string;
  constructors?: Record<string, APIDocMember>;
  properties?: Record<string, APIDocMember>;
  functions?: Record<string, APIDocMember>;
}

interface APIDocumentation {
  classes: Record<string, APIDocClass>;
  datatypes?: Record<string, APIDocDataType>;
  enums?: Record<
    string,
    { description?: string; items?: Record<string, string> }
  >;
}

// Exported cache type
export interface RobloxDocsCache {
  apiDump: APIDump;
  apiDocs: APIDocumentation | null;
  lastUpdated: number;
  version: string;
}

// Class documentation result
export interface ClassDocumentation {
  name: string;
  superclass: string;
  description?: string;
  tags?: string[];
  properties: PropertyDocumentation[];
  methods: MethodDocumentation[];
  events: EventDocumentation[];
}

export interface PropertyDocumentation {
  name: string;
  valueType: string;
  category?: string;
  description?: string;
  tags?: string[];
  security?: {
    read: string;
    write: string;
  };
  default?: string;
}

export interface MethodDocumentation {
  name: string;
  description?: string;
  parameters: Array<{
    name: string;
    type: string;
    default?: string;
  }>;
  returnType: string;
  tags?: string[];
  security?: string;
}

export interface EventDocumentation {
  name: string;
  description?: string;
  parameters: Array<{
    name: string;
    type: string;
  }>;
  tags?: string[];
  security?: string;
}

export interface DataTypeDocumentation {
  name: string;
  description?: string;
  constructors?: Array<{
    name: string;
    description?: string;
  }>;
  properties?: Array<{
    name: string;
    description?: string;
  }>;
  methods?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface EnumDocumentation {
  name: string;
  description?: string;
  items: Array<{
    name: string;
    value: number;
    description?: string;
  }>;
}

/**
 * Load Roblox documentation from remote sources
 */
export async function loadRobloxDocs(): Promise<RobloxDocsCache> {
  console.error("[RobloxDocs] Loading API dump...");

  // Load API dump (required)
  const apiDumpResponse = await fetch(API_DUMP_URL);
  if (!apiDumpResponse.ok) {
    throw new Error(
      `Failed to fetch API dump: ${apiDumpResponse.status} ${apiDumpResponse.statusText}`,
    );
  }
  const apiDump = (await apiDumpResponse.json()) as APIDump;

  console.error(
    `[RobloxDocs] API dump loaded: version ${apiDump.Version}, ${apiDump.Classes.length} classes, ${apiDump.Enums.length} enums`,
  );

  // Load API docs (optional - for descriptions)
  let apiDocs: APIDocumentation | null = null;
  try {
    console.error("[RobloxDocs] Loading API documentation...");
    const apiDocsResponse = await fetch(API_DOCS_URL);
    if (apiDocsResponse.ok) {
      apiDocs = (await apiDocsResponse.json()) as APIDocumentation;
      console.error("[RobloxDocs] API documentation loaded");
    } else {
      console.error(
        `[RobloxDocs] API docs unavailable: ${apiDocsResponse.status}`,
      );
    }
  } catch (error) {
    console.error("[RobloxDocs] Failed to load API docs:", error);
  }

  return {
    apiDump,
    apiDocs,
    lastUpdated: Date.now(),
    version: String(apiDump.Version),
  };
}

/**
 * Get documentation for a class
 */
export function getClassDocs(
  cache: RobloxDocsCache,
  className: string,
  includeInherited = true,
): ClassDocumentation | null {
  const classData = cache.apiDump.Classes.find((c) => c.Name === className);
  if (!classData) {
    return null;
  }

  const apiDocClass = cache.apiDocs?.classes?.[className];

  // Collect members from this class
  const properties: PropertyDocumentation[] = [];
  const methods: MethodDocumentation[] = [];
  const events: EventDocumentation[] = [];

  // Process members
  for (const member of classData.Members) {
    const memberDoc = getMemberDescription(
      apiDocClass,
      member.Name,
      member.MemberType,
    );

    if (member.MemberType === "Property") {
      const prop = member as APIDumpProperty;
      const security =
        typeof prop.Security === "object"
          ? {
              read: prop.Security.Read || "None",
              write: prop.Security.Write || "None",
            }
          : { read: prop.Security || "None", write: prop.Security || "None" };

      properties.push({
        name: prop.Name,
        valueType: prop.ValueType.Name,
        category: prop.Category,
        description: memberDoc,
        tags: prop.Tags,
        security,
        default: prop.Default,
      });
    } else if (member.MemberType === "Function") {
      const func = member as APIDumpFunction;
      methods.push({
        name: func.Name,
        description: memberDoc,
        parameters: func.Parameters.map((p) => ({
          name: p.Name,
          type: p.Type.Name,
          default: p.Default,
        })),
        returnType: func.ReturnType.Name,
        tags: func.Tags,
        security: typeof func.Security === "string" ? func.Security : undefined,
      });
    } else if (member.MemberType === "Event") {
      const event = member as APIDumpEvent;
      events.push({
        name: event.Name,
        description: memberDoc,
        parameters: event.Parameters.map((p) => ({
          name: p.Name,
          type: p.Type.Name,
        })),
        tags: event.Tags,
        security:
          typeof event.Security === "string" ? event.Security : undefined,
      });
    }
  }

  // Include inherited members if requested
  if (
    includeInherited &&
    classData.Superclass &&
    classData.Superclass !== "<<<ROOT>>>"
  ) {
    const parentDocs = getClassDocs(cache, classData.Superclass, true);
    if (parentDocs) {
      // Add inherited members (prepend so they appear after direct members when sorted)
      properties.push(
        ...parentDocs.properties.map((p) => ({
          ...p,
          tags: [...(p.tags || []), "Inherited"],
        })),
      );
      methods.push(
        ...parentDocs.methods.map((m) => ({
          ...m,
          tags: [...(m.tags || []), "Inherited"],
        })),
      );
      events.push(
        ...parentDocs.events.map((e) => ({
          ...e,
          tags: [...(e.tags || []), "Inherited"],
        })),
      );
    }
  }

  return {
    name: classData.Name,
    superclass: classData.Superclass,
    description: apiDocClass?.description,
    tags: classData.Tags,
    properties,
    methods,
    events,
  };
}

/**
 * Get documentation for a specific property
 */
export function getPropertyDocs(
  cache: RobloxDocsCache,
  className: string,
  propertyName: string,
): PropertyDocumentation | null {
  const classData = cache.apiDump.Classes.find((c) => c.Name === className);
  if (!classData) {
    return null;
  }

  const propMember = classData.Members.find(
    (m) => m.MemberType === "Property" && m.Name === propertyName,
  ) as APIDumpProperty | undefined;

  if (!propMember) {
    // Try inherited
    if (classData.Superclass && classData.Superclass !== "<<<ROOT>>>") {
      return getPropertyDocs(cache, classData.Superclass, propertyName);
    }
    return null;
  }

  const apiDocClass = cache.apiDocs?.classes?.[className];
  const description = getMemberDescription(
    apiDocClass,
    propertyName,
    "Property",
  );

  const security =
    typeof propMember.Security === "object"
      ? {
          read: propMember.Security.Read || "None",
          write: propMember.Security.Write || "None",
        }
      : {
          read: propMember.Security || "None",
          write: propMember.Security || "None",
        };

  return {
    name: propMember.Name,
    valueType: propMember.ValueType.Name,
    category: propMember.Category,
    description,
    tags: propMember.Tags,
    security,
    default: propMember.Default,
  };
}

/**
 * Get documentation for a datatype (Vector3, CFrame, etc.)
 */
export function getDataTypeDocs(
  cache: RobloxDocsCache,
  dataTypeName: string,
): DataTypeDocumentation | null {
  const apiDocDataType = cache.apiDocs?.datatypes?.[dataTypeName];

  if (!apiDocDataType) {
    // Return minimal info for known types
    const knownDataTypes = [
      "Vector3",
      "Vector2",
      "CFrame",
      "Color3",
      "UDim",
      "UDim2",
      "NumberSequence",
      "ColorSequence",
      "NumberRange",
      "Ray",
      "Rect",
      "Region3",
      "BrickColor",
      "TweenInfo",
      "DateTime",
      "Axes",
      "Faces",
      "PhysicalProperties",
    ];

    if (knownDataTypes.includes(dataTypeName)) {
      return {
        name: dataTypeName,
        description: `Roblox ${dataTypeName} data type`,
      };
    }

    return null;
  }

  return {
    name: dataTypeName,
    description: apiDocDataType.description,
    constructors: apiDocDataType.constructors
      ? Object.entries(apiDocDataType.constructors).map(([name, data]) => ({
          name,
          description: data.description,
        }))
      : undefined,
    properties: apiDocDataType.properties
      ? Object.entries(apiDocDataType.properties).map(([name, data]) => ({
          name,
          description: data.description,
        }))
      : undefined,
    methods: apiDocDataType.functions
      ? Object.entries(apiDocDataType.functions).map(([name, data]) => ({
          name,
          description: data.description,
        }))
      : undefined,
  };
}

/**
 * Get documentation for an enum
 */
export function getEnumDocs(
  cache: RobloxDocsCache,
  enumName: string,
): EnumDocumentation | null {
  const enumData = cache.apiDump.Enums.find((e) => e.Name === enumName);
  if (!enumData) {
    return null;
  }

  const apiDocEnum = cache.apiDocs?.enums?.[enumName];

  return {
    name: enumData.Name,
    description: apiDocEnum?.description,
    items: enumData.Items.map((item) => ({
      name: item.Name,
      value: item.Value,
      description: apiDocEnum?.items?.[item.Name],
    })),
  };
}

/**
 * List all available classes
 */
export function listClasses(cache: RobloxDocsCache): string[] {
  return cache.apiDump.Classes.map((c) => c.Name).sort();
}

/**
 * List all available enums
 */
export function listEnums(cache: RobloxDocsCache): string[] {
  return cache.apiDump.Enums.map((e) => e.Name).sort();
}

/**
 * Search for classes by partial name
 */
export function searchClasses(
  cache: RobloxDocsCache,
  query: string,
  limit = 20,
): string[] {
  const lowerQuery = query.toLowerCase();
  return cache.apiDump.Classes.filter((c) =>
    c.Name.toLowerCase().includes(lowerQuery),
  )
    .map((c) => c.Name)
    .sort()
    .slice(0, limit);
}

/**
 * Search for enums by partial name
 */
export function searchEnums(
  cache: RobloxDocsCache,
  query: string,
  limit = 20,
): string[] {
  const lowerQuery = query.toLowerCase();
  return cache.apiDump.Enums.filter((e) =>
    e.Name.toLowerCase().includes(lowerQuery),
  )
    .map((e) => e.Name)
    .sort()
    .slice(0, limit);
}

/**
 * Search for properties across all classes by partial name
 * Returns array of { class, property, type }
 */
export function searchProperties(
  cache: RobloxDocsCache,
  query: string,
  limit = 20,
): Array<{ class: string; property: string; type: string }> {
  const lowerQuery = query.toLowerCase();
  const results: Array<{ class: string; property: string; type: string }> = [];

  for (const classData of cache.apiDump.Classes) {
    for (const member of classData.Members) {
      if (member.MemberType === "Property") {
        const prop = member as APIDumpProperty;
        if (prop.Name.toLowerCase().includes(lowerQuery)) {
          results.push({
            class: classData.Name,
            property: prop.Name,
            type: prop.ValueType.Name,
          });
          if (results.length >= limit) {
            return results;
          }
        }
      }
    }
  }

  return results;
}

/**
 * Unified search across classes, enums, and properties
 */
export function searchAll(
  cache: RobloxDocsCache,
  query: string,
  limit = 10,
): {
  classes: string[];
  enums: string[];
  properties: Array<{ class: string; property: string; type: string }>;
} {
  return {
    classes: searchClasses(cache, query, limit),
    enums: searchEnums(cache, query, limit),
    properties: searchProperties(cache, query, limit),
  };
}

// Helper function to get member description from API docs
function getMemberDescription(
  apiDocClass: APIDocClass | undefined,
  memberName: string,
  memberType: string,
): string | undefined {
  if (!apiDocClass) return undefined;

  switch (memberType) {
    case "Property":
      return apiDocClass.properties?.[memberName]?.description;
    case "Function":
      return apiDocClass.functions?.[memberName]?.description;
    case "Event":
      return apiDocClass.events?.[memberName]?.description;
    default:
      return undefined;
  }
}
