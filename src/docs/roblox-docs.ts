/**
 * Roblox Documentation Loader
 * Downloads and caches documentation from the same sources as luau-lsp
 */

import type {
  APIDump,
  APIDumpClass,
  APIDumpProperty,
  APIDumpFunction,
  APIDumpEvent,
  APIDocumentation,
  APIDocClass,
  APIDocMember,
  RawAPIDocEntry,
  RobloxDocsCache,
  ClassDocumentation,
  PropertyDocumentation,
  MethodDocumentation,
  MethodParameterDocumentation,
  EventDocumentation,
  EventParameterDocumentation,
  DataTypeDocumentation,
  EnumDocumentation,
  EnumItemDocumentation,
  GlobalDocumentation,
} from "../types/roblox-docs.js";

// Re-export types for external consumers
export type {
  RobloxDocsCache,
  ClassDocumentation,
  PropertyDocumentation,
  MethodDocumentation,
  MethodParameterDocumentation,
  EventDocumentation,
  EventParameterDocumentation,
  DataTypeDocumentation,
  EnumDocumentation,
  EnumItemDocumentation,
  GlobalDocumentation,
} from "../types/roblox-docs.js";

// Data source URLs (same as luau-lsp)
const API_DUMP_URL =
  "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/API-Dump.json";
const API_DOCS_URL = "https://luau-lsp.pages.dev/api-docs/en-us.json";

/**
 * Transform the flat luau-lsp JSON format into our nested APIDocumentation format.
 */
function transformRawAPIDocs(
  rawDocs: Record<string, RawAPIDocEntry>,
): APIDocumentation {
  const result: APIDocumentation = {
    classes: {},
    datatypes: {},
    enums: {},
    globals: {},
  };

  const resolveDocRef = (ref: string | undefined): string | undefined => {
    if (!ref) return undefined;
    if (ref.startsWith("@roblox/")) {
      return rawDocs[ref]?.documentation;
    }
    return ref;
  };

  const resolveParams = (
    params: Array<{ name: string; documentation?: string }> | undefined,
  ): Array<{ name: string; documentation?: string }> | undefined => {
    if (!params) return undefined;
    return params
      .filter((p) => p.name !== "self")
      .map((p) => ({
        name: p.name,
        documentation: resolveDocRef(p.documentation),
      }));
  };

  const resolveReturns = (
    returns: string[] | undefined,
  ): string[] | undefined => {
    if (!returns) return undefined;
    return returns.map((r) => resolveDocRef(r) || r);
  };

  const createMemberDoc = (entry: RawAPIDocEntry): APIDocMember => ({
    name: "",
    description: entry.documentation,
    code_sample: entry.code_sample,
    learn_more_link: entry.learn_more_link,
    params: resolveParams(entry.params),
    returns: resolveReturns(entry.returns),
    overloads: entry.overloads,
  });

  const ensureClass = (className: string) => {
    if (!result.classes[className]) {
      result.classes[className] = {
        name: className,
        properties: {},
        functions: {},
        events: {},
      };
    }
    return result.classes[className];
  };

  const ensureDataType = (typeName: string) => {
    if (!result.datatypes![typeName]) {
      result.datatypes![typeName] = {
        name: typeName,
        constructors: {},
        properties: {},
        functions: {},
      };
    }
    return result.datatypes![typeName];
  };

  const ensureEnum = (enumName: string) => {
    if (!result.enums![enumName]) {
      result.enums![enumName] = { items: {} };
    }
    return result.enums![enumName];
  };

  for (const [key, entry] of Object.entries(rawDocs)) {
    // Pattern 1: @roblox/globaltype/ClassName
    const globalTypeMatch = key.match(
      /^@roblox\/globaltype\/([A-Z][a-zA-Z0-9]*)$/,
    );
    if (globalTypeMatch?.[1]) {
      const cls = ensureClass(globalTypeMatch[1]);
      cls.description = entry.documentation;
      cls.code_sample = entry.code_sample;
      continue;
    }

    // Pattern 2: @roblox/globaltype/ClassName.MemberName
    const memberMatch = key.match(
      /^@roblox\/globaltype\/([A-Z][a-zA-Z0-9]*)\.([a-zA-Z0-9_]+)$/,
    );
    if (memberMatch?.[1] && memberMatch[2]) {
      const cls = ensureClass(memberMatch[1]);
      const memberDoc = createMemberDoc(entry);
      memberDoc.name = memberMatch[2];
      cls.properties![memberMatch[2]] = memberDoc;
      cls.functions![memberMatch[2]] = memberDoc;
      cls.events![memberMatch[2]] = memberDoc;
      continue;
    }

    // Pattern 3: @roblox/global/Enum.EnumName
    const enumDefMatch = key.match(
      /^@roblox\/global\/Enum\.([A-Z][a-zA-Z0-9]*)$/,
    );
    if (enumDefMatch?.[1]) {
      const enumDoc = ensureEnum(enumDefMatch[1]);
      enumDoc.description = entry.documentation;
      enumDoc.learn_more_link = entry.learn_more_link;
      enumDoc.code_sample = entry.code_sample;
      continue;
    }

    // Pattern 4: @roblox/enum/EnumName.ItemName
    const enumItemMatch = key.match(
      /^@roblox\/enum\/([A-Z][a-zA-Z0-9]*)\.([a-zA-Z0-9_]+)$/,
    );
    if (enumItemMatch?.[1] && enumItemMatch[2]) {
      const enumDoc = ensureEnum(enumItemMatch[1]);
      enumDoc.items![enumItemMatch[2]] = {
        description: entry.documentation,
        learn_more_link: entry.learn_more_link,
        code_sample: entry.code_sample,
      };
      continue;
    }

    // Pattern 5: @roblox/global/name
    const globalMatch = key.match(/^@roblox\/global\/([a-z][a-zA-Z0-9_]*)$/);
    if (globalMatch?.[1]) {
      const memberDoc = createMemberDoc(entry);
      memberDoc.name = globalMatch[1];
      result.globals![globalMatch[1]] = memberDoc;
      continue;
    }

    // Pattern 6: @roblox/global/name.member
    const globalMemberMatch = key.match(
      /^@roblox\/global\/([a-z][a-zA-Z0-9_]*)\.([a-zA-Z0-9_]+)$/,
    );
    if (globalMemberMatch?.[1] && globalMemberMatch[2]) {
      const fullName = `${globalMemberMatch[1]}.${globalMemberMatch[2]}`;
      const memberDoc = createMemberDoc(entry);
      memberDoc.name = fullName;
      result.globals![fullName] = memberDoc;
      continue;
    }

    // Pattern 7: @roblox/globaltype/TypeName/methodName
    const datatypeMethodMatch = key.match(
      /^@roblox\/globaltype\/([A-Z][a-zA-Z0-9]*)\/([a-zA-Z0-9_]+)$/,
    );
    if (datatypeMethodMatch?.[1] && datatypeMethodMatch[2]) {
      const dt = ensureDataType(datatypeMethodMatch[1]);
      const memberDoc = createMemberDoc(entry);
      memberDoc.name = datatypeMethodMatch[2];
      if (datatypeMethodMatch[2] === "new") {
        dt.constructors![datatypeMethodMatch[2]] = memberDoc;
      } else {
        dt.functions![datatypeMethodMatch[2]] = memberDoc;
      }
      continue;
    }
  }

  return result;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get member documentation from API docs by member type
 */
function getMemberDoc(
  apiDocClass: APIDocClass | undefined,
  memberName: string,
  memberType: string,
): APIDocMember | undefined {
  if (!apiDocClass) return undefined;
  switch (memberType) {
    case "Property":
      return apiDocClass.properties?.[memberName];
    case "Function":
      return apiDocClass.functions?.[memberName];
    case "Event":
      return apiDocClass.events?.[memberName];
    default:
      return undefined;
  }
}

/**
 * Parse security info from API dump
 */
function parsePropertySecurity(security: APIDumpProperty["Security"]): {
  read: string;
  write: string;
} {
  if (typeof security === "object") {
    return {
      read: security.Read || "None",
      write: security.Write || "None",
    };
  }
  return { read: security || "None", write: security || "None" };
}

// ============================================
// Data Loading
// ============================================

/**
 * Load Roblox documentation from remote sources
 */
export async function loadRobloxDocs(): Promise<RobloxDocsCache> {
  console.error("[RobloxDocs] Loading API dump...");

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

  let apiDocs: APIDocumentation | null = null;
  try {
    console.error("[RobloxDocs] Loading API documentation...");
    const apiDocsResponse = await fetch(API_DOCS_URL);
    if (apiDocsResponse.ok) {
      const rawDocs = (await apiDocsResponse.json()) as Record<
        string,
        RawAPIDocEntry
      >;
      apiDocs = transformRawAPIDocs(rawDocs);
      console.error(
        `[RobloxDocs] API documentation loaded: ${Object.keys(apiDocs.classes).length} classes`,
      );
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

// ============================================
// Documentation Retrieval Functions
// ============================================

/**
 * Get documentation for a class
 */
export function getClassDocs(
  cache: RobloxDocsCache,
  className: string,
  includeInherited = true,
): ClassDocumentation | null {
  const classData = cache.apiDump.Classes.find((c) => c.Name === className);
  if (!classData) return null;

  const apiDocClass = cache.apiDocs?.classes?.[className];
  const properties: PropertyDocumentation[] = [];
  const methods: MethodDocumentation[] = [];
  const events: EventDocumentation[] = [];

  for (const member of classData.Members) {
    const memberDoc = getMemberDoc(apiDocClass, member.Name, member.MemberType);

    if (member.MemberType === "Property") {
      const prop = member as APIDumpProperty;
      properties.push({
        name: prop.Name,
        valueType: prop.ValueType.Name,
        category: prop.Category,
        description: memberDoc?.description,
        learn_more_link: memberDoc?.learn_more_link,
        code_sample: memberDoc?.code_sample,
        tags: prop.Tags,
        security: parsePropertySecurity(prop.Security),
        default: prop.Default,
      });
    } else if (member.MemberType === "Function") {
      const func = member as APIDumpFunction;
      const parameters: MethodParameterDocumentation[] = func.Parameters.map(
        (p, idx) => ({
          name: p.Name,
          type: p.Type.Name,
          default: p.Default,
          description: memberDoc?.params?.[idx]?.documentation,
        }),
      );
      methods.push({
        name: func.Name,
        description: memberDoc?.description,
        learn_more_link: memberDoc?.learn_more_link,
        code_sample: memberDoc?.code_sample,
        parameters,
        returns: memberDoc?.returns,
        returnType: func.ReturnType.Name,
        tags: func.Tags,
        security: typeof func.Security === "string" ? func.Security : undefined,
      });
    } else if (member.MemberType === "Event") {
      const event = member as APIDumpEvent;
      const parameters: EventParameterDocumentation[] = event.Parameters.map(
        (p, idx) => ({
          name: p.Name,
          type: p.Type.Name,
          description: memberDoc?.params?.[idx]?.documentation,
        }),
      );
      events.push({
        name: event.Name,
        description: memberDoc?.description,
        learn_more_link: memberDoc?.learn_more_link,
        code_sample: memberDoc?.code_sample,
        parameters,
        tags: event.Tags,
        security:
          typeof event.Security === "string" ? event.Security : undefined,
      });
    }
  }

  // Include inherited members
  if (
    includeInherited &&
    classData.Superclass &&
    classData.Superclass !== "<<<ROOT>>>"
  ) {
    const parentDocs = getClassDocs(cache, classData.Superclass, true);
    if (parentDocs) {
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
  if (!classData) return null;

  const propMember = classData.Members.find(
    (m) => m.MemberType === "Property" && m.Name === propertyName,
  ) as APIDumpProperty | undefined;

  if (!propMember) {
    if (classData.Superclass && classData.Superclass !== "<<<ROOT>>>") {
      return getPropertyDocs(cache, classData.Superclass, propertyName);
    }
    return null;
  }

  const memberDoc = getMemberDoc(
    cache.apiDocs?.classes?.[className],
    propertyName,
    "Property",
  );

  return {
    name: propMember.Name,
    valueType: propMember.ValueType.Name,
    category: propMember.Category,
    description: memberDoc?.description,
    learn_more_link: memberDoc?.learn_more_link,
    code_sample: memberDoc?.code_sample,
    tags: propMember.Tags,
    security: parsePropertySecurity(propMember.Security),
    default: propMember.Default,
  };
}

/**
 * Get documentation for a specific method
 */
export function getMethodDocs(
  cache: RobloxDocsCache,
  className: string,
  methodName: string,
): MethodDocumentation | null {
  const classData = cache.apiDump.Classes.find((c) => c.Name === className);
  if (!classData) return null;

  const funcMember = classData.Members.find(
    (m) => m.MemberType === "Function" && m.Name === methodName,
  ) as APIDumpFunction | undefined;

  if (!funcMember) {
    if (classData.Superclass && classData.Superclass !== "<<<ROOT>>>") {
      return getMethodDocs(cache, classData.Superclass, methodName);
    }
    return null;
  }

  const memberDoc = getMemberDoc(
    cache.apiDocs?.classes?.[className],
    methodName,
    "Function",
  );

  const parameters: MethodParameterDocumentation[] = funcMember.Parameters.map(
    (p, idx) => ({
      name: p.Name,
      type: p.Type.Name,
      default: p.Default,
      description: memberDoc?.params?.[idx]?.documentation,
    }),
  );

  return {
    name: funcMember.Name,
    description: memberDoc?.description,
    learn_more_link: memberDoc?.learn_more_link,
    code_sample: memberDoc?.code_sample,
    parameters,
    returns: memberDoc?.returns,
    returnType: funcMember.ReturnType.Name,
    tags: funcMember.Tags,
    security:
      typeof funcMember.Security === "string" ? funcMember.Security : undefined,
  };
}

/**
 * Get documentation for a specific event
 */
export function getEventDocs(
  cache: RobloxDocsCache,
  className: string,
  eventName: string,
): EventDocumentation | null {
  const classData = cache.apiDump.Classes.find((c) => c.Name === className);
  if (!classData) return null;

  const eventMember = classData.Members.find(
    (m) => m.MemberType === "Event" && m.Name === eventName,
  ) as APIDumpEvent | undefined;

  if (!eventMember) {
    if (classData.Superclass && classData.Superclass !== "<<<ROOT>>>") {
      return getEventDocs(cache, classData.Superclass, eventName);
    }
    return null;
  }

  const memberDoc = getMemberDoc(
    cache.apiDocs?.classes?.[className],
    eventName,
    "Event",
  );

  const parameters: EventParameterDocumentation[] = eventMember.Parameters.map(
    (p, idx) => ({
      name: p.Name,
      type: p.Type.Name,
      description: memberDoc?.params?.[idx]?.documentation,
    }),
  );

  return {
    name: eventMember.Name,
    description: memberDoc?.description,
    learn_more_link: memberDoc?.learn_more_link,
    code_sample: memberDoc?.code_sample,
    parameters,
    tags: eventMember.Tags,
    security:
      typeof eventMember.Security === "string"
        ? eventMember.Security
        : undefined,
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
    learn_more_link: apiDocDataType.learn_more_link,
    code_sample: apiDocDataType.code_sample,
    constructors: apiDocDataType.constructors
      ? Object.entries(apiDocDataType.constructors).map(([name, data]) => ({
          name,
          description: data.description,
          learn_more_link: data.learn_more_link,
          code_sample: data.code_sample,
          params: data.params,
          returns: data.returns,
        }))
      : undefined,
    properties: apiDocDataType.properties
      ? Object.entries(apiDocDataType.properties).map(([name, data]) => ({
          name,
          description: data.description,
          learn_more_link: data.learn_more_link,
          code_sample: data.code_sample,
        }))
      : undefined,
    methods: apiDocDataType.functions
      ? Object.entries(apiDocDataType.functions).map(([name, data]) => ({
          name,
          description: data.description,
          learn_more_link: data.learn_more_link,
          code_sample: data.code_sample,
          params: data.params,
          returns: data.returns,
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
  if (!enumData) return null;

  const apiDocEnum = cache.apiDocs?.enums?.[enumName];

  return {
    name: enumData.Name,
    description: apiDocEnum?.description,
    learn_more_link: apiDocEnum?.learn_more_link,
    code_sample: apiDocEnum?.code_sample,
    items: enumData.Items.map((item) => {
      const itemDoc = apiDocEnum?.items?.[item.Name];
      return {
        name: item.Name,
        value: item.Value,
        description: itemDoc?.description,
        learn_more_link: itemDoc?.learn_more_link,
        code_sample: itemDoc?.code_sample,
      };
    }),
  };
}

/**
 * Get documentation for an enum item
 */
export function getEnumItemDocs(
  cache: RobloxDocsCache,
  enumName: string,
  itemName: string,
): EnumItemDocumentation | null {
  const enumData = cache.apiDump.Enums.find((e) => e.Name === enumName);
  if (!enumData) return null;

  const itemData = enumData.Items.find((i) => i.Name === itemName);
  if (!itemData) return null;

  const itemDoc = cache.apiDocs?.enums?.[enumName]?.items?.[itemName];

  return {
    name: itemData.Name,
    value: itemData.Value,
    description: itemDoc?.description,
    learn_more_link: itemDoc?.learn_more_link,
    code_sample: itemDoc?.code_sample,
  };
}

/**
 * Get documentation for a global variable or function
 */
export function getGlobalDocs(
  cache: RobloxDocsCache,
  globalName: string,
): GlobalDocumentation | null {
  const globalDoc = cache.apiDocs?.globals?.[globalName];
  if (!globalDoc) return null;

  return {
    name: globalName,
    description: globalDoc.description,
    learn_more_link: globalDoc.learn_more_link,
    code_sample: globalDoc.code_sample,
    params: globalDoc.params,
    returns: globalDoc.returns,
  };
}

// ============================================
// Listing Functions
// ============================================

export function listClasses(cache: RobloxDocsCache): string[] {
  return cache.apiDump.Classes.map((c) => c.Name).sort();
}

export function listEnums(cache: RobloxDocsCache): string[] {
  return cache.apiDump.Enums.map((e) => e.Name).sort();
}

export function listGlobals(cache: RobloxDocsCache): string[] {
  if (!cache.apiDocs?.globals) return [];
  return Object.keys(cache.apiDocs.globals).sort();
}

// ============================================
// Search Functions
// ============================================

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
          if (results.length >= limit) return results;
        }
      }
    }
  }

  return results;
}

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
