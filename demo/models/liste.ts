import type { ListTypes, ListTypesMap } from "../types/list";
import type { Item } from "./item";


export interface List extends Item {
  guest?: any;
  items?: string[];
  name?: string;
  owner?: any;
  type?: ListTypes;
}


export const TYPE_COLLECTION: string = "collection"
export const TYPE_GIFT: string = "gift"
export const TYPE_MAINTEANCE: string = "maintenance"
export const TYPE_RECIPE: string = "recipe"
export const TYPE_SHOPPING: string = "shopping"
export const TYPE_TASK: string = "task"
export const LIST_TYPES: ListTypesMap = {
  "0": TYPE_COLLECTION,
  "1": TYPE_GIFT,
  "2": TYPE_MAINTEANCE,
  "3": TYPE_RECIPE,
  "4": TYPE_SHOPPING,
  "5": TYPE_TASK,
}
