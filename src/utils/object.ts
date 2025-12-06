import type { AnyObject } from "../types";
import type { Comparison, ComparisonNumber } from "../types/comparison";


const comparisonNumberFunctions: Record<ComparisonNumber, (num1: number, num2: number) => boolean> = {
    '>': (num1: number, num2: number) => num1 > num2,
    '>=': (num1: number, num2: number) => num1 >= num2,
    '<': (num1: number, num2: number) => num1 < num2,
    '<=': (num1: number, num2: number) => num1 <= num2
}

export function arrayObjectFindAllBy<T extends AnyObject>(
    arrayOfObject: T[],
    findBy: Partial<T>,
    comparison: Comparison = 'strict'
): T[] {
    return arrayOfObject.filter(
        (item: T) => Object.keys(findBy).every(
            (key: string) => {
                if (typeof findBy[key] === 'string') {
                    const itemKey = typeof item[key] === 'string' ? item[key].toLowerCase() : item[key]
                    const findByKey = findBy[key].toLowerCase()

                    return comparison === 'strict' ? itemKey === findByKey : itemKey.includes(findByKey)
                }

                if (typeof findBy[key] === 'number' && comparison !== 'strict' && comparison !== 'partial') {
                    return comparisonNumberFunctions[comparison as ComparisonNumber](item[key], findBy[key])
                }

                return findBy[key] == item[key]
            }
        )
    )
}

export function arrayObjectFindBy<T extends AnyObject>(arrayOfObject: T[], findBy: Partial<T>): T | undefined {
    return arrayOfObject.find((item: T) => Object.keys(findBy).every((key: string) => item[key] === findBy[key]));
}