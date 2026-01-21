export interface ErrorInfo {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type MessageType = "request" | "response" | "event";

export interface BridgeMessageBase {
  id: string;
  type: MessageType;
  timestamp: number;
}

export interface BridgeRequest extends BridgeMessageBase {
  type: "request";
  method: string;
  params: Record<string, unknown>;
}

export interface BridgeResponse extends BridgeMessageBase {
  type: "response";
  result?: unknown;
  error?: ErrorInfo;
}

export interface BridgeEvent extends BridgeMessageBase {
  type: "event";
  method: string;
  params: Record<string, unknown>;
}

export type BridgeMessage = BridgeRequest | BridgeResponse | BridgeEvent;

export interface InstanceRef {
  path: string;
  class: string;
  name: string;
  id?: string;
}

export interface Color3Value {
  _type: "Color3";
  r: number;
  g: number;
  b: number;
}

export interface Vector3Value {
  _type: "Vector3";
  x: number;
  y: number;
  z: number;
}

export interface Vector2Value {
  _type: "Vector2";
  x: number;
  y: number;
}

export interface CFrameValue {
  _type: "CFrame";
  position: { x: number; y: number; z: number };
  rotation: number[];
}

export interface NumberSequenceKeypoint {
  time: number;
  value: number;
  envelope?: number;
}

export interface NumberSequenceValue {
  _type: "NumberSequence";
  keypoints: NumberSequenceKeypoint[];
}

export interface ColorSequenceKeypoint {
  time: number;
  color: { r: number; g: number; b: number };
}

export interface ColorSequenceValue {
  _type: "ColorSequence";
  keypoints: ColorSequenceKeypoint[];
}

export interface NumberRangeValue {
  _type: "NumberRange";
  min: number;
  max: number;
}

export interface UDimValue {
  _type: "UDim";
  scale: number;
  offset: number;
}

export interface UDim2Value {
  _type: "UDim2";
  x: { scale: number; offset: number };
  y: { scale: number; offset: number };
}

export interface EnumValue {
  _type: "Enum";
  enum: string;
  value: string;
}

export interface InstanceValue {
  _type: "Instance";
  path: string;
}

export interface UnsupportedValue {
  _type: "unsupported";
  typeName: string;
}

export type SerializedValue =
  | Color3Value
  | Vector3Value
  | Vector2Value
  | CFrameValue
  | NumberSequenceValue
  | ColorSequenceValue
  | NumberRangeValue
  | UDimValue
  | UDim2Value
  | EnumValue
  | InstanceValue
  | UnsupportedValue
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>;

export type ValueType =
  | "string"
  | "number"
  | "boolean"
  | "Color3"
  | "Vector3"
  | "Vector2"
  | "CFrame"
  | "NumberSequence"
  | "ColorSequence"
  | "NumberRange"
  | "UDim"
  | "UDim2"
  | "Enum"
  | "Instance";

export interface QueryResult {
  results: InstanceRef[];
  total: number;
  limited: boolean;
}

export interface PropertyResult {
  properties: Record<string, SerializedValue>;
}

export interface AttributeInfo {
  value: SerializedValue;
  type: string;
}

export interface AttributesResult {
  attributes: Record<string, AttributeInfo>;
}

export interface InstanceInfo extends InstanceRef {
  parent?: string;
  attributes?: Record<string, SerializedValue>;
  tags?: string[];
  children?: InstanceRef[];
}

export interface OperationResult {
  success: boolean;
  path?: string;
  class?: string;
  affected_count?: number;
}

export interface SelectionResult {
  selection: string[];
}

export interface ExistsResult {
  exists: boolean;
}
