/**
 * Type definitions for Roblox API documentation
 */

// ============================================
// API Dump Types (from CloneTrooper1019/Roblox-Client-Tracker)
// ============================================

export interface APIDumpMember {
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

export interface APIDumpProperty extends APIDumpMember {
  MemberType: "Property";
  ValueType: {
    Category: string;
    Name: string;
  };
  Category?: string;
  Default?: string;
}

export interface APIDumpFunction extends APIDumpMember {
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

export interface APIDumpEvent extends APIDumpMember {
  MemberType: "Event";
  Parameters: Array<{
    Name: string;
    Type: {
      Category: string;
      Name: string;
    };
  }>;
}

export interface APIDumpClass {
  Name: string;
  Superclass: string;
  Tags?: string[];
  Members: Array<APIDumpProperty | APIDumpFunction | APIDumpEvent>;
}

export interface APIDumpEnum {
  Name: string;
  Items: Array<{
    Name: string;
    Value: number;
  }>;
}

export interface APIDump {
  Version: number;
  Classes: APIDumpClass[];
  Enums: APIDumpEnum[];
}

// ============================================
// API Documentation Types (from luau-lsp)
// ============================================

export interface APIDocMember {
  name: string;
  description?: string;
  code_sample?: string;
  deprecated?: boolean;
  learn_more_link?: string;
  params?: Array<{ name: string; documentation?: string }>;
  returns?: string[];
  overloads?: Record<string, string>;
}

export interface APIDocClass {
  name: string;
  description?: string;
  code_sample?: string;
  properties?: Record<string, APIDocMember>;
  functions?: Record<string, APIDocMember>;
  events?: Record<string, APIDocMember>;
}

export interface APIDocDataType {
  name: string;
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
  constructors?: Record<string, APIDocMember>;
  properties?: Record<string, APIDocMember>;
  functions?: Record<string, APIDocMember>;
}

export interface APIDocEnumItem {
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
}

export interface APIDocEnum {
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
  items?: Record<string, APIDocEnumItem>;
}

export interface APIDocumentation {
  classes: Record<string, APIDocClass>;
  datatypes?: Record<string, APIDocDataType>;
  enums?: Record<string, APIDocEnum>;
  globals?: Record<string, APIDocMember>;
}

// Raw API docs entry from luau-lsp JSON (before transformation)
export interface RawAPIDocEntry {
  documentation?: string;
  learn_more_link?: string;
  code_sample?: string;
  keys?: Record<string, string>;
  params?: Array<{ name: string; documentation?: string }>;
  returns?: string[];
  overloads?: Record<string, string>;
}

// ============================================
// Exported Documentation Result Types
// ============================================

export interface RobloxDocsCache {
  apiDump: APIDump;
  apiDocs: APIDocumentation | null;
  lastUpdated: number;
  version: string;
}

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
  learn_more_link?: string;
  code_sample?: string;
  tags?: string[];
  security?: {
    read: string;
    write: string;
  };
  default?: string;
}

export interface MethodParameterDocumentation {
  name: string;
  type: string;
  default?: string;
  description?: string;
}

export interface MethodDocumentation {
  name: string;
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
  parameters: MethodParameterDocumentation[];
  returns?: string[];
  returnType: string;
  tags?: string[];
  security?: string;
}

export interface EventParameterDocumentation {
  name: string;
  type: string;
  description?: string;
}

export interface EventDocumentation {
  name: string;
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
  parameters: EventParameterDocumentation[];
  tags?: string[];
  security?: string;
}

export interface DataTypeMemberDocumentation {
  name: string;
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
  params?: Array<{ name: string; documentation?: string }>;
  returns?: string[];
}

export interface DataTypeDocumentation {
  name: string;
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
  constructors?: DataTypeMemberDocumentation[];
  properties?: DataTypeMemberDocumentation[];
  methods?: DataTypeMemberDocumentation[];
}

export interface EnumItemDocumentation {
  name: string;
  value: number;
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
}

export interface EnumDocumentation {
  name: string;
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
  items: EnumItemDocumentation[];
}

export interface GlobalDocumentation {
  name: string;
  description?: string;
  learn_more_link?: string;
  code_sample?: string;
  params?: Array<{ name: string; documentation?: string }>;
  returns?: string[];
}
