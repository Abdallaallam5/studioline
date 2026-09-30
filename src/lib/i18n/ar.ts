import { interfaceA } from "./ar/interface-a";
import { interfaceB } from "./ar/interface-b";
import { messages } from "./ar/messages";

/**
 * Arabic dictionary. Keys are the English source strings used in the code;
 * a string without an entry here is shown in English.
 */
export const ar: Record<string, string> = { ...interfaceA, ...interfaceB, ...messages };
