import type { Contact } from "./contact";

export interface User extends Contact {
  lists?: any;
  password?: string;
}
