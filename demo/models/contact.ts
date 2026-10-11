import type { Item } from "./item";

export interface Contact extends Item {
    firstname?: string;
    email?: string;
    lastname?: string;
}
