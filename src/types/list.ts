import type { List } from "../models/liste";


export type PartialList = Omit<List, '@id' | 'id' | 'name' | 'type'> & { id?: number, name?: string, type?: ListTypes }

export type ListTypes = "0" | "1" | "2" | "3" | "4" | "5"

export type ListTypesMap = Record<ListTypes, string>;