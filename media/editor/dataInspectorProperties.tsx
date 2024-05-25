/** Reads a ULEB128 at offset 0 from the buffer. */
const getULEB128 = (arrayBuffer: ArrayBuffer) => {
  const buf = new Uint8Array(arrayBuffer);

  let result = 0n;
  let shift = 0n;
  let index = 0;
  while (true) {
    if (shift > 128n || index >= buf.length) {
      return "";
    }
    const byte: bigint = BigInt(buf[index++]);
    result |= (byte & 0x7fn) << shift;
    if ((0x80n & byte) === 0n) {
      return result;
    }
    shift += 7n;
  }
};

/** Reads a SLEB128 at offset 0 from the buffer. */
const getSLEB128 = (arrayBuffer: ArrayBuffer) => {
  const buf = new Uint8Array(arrayBuffer);

  let result = 0n;
  let shift = 0n;
  let index = 0;
  while (true) {
    if (shift > 128n || index >= buf.length) {
      return "";
    }
    const byte: bigint = BigInt(buf[index++]);
    result |= (byte & 0x7fn) << shift;
    shift += 7n;
    if ((0x80n & byte) === 0n) {
      if (shift < 128n && (byte & 0x40n) !== 0n) {
        result |= ~0n << shift;
        return result;
      }
      return result;
    }
  }
};

/** Reads a uint24 at offset 0 from the buffer. */
const getUint24 = (arrayBuffer: ArrayBuffer, le: boolean) => {
  const buf = new Uint8Array(arrayBuffer);
  return le ? buf[0] | (buf[1] << 8) | (buf[2] << 16) : (buf[0] << 16) | (buf[1] << 8) | buf[2];
};

const getFloat16 = (exponentWidth: number, significandPrecision: number) => {
  const exponentMask = (2 ** exponentWidth - 1) << significandPrecision;
  const fractionMask = 2 ** significandPrecision - 1;

  const exponentBias = 2 ** (exponentWidth - 1) - 1;
  const exponentMin = 1 - exponentBias;

  return (arrayBuffer: ArrayBuffer, le: boolean) => {
    const buf = new Uint8Array(arrayBuffer);
    const uint16 = le ? buf[0] | (buf[1] << 8) : (buf[0] << 8) | buf[1];

    const e = (uint16 & exponentMask) >> significandPrecision;
    const f = uint16 & fractionMask;
    const sign = uint16 >> 15 ? -1 : 1;

    if (e === 0) {
      return sign * 2 ** exponentMin * (f / 2 ** significandPrecision);
    } else if (e === 2 ** exponentWidth - 1) {
      return f ? NaN : sign * Infinity;
    }

    return sign * 2 ** (e - exponentBias) * (1 + f / 2 ** significandPrecision);
  };
};

export interface IInspectableType {
  /** Readable label for the type */
  label: string;
  /** Minimum number of bytes needed to accurate disable this type */
  minBytes: number;
  /** Shows the representation of the type from the data view */
  convert(dv: DataView, littleEndian: boolean): string;
}

const baseTypes: IInspectableType[] = [
  {
    label: "binary",
    minBytes: 1,
    convert: dv =>
      convertByChunk(dv, 1, dataView => dataView.getUint8(0).toString(2).padStart(8, "0")),
  },
  {
    label: "octal",
    minBytes: 1,
    convert: dv =>
      convertByChunk(dv, 1, dataView => dataView.getUint8(0).toString(8).padStart(3, "0")),
  },
  {
    label: "uint8",
    minBytes: 1,
    convert: dv => convertByChunk(dv, 1, dataView => dataView.getUint8(0).toString()),
  },
  {
    label: "int8",
    minBytes: 1,
    convert: dv => convertByChunk(dv, 1, dataView => dataView.getInt8(0).toString()),
  },
  {
    label: "uint16",
    minBytes: 2,
    convert: (dv, le) => convertByChunk(dv, 2, dataView => dataView.getUint16(0, le).toString()),
  },
  {
    label: "int16",
    minBytes: 2,
    convert: (dv, le) => convertByChunk(dv, 2, dataView => dataView.getInt16(0, le).toString()),
  },
  {
    label: "uint32",
    minBytes: 4,
    convert: (dv, le) => convertByChunk(dv, 4, dataView => dataView.getUint32(0, le).toString()),
  },
  {
    label: "int32",
    minBytes: 4,
    convert: (dv, le) => convertByChunk(dv, 4, dataView => dataView.getInt32(0, le).toString()),
  },
  {
    label: "uint64",
    minBytes: 8,
    convert: (dv, le) => convertByChunk(dv, 8, dataView => dataView.getBigUint64(0, le).toString()),
  },
  {
    label: "int64",
    minBytes: 8,
    convert: (dv, le) => convertByChunk(dv, 8, dataView => dataView.getBigInt64(0, le).toString()),
  },
  {
    label: "float32",
    minBytes: 4,
    convert: (dv, le) => convertByChunk(dv, 4, dataView => dataView.getFloat32(0, le).toString()),
  },

  {
    label: "float64",
    minBytes: 8,
    convert: (dv, le) => convertByChunk(dv, 8, dataView => dataView.getFloat64(0, le).toString()),
  },
];

const inspectTypesBuilder: IInspectableType[] = [...baseTypes];

const addTextDecoder = (encoding: string, minBytes: number) => {
  try {
    new TextDecoder(encoding); // throws if encoding is now supported
  } catch {
    return;
  }

  inspectTypesBuilder.push({
    label: encoding.toUpperCase(),
    minBytes,
    convert: dv => {
      const utf8 = new TextDecoder(encoding).decode(dv.buffer);
      return utf8;
    },
  });
};

addTextDecoder("ascii", 1);
addTextDecoder("utf-8", 1);
addTextDecoder("utf-16", 2);
// addTextDecoder("gb18030", 2);
// addTextDecoder("big5", 2);
// addTextDecoder("iso-2022-kr", 2);
// addTextDecoder("shift-jis", 2);

export const inspectableTypes: readonly IInspectableType[] = inspectTypesBuilder;

export const getFormatByLabel = (label: string): IInspectableType | undefined => {
  return inspectableTypes.find(format => format.label === label);
};

export interface IFormat {
  label: string;
  minBytes: number;
  locations: number[][];
  isArray?: boolean;
  arrayItemFormat?: string;
  arrayLength?: number;
  subStructures?: IFormat[];
}

export class FormatManager {
  private baseformats: IFormat[];
  private specialFormats: IFormat[];
  private userFormats: IFormat[];
  private textFormats: IFormat[];

  constructor() {
    this.baseformats = [];
    this.specialFormats = [];
    this.userFormats = [];
    this.textFormats = [];
    this.initDefaultFormats();
  }

  private initDefaultFormats() {
    this.specialFormats.push(
      { label: "raw", minBytes: 1, locations: [] },
      { label: "undefStruct", minBytes: 1, locations: [] },
      // { label: "array", minBytes: 1 },
    );
    // this.specialFormats.push();
    this.baseformats.push(
      ...baseTypes.map(format => ({
        label: format.label,
        minBytes: format.minBytes,
        locations: [],
      })),
    );

    this.textFormats.push(
      { label: "ASCII", minBytes: 1, locations: [] },
      { label: "UTF-8", minBytes: 1, locations: [] },
      { label: "UTF-16", minBytes: 1, locations: [] },
    );
  }

  // Add a new format
  addFormat(format: IFormat) {
    this.userFormats.push(format);
  }

  // Get all formats
  getBaseFormats(): ReadonlyArray<IFormat> {
    return this.baseformats;
  }

  getTextFormats(): ReadonlyArray<IFormat> {
    return this.textFormats;
  }

  getUserFormats(): ReadonlyArray<IFormat> {
    return this.userFormats;
  }

  getAllFormats(): ReadonlyArray<IFormat> {
    const allFormats = [
      ...this.baseformats,
      ...this.textFormats,
      ...this.specialFormats,
      ...this.userFormats,
    ];
    return allFormats;
  }

  getAtomFormats(): ReadonlyArray<IFormat> {
    const atomFormats = [...this.baseformats, ...this.textFormats];
    return atomFormats;
  }

  // // Get format by label
  getFormatByLabel(label: string): IFormat | undefined {
    return this.getAllFormats().find(format => format.label === label);
  }

  getUserFormatByLabel(label: string): IFormat | undefined {
    return this.getUserFormats().find(format => format.label === label);
  }

  // Update format by label
  addLocationByLabel(label: string, location: number[]): void {
    const index = this.userFormats.findIndex(format => format.label === label);
    if (index !== -1) {
      if (this.userFormats[index].locations === undefined) {
        this.userFormats[index].locations = [];
      }
      this.userFormats[index].locations.push(location);
    }
  }

  removeLocationByLabel(label: string, location: number[]): void {
    const index = this.userFormats.findIndex(format => format.label === label);
    if (index !== -1 && this.userFormats[index].locations) {
      // 找到了包含该位置的格式
      const locationIndex = this.userFormats[index].locations.findIndex(loc => {
        // 检查位置是否匹配
        return loc.every((value, idx) => value === location[idx]);
      });
      if (locationIndex !== -1) {
        // 从位置数组中移除该位置
        // const index = locationIndex ? locationIndex : -1;
        this.userFormats[index].locations.splice(locationIndex, 1);
        if (this.userFormats[index].locations.length === 0) {
          this.deleteFormatByLabel(label);
        }
      }
    }
  }
  deleteFormatByLabel(label: string): void {
    const deleteFromArray = (formats: IFormat[]) => {
      const index = formats.findIndex(format => format.label === label);
      if (index !== -1) {
        formats.splice(index, 1);
      }
    };

    // deleteFromArray(this.baseformats);
    // deleteFromArray(this.specialFormats);
    deleteFromArray(this.userFormats);
    // deleteFromArray(this.textFormats);
  }
}

export const formatManager = new FormatManager();

// 按照 minBytes 进行分段处理，并依次转换为字符串
const convertByChunk = (
  dv: DataView,
  chunkSize: number,
  convertFn: (dv: DataView) => string,
): string => {
  const values: string[] = [];
  const totalBytes = dv.byteLength;

  // 分段处理
  for (let i = 0; i < totalBytes; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, totalBytes);
    // 只有当分段长度等于 chunkSize 时才进行解析
    if (chunkEnd - i === chunkSize) {
      const chunkDv = new DataView(dv.buffer, dv.byteOffset + i, chunkEnd - i);
      const value = convertFn(chunkDv);
      values.push(value);
    }
  }

  // 如果最后一个分段不完整，则在最后一个分段设置标记
  if (totalBytes % chunkSize !== 0) {
    values.push("*"); // 设置标记
  }

  return values.join(" "); // 拼接各段结果
};
