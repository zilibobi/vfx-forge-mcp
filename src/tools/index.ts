/**
 * VFX Forge MCP Tools
 * Defines all available tools for the MCP server
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { PluginBridge } from "../bridge/connection.js";
import type { RobloxDocsCache } from "../docs/roblox-docs.js";
import {
  getClassDocs,
  getPropertyDocs,
  getMethodDocs,
  getEventDocs,
  getEnumDocs,
  getEnumItemDocs,
  getDataTypeDocs,
  getGlobalDocs,
  listGlobals,
  searchAll,
  searchClasses,
  searchEnums,
  searchProperties,
} from "../docs/roblox-docs.js";
import {
  getDataTypeFormat,
  getAvailableDataTypes,
} from "../docs/serialization-formats.js";

export interface ServerContext {
  bridge: PluginBridge;
  docs: RobloxDocsCache | null;
}

interface ToolDefinition {
  tool: Tool;
  handler: (
    context: ServerContext,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  requiresPlugin: boolean;
}

const tools = new Map<string, ToolDefinition>();

/**
 * Check if a tool requires plugin connection
 */
export function isPluginTool(name: string): boolean {
  return tools.get(name)?.requiresPlugin ?? false;
}

/**
 * Require docs to be loaded, throwing if not available
 */
function requireDocs(context: ServerContext): RobloxDocsCache {
  if (!context.docs) {
    throw new Error("Roblox documentation not loaded");
  }
  return context.docs;
}

function definePluginTool(
  name: string,
  description: string,
  inputSchema: Tool["inputSchema"],
): void {
  tools.set(name, {
    tool: { name, description, inputSchema },
    handler: async (context, args) => {
      const response = await context.bridge.sendRequest(name, args);
      if (response.error) {
        throw new Error(`${response.error.code}: ${response.error.message}`);
      }
      return response.result;
    },
    requiresPlugin: true,
  });
}

function defineLocalTool(
  name: string,
  description: string,
  inputSchema: Tool["inputSchema"],
  handler: (
    context: ServerContext,
    args: Record<string, unknown>,
  ) => Promise<unknown>,
): void {
  tools.set(name, {
    tool: { name, description, inputSchema },
    handler,
    requiresPlugin: false,
  });
}

// Type hints for property values
const PROPERTY_TYPE_ENUM = [
  "string",
  "number",
  "boolean",
  "Color3",
  "Vector3",
  "Vector2",
  "CFrame",
  "NumberSequence",
  "ColorSequence",
  "NumberRange",
  "UDim",
  "UDim2",
  "Rect",
  "Font",
  "BrickColor",
  "Enum",
  "Instance",
];

// Type hints for attribute values
const ATTRIBUTE_TYPE_ENUM = [
  "string",
  "number",
  "boolean",
  "Color3",
  "Vector3",
  "Vector2",
  "CFrame",
  "NumberSequence",
  "ColorSequence",
  "NumberRange",
  "UDim",
  "UDim2",
  "Rect",
  "Font",
  "BrickColor",
];

const VALUE_TYPE_HINT =
  "For complex types, use object with _type field. Use get_datatype_format tool for format.";

export function registerTools(): Tool[] {
  // ============================================
  // Instance Exploration Tools
  // ============================================

  definePluginTool(
    "query_descendants",
    "Query descendants using selector pattern. Supports class filter and name patterns.",
    {
      type: "object",
      properties: {
        root: {
          type: "string",
          description: "Root instance path (default: Workspace)",
        },
        selector: {
          type: "string",
          description: "Selector: ClassName, >Child, >>Descendant, [attr=val]",
        },
        limit: {
          type: "number",
          description: "Max results (default: 100)",
        },
      },
      required: ["selector"],
    },
  );

  definePluginTool("get_children", "Get immediate children of an instance.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
      class_filter: {
        type: "string",
        description: "Optional class name filter",
      },
    },
    required: ["path"],
  });

  definePluginTool(
    "get_instance_info",
    "Get detailed info about an instance including properties, attributes, and tags.",
    {
      type: "object",
      properties: {
        path: { type: "string", description: "Instance path" },
        include_children: {
          type: "boolean",
          description: "Include children list",
          default: false,
        },
        include_attributes: { type: "boolean", default: true },
        include_tags: { type: "boolean", default: true },
      },
      required: ["path"],
    },
  );

  definePluginTool("instance_exists", "Check if an instance exists.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
    },
    required: ["path"],
  });

  // ============================================
  // Property & Attribute Tools
  // ============================================

  definePluginTool(
    "get_properties",
    "Get property values. If no properties specified, returns all readable properties.",
    {
      type: "object",
      properties: {
        path: { type: "string", description: "Instance path" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Property names to get (optional)",
        },
      },
      required: ["path"],
    },
  );

  definePluginTool("set_property", `Set a property. ${VALUE_TYPE_HINT}`, {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
      property: { type: "string", description: "Property name" },
      value: { description: "Value (use _type for complex types)" },
      value_type: {
        type: "string",
        enum: PROPERTY_TYPE_ENUM,
        description: "Type hint (optional if value has _type)",
      },
    },
    required: ["path", "property", "value"],
  });

  definePluginTool("get_attributes", "Get all attributes of an instance.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
    },
    required: ["path"],
  });

  definePluginTool("set_attribute", `Set an attribute. ${VALUE_TYPE_HINT}`, {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
      attribute: { type: "string", description: "Attribute name" },
      value: { description: "Value (use _type for complex types)" },
      value_type: {
        type: "string",
        enum: ATTRIBUTE_TYPE_ENUM,
        description: "Type hint (optional if value has _type)",
      },
    },
    required: ["path", "attribute", "value"],
  });

  definePluginTool("delete_attribute", "Delete an attribute.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
      attribute: { type: "string", description: "Attribute name" },
    },
    required: ["path", "attribute"],
  });

  // ============================================
  // Tag Tools
  // ============================================

  definePluginTool("get_tags", "Get all tags from an instance.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
    },
    required: ["path"],
  });

  definePluginTool("add_tag", "Add a tag to an instance.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
      tag: { type: "string", description: "Tag name" },
    },
    required: ["path", "tag"],
  });

  definePluginTool("remove_tag", "Remove a tag from an instance.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
      tag: { type: "string", description: "Tag name" },
    },
    required: ["path", "tag"],
  });

  definePluginTool("get_tagged_instances", "Find all instances with a tag.", {
    type: "object",
    properties: {
      tag: { type: "string", description: "Tag name" },
      root: { type: "string", description: "Optional root to filter within" },
      limit: { type: "number", description: "Max results (default: 100)" },
    },
    required: ["tag"],
  });

  // ============================================
  // Selection Tools
  // ============================================

  definePluginTool("get_selection", "Get currently selected instances.", {
    type: "object",
    properties: {},
  });

  definePluginTool("set_selection", "Set Studio selection.", {
    type: "object",
    properties: {
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Instance paths to select",
      },
    },
    required: ["paths"],
  });

  // ============================================
  // Collision Group Tools
  // ============================================

  definePluginTool("create_collision_group", "Create a collision group.", {
    type: "object",
    properties: {
      name: { type: "string", description: "Group name" },
    },
    required: ["name"],
  });

  definePluginTool("delete_collision_group", "Delete a collision group.", {
    type: "object",
    properties: {
      name: { type: "string", description: "Group name" },
    },
    required: ["name"],
  });

  definePluginTool(
    "set_collision_group_collidable",
    "Set whether two collision groups collide.",
    {
      type: "object",
      properties: {
        group1: { type: "string", description: "First group name" },
        group2: { type: "string", description: "Second group name" },
        collidable: { type: "boolean", description: "Whether they collide" },
      },
      required: ["group1", "group2", "collidable"],
    },
  );

  definePluginTool(
    "get_collision_group_collidable",
    "Check if two collision groups collide.",
    {
      type: "object",
      properties: {
        group1: { type: "string", description: "First group name" },
        group2: { type: "string", description: "Second group name" },
      },
      required: ["group1", "group2"],
    },
  );

  definePluginTool(
    "set_part_collision_group",
    "Assign a part to a collision group.",
    {
      type: "object",
      properties: {
        path: { type: "string", description: "Part instance path" },
        group: { type: "string", description: "Collision group name" },
      },
      required: ["path", "group"],
    },
  );

  // ============================================
  // Instance Creation Tools
  // ============================================

  definePluginTool(
    "create_instance",
    `Create an instance. ${VALUE_TYPE_HINT}`,
    {
      type: "object",
      properties: {
        class_name: { type: "string", description: "Roblox class name" },
        parent: { type: "string", description: "Parent instance path" },
        name: { type: "string", description: "Instance name (optional)" },
        properties: {
          type: "object",
          description: "Initial properties (use _type for complex values)",
        },
        attributes: {
          type: "object",
          description: "Initial attributes (use _type for complex values)",
        },
      },
      required: ["class_name", "parent"],
    },
  );

  definePluginTool(
    "create_effect_preset",
    "Create a preset VFX effect (fire, smoke, sparkles, etc.).",
    {
      type: "object",
      properties: {
        preset: {
          type: "string",
          enum: [
            "fire",
            "smoke",
            "sparkles",
            "magic_circle",
            "lightning",
            "explosion",
            "heal",
            "buff",
            "shield",
            "trail",
            "glow",
            "impact",
            "aura",
            "rain",
            "snow",
          ],
          description: "Preset name",
        },
        parent: { type: "string", description: "Parent instance path" },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" },
          },
          description: "Optional position offset",
        },
      },
      required: ["preset", "parent"],
    },
  );

  definePluginTool("clone_instance", "Clone an instance.", {
    type: "object",
    properties: {
      source: { type: "string", description: "Source instance path" },
      parent: { type: "string", description: "Parent for clone (optional)" },
      name: { type: "string", description: "Clone name (optional)" },
    },
    required: ["source"],
  });

  definePluginTool("bulk_clone_instances", "Clone multiple instances.", {
    type: "object",
    properties: {
      sources: {
        type: "array",
        items: { type: "string" },
        description: "Paths to clone",
      },
      parent: { type: "string", description: "Parent for all clones" },
      name_suffix: { type: "string", description: "Suffix for clone names" },
    },
    required: ["sources"],
  });

  definePluginTool("delete_instance", "Delete an instance.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
    },
    required: ["path"],
  });

  definePluginTool("delete_instances", "Delete multiple instances.", {
    type: "object",
    properties: {
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Paths to delete",
      },
    },
    required: ["paths"],
  });

  // ============================================
  // Transform Tools
  // ============================================

  definePluginTool("scale_instance", "Scale an instance uniformly.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
      scale: {
        type: "number",
        description: "Scale factor (>0)",
        minimum: 0,
        exclusiveMinimum: true,
      },
    },
    required: ["path", "scale"],
  });

  definePluginTool("get_bounding_box", "Get bounding box of an instance.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
    },
    required: ["path"],
  });

  // ============================================
  // Bulk Operation Tools
  // ============================================

  definePluginTool("bulk_scale", "Scale multiple instances.", {
    type: "object",
    properties: {
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Instance paths",
      },
      factor: { type: "number", description: "Scale factor" },
    },
    required: ["paths", "factor"],
  });

  definePluginTool(
    "bulk_set_color",
    "Set Color3 property on multiple instances.",
    {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Instance paths",
        },
        color: {
          type: "object",
          properties: {
            r: { type: "number", minimum: 0, maximum: 1 },
            g: { type: "number", minimum: 0, maximum: 1 },
            b: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["r", "g", "b"],
          description: "Color (0-1 values)",
        },
      },
      required: ["paths", "color"],
    },
  );

  definePluginTool(
    "bulk_set_color3_attribute",
    "Set Color3 attribute on multiple instances.",
    {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Instance paths",
        },
        color: {
          type: "object",
          properties: {
            r: { type: "number", minimum: 0, maximum: 1 },
            g: { type: "number", minimum: 0, maximum: 1 },
            b: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["r", "g", "b"],
          description: "Color (0-1 values)",
        },
      },
      required: ["paths", "color"],
    },
  );

  definePluginTool(
    "bulk_set_transparency",
    "Set Transparency on multiple instances.",
    {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Instance paths",
        },
        scale: { type: "number", description: "Transparency (0-1)" },
      },
      required: ["paths", "scale"],
    },
  );

  definePluginTool("bulk_move", "Move multiple instances by offset.", {
    type: "object",
    properties: {
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Instance paths",
      },
      offset: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          z: { type: "number" },
        },
        required: ["x", "y", "z"],
        description: "Movement offset",
      },
    },
    required: ["paths", "offset"],
  });

  definePluginTool("bulk_delete", "Delete multiple instances.", {
    type: "object",
    properties: {
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Paths to delete",
      },
    },
    required: ["paths"],
  });

  // ============================================
  // VFX-Specific Tools
  // ============================================

  definePluginTool("get_effect_types", "List available VFX effect types.", {
    type: "object",
    properties: {
      effect_type: {
        type: "string",
        enum: ["particle", "beam", "trail", "light", "all"],
        description: "Filter by type",
      },
    },
    required: ["effect_type"],
  });

  definePluginTool("analyze_effect", "Analyze a VFX effect setup.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Effect instance path" },
    },
    required: ["path"],
  });

  definePluginTool("get_bezier_curve", "Get bezier curve data for animation.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance with curve" },
      curve_name: { type: "string", description: "Curve name" },
    },
    required: ["path", "curve_name"],
  });

  definePluginTool("set_bezier_curve", "Set bezier curve data for animation.", {
    type: "object",
    properties: {
      path: { type: "string", description: "Instance path" },
      curve_name: { type: "string", description: "Curve name" },
      points: {
        type: "array",
        items: {
          type: "object",
          properties: {
            time: { type: "number", minimum: 0, maximum: 1 },
            value: { type: "number", minimum: 0, maximum: 1 },
            left_tangent: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
            right_tangent: {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          required: ["time", "value"],
        },
        description: "Curve points",
      },
      preset: {
        type: "string",
        enum: ["linear", "ease_in", "ease_out", "ease_in_out"],
        description: "Use preset instead of points",
      },
    },
    required: ["path", "curve_name"],
  });

  // ============================================
  // More Bulk Operations
  // ============================================

  definePluginTool(
    "bulk_set_attribute",
    `Set attribute on multiple instances. ${VALUE_TYPE_HINT}`,
    {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Instance paths",
        },
        attribute: { type: "string", description: "Attribute name" },
        value: { description: "Value (use _type for complex types)" },
        value_type: { type: "string", description: "Type hint (optional)" },
      },
      required: ["paths", "attribute", "value"],
    },
  );

  definePluginTool(
    "bulk_set_property",
    `Set property on multiple instances. ${VALUE_TYPE_HINT}`,
    {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Instance paths",
        },
        property: { type: "string", description: "Property name" },
        value: { description: "Value (use _type for complex types)" },
        value_type: { type: "string", description: "Type hint (optional)" },
      },
      required: ["paths", "property", "value"],
    },
  );

  definePluginTool(
    "bulk_create_instances",
    `Create multiple instances. ${VALUE_TYPE_HINT}`,
    {
      type: "object",
      properties: {
        instances: {
          type: "array",
          items: {
            type: "object",
            properties: {
              class_name: { type: "string" },
              parent: { type: "string" },
              name: { type: "string" },
              properties: { type: "object" },
              attributes: { type: "object" },
            },
            required: ["class_name", "parent"],
          },
          description: "Instance definitions",
        },
      },
      required: ["instances"],
    },
  );

  // ============================================
  // Documentation Tools (Local)
  // ============================================

  defineLocalTool(
    "search_roblox_docs",
    "Search Roblox API by partial name. Finds matching classes, enums, and properties.",
    {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (partial match)" },
        category: {
          type: "string",
          enum: ["all", "classes", "enums", "properties"],
          description: "What to search (default: all)",
        },
        limit: {
          type: "number",
          description: "Max results per category (default: 10)",
        },
      },
      required: ["query"],
    },
    async (context, args) => {
      const docs = requireDocs(context);
      const query = args.query as string;
      const category = (args.category as string) ?? "all";
      const limit = (args.limit as number) ?? 10;

      if (category === "classes") {
        return { classes: searchClasses(docs, query, limit) };
      } else if (category === "enums") {
        return { enums: searchEnums(docs, query, limit) };
      } else if (category === "properties") {
        return { properties: searchProperties(docs, query, limit) };
      } else {
        return searchAll(docs, query, limit);
      }
    },
  );

  defineLocalTool(
    "get_roblox_description",
    "Get documentation for a Roblox API element by type and name.",
    {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "class",
            "property",
            "method",
            "event",
            "enum",
            "enum_item",
            "datatype",
            "global",
          ],
          description: "Type of element to look up",
        },
        name: {
          type: "string",
          description:
            "Element name. For members use 'ClassName.MemberName' format.",
        },
      },
      required: ["type", "name"],
    },
    async (context, args) => {
      const docs = requireDocs(context);
      const lookupType = args.type as string;
      const name = args.name as string;

      // Parse "ClassName.MemberName" format
      const dotIndex = name.indexOf(".");
      const first = dotIndex > 0 ? name.slice(0, dotIndex) : name;
      const second = dotIndex > 0 ? name.slice(dotIndex + 1) : undefined;

      switch (lookupType) {
        case "class": {
          const result = getClassDocs(docs, name, false);
          if (!result) throw new Error(`Class not found: ${name}`);
          return {
            type: "class",
            name: result.name,
            superclass: result.superclass,
            description: result.description || "No description available.",
          };
        }

        case "property": {
          if (!second)
            throw new Error(
              "Property lookup requires 'ClassName.PropertyName' format",
            );
          const result = getPropertyDocs(docs, first, second);
          if (!result) throw new Error(`Property not found: ${name}`);
          return {
            type: "property",
            name: `${first}.${result.name}`,
            valueType: result.valueType,
            description: result.description || "No description available.",
            learn_more_link: result.learn_more_link,
            code_sample: result.code_sample,
            writable: result.security?.write === "None",
            default: result.default,
          };
        }

        case "method": {
          if (!second)
            throw new Error(
              "Method lookup requires 'ClassName.MethodName' format",
            );
          const result = getMethodDocs(docs, first, second);
          if (!result) throw new Error(`Method not found: ${name}`);
          return {
            type: "method",
            name: `${first}.${result.name}`,
            description: result.description || "No description available.",
            learn_more_link: result.learn_more_link,
            code_sample: result.code_sample,
            parameters: result.parameters.map((p) => ({
              name: p.name,
              type: p.type,
              default: p.default,
              description: p.description,
            })),
            returns: result.returns,
            returnType: result.returnType,
          };
        }

        case "event": {
          if (!second)
            throw new Error(
              "Event lookup requires 'ClassName.EventName' format",
            );
          const result = getEventDocs(docs, first, second);
          if (!result) throw new Error(`Event not found: ${name}`);
          return {
            type: "event",
            name: `${first}.${result.name}`,
            description: result.description || "No description available.",
            learn_more_link: result.learn_more_link,
            code_sample: result.code_sample,
            parameters: result.parameters.map((p) => ({
              name: p.name,
              type: p.type,
              description: p.description,
            })),
          };
        }

        case "enum": {
          const result = getEnumDocs(docs, name);
          if (!result) throw new Error(`Enum not found: ${name}`);
          return {
            type: "enum",
            name: result.name,
            description: result.description || "No description available.",
            learn_more_link: result.learn_more_link,
            code_sample: result.code_sample,
            items: result.items.map((i) => ({
              name: i.name,
              value: i.value,
              description: i.description,
            })),
          };
        }

        case "enum_item": {
          if (!second)
            throw new Error(
              "Enum item lookup requires 'EnumName.ItemName' format",
            );
          const result = getEnumItemDocs(docs, first, second);
          if (!result) throw new Error(`Enum item not found: ${name}`);
          return {
            type: "enum_item",
            name: `${first}.${result.name}`,
            value: result.value,
            description: result.description || "No description available.",
            learn_more_link: result.learn_more_link,
            code_sample: result.code_sample,
          };
        }

        case "datatype": {
          const result = getDataTypeDocs(docs, name);
          if (!result) throw new Error(`Datatype not found: ${name}`);
          return {
            type: "datatype",
            name: result.name,
            description: result.description || "No description available.",
            learn_more_link: result.learn_more_link,
            code_sample: result.code_sample,
            constructors: result.constructors?.map((c) => c.name),
            properties: result.properties?.map((p) => p.name),
            methods: result.methods?.map((m) => m.name),
          };
        }

        case "global": {
          const result = getGlobalDocs(docs, name);
          if (!result) throw new Error(`Global not found: ${name}`);
          return {
            type: "global",
            name: result.name,
            description: result.description || "No description available.",
            learn_more_link: result.learn_more_link,
            code_sample: result.code_sample,
            params: result.params,
            returns: result.returns,
          };
        }

        default:
          throw new Error(`Unknown lookup type: ${lookupType}`);
      }
    },
  );

  defineLocalTool(
    "get_roblox_class_docs",
    "Get Roblox class documentation with member listings.",
    {
      type: "object",
      properties: {
        class_name: { type: "string", description: "Class name" },
        include_inherited: {
          type: "boolean",
          description: "Include inherited members (default: false)",
          default: false,
        },
        members: {
          type: "string",
          enum: ["all", "properties", "methods", "events"],
          description: "Which members to return (default: properties)",
          default: "properties",
        },
      },
      required: ["class_name"],
    },
    async (context, args) => {
      const docs = requireDocs(context);
      const className = args.class_name as string;
      const includeInherited = (args.include_inherited as boolean) ?? false;
      const members = (args.members as string) ?? "properties";

      const result = getClassDocs(docs, className, includeInherited);
      if (!result) throw new Error(`Class not found: ${className}`);

      const output: Record<string, unknown> = {
        name: result.name,
        superclass: result.superclass,
      };

      if (members === "all" || members === "properties") {
        output.properties = Object.fromEntries(
          result.properties
            .filter((p) => p.security?.write === "None")
            .map((p) => [p.name, p.valueType]),
        );
      }

      if (members === "all" || members === "methods") {
        output.methods = result.methods.map((m) => ({
          name: m.name,
          params: m.parameters.map((p) => `${p.name}: ${p.type}`).join(", "),
          returns: m.returnType,
        }));
      }

      if (members === "all" || members === "events") {
        output.events = result.events.map((e) => ({
          name: e.name,
          params: e.parameters.map((p) => `${p.name}: ${p.type}`).join(", "),
        }));
      }

      return output;
    },
  );

  defineLocalTool(
    "get_roblox_property_docs",
    "Get detailed docs for a specific property.",
    {
      type: "object",
      properties: {
        class_name: { type: "string", description: "Class name" },
        property_name: { type: "string", description: "Property name" },
      },
      required: ["class_name", "property_name"],
    },
    async (context, args) => {
      const docs = requireDocs(context);
      const className = args.class_name as string;
      const propertyName = args.property_name as string;

      const result = getPropertyDocs(docs, className, propertyName);
      if (!result)
        throw new Error(`Property not found: ${className}.${propertyName}`);

      return {
        name: result.name,
        type: result.valueType,
        writable: result.security?.write === "None",
        description: result.description,
        learn_more_link: result.learn_more_link,
        code_sample: result.code_sample,
        default: result.default,
        category: result.category,
      };
    },
  );

  defineLocalTool(
    "get_roblox_enum_docs",
    "Get enum values with descriptions.",
    {
      type: "object",
      properties: {
        enum_name: { type: "string", description: "Enum name" },
        include_descriptions: {
          type: "boolean",
          description: "Include item descriptions (default: false)",
          default: false,
        },
      },
      required: ["enum_name"],
    },
    async (context, args) => {
      const docs = requireDocs(context);
      const enumName = args.enum_name as string;
      const includeDescriptions =
        (args.include_descriptions as boolean) ?? false;

      const result = getEnumDocs(docs, enumName);
      if (!result) throw new Error(`Enum not found: ${enumName}`);

      return {
        name: result.name,
        description: result.description,
        learn_more_link: result.learn_more_link,
        items: includeDescriptions
          ? result.items.map((i) => ({
              name: i.name,
              value: i.value,
              description: i.description,
            }))
          : result.items.map((i) => i.name),
      };
    },
  );

  defineLocalTool(
    "list_roblox_globals",
    "List all available global variables and functions.",
    {
      type: "object",
      properties: {},
    },
    async (context) => {
      const docs = requireDocs(context);
      return { globals: listGlobals(docs) };
    },
  );

  defineLocalTool(
    "get_datatype_format",
    `Get JSON serialization format for a Roblox datatype. Available: ${getAvailableDataTypes().join(", ")}`,
    {
      type: "object",
      properties: {
        datatype_name: {
          type: "string",
          description: "Datatype name (Vector3, Color3, etc.)",
        },
      },
      required: ["datatype_name"],
    },
    async (_context, args) => {
      const dataTypeName = args.datatype_name as string;
      const format = getDataTypeFormat(dataTypeName);
      if (!format) {
        throw new Error(
          `Unknown datatype: ${dataTypeName}. Available: ${getAvailableDataTypes().join(", ")}`,
        );
      }

      return {
        name: format.name,
        description: format.description,
        example: format.example,
        notes: format.notes,
      };
    },
  );

  // ============================================
  // Connection Status Tool (Local)
  // ============================================

  defineLocalTool(
    "get_connection_status",
    "Get plugin bridge connection status.",
    {
      type: "object",
      properties: {},
    },
    async (context) => {
      const info = context.bridge.getConnectionInfo();
      return {
        connected: info.connected,
        plugin_version: info.pluginVersion,
        uptime_ms: info.connectedAt ? Date.now() - info.connectedAt : 0,
      };
    },
  );

  return Array.from(tools.values()).map((def) => def.tool);
}

export async function handleToolCall(
  context: ServerContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const toolDef = tools.get(toolName);

  if (!toolDef) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  if (toolDef.requiresPlugin && !context.bridge.isConnected()) {
    throw new Error(
      `Tool "${toolName}" requires plugin connection. Plugin is not connected.`,
    );
  }

  return toolDef.handler(context, args);
}
