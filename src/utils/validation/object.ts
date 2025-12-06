import { isEmpty } from "."
import type { AnyObject } from "../../types"
import { log } from "../log"

const logStyleOptions = {
    bgColor: '#d8b32b',
    icon: '☢️'
}

/**
 * Compares objects to determine if they are identical
 * @param {object} object1 
 * @param {object} object2 
 * @param {array} excludedKeys - name of properties not to be compared
 * @returns {boolean} areIdentical
 */
export const areIdentical = (object1: AnyObject, object2: AnyObject, excludedKeys?: Set<string>) => {
    const object1Keys = Object.keys(object1)
    const object2Keys = object2 && Object.keys(object2)

    if (
        !object2 || !object2Keys || (!excludedKeys && object1Keys.length !== object2Keys.length)
        || (
            excludedKeys &&
            object1Keys.filter(
                (property: string) => !excludedKeys.has(property)
            ).length !== object2Keys.filter((property: string) => !excludedKeys.has(property)).length
        )
    ) {
        return false
    }

    return Object.keys(object1).reduce((acc, key) => {
        if (acc && (!excludedKeys || !excludedKeys.has(key))) {

            if (!object1[key] || !object2[key]) {
                acc = object1[key] === object2[key]
            } else if (Array.isArray(object1[key])) {
                acc = object1[key].length === object2[key]?.length
                acc && object1[key].forEach((item: any, index: number) => {
                    if (!acc) { return acc }
                    if (typeof item === 'object') {
                        acc = !isEmpty(object2[key][index]) && areIdentical(item, object2[key][index], excludedKeys);
                    } else if (item !== object2[key][index]) {
                        acc = false
                    }
                })
            } else if (typeof object1[key] === 'object') {
                acc = areIdentical(object1[key], object2[key], excludedKeys)
            } else { acc = object1[key] === object2[key] }
        }

        return acc
    }, true)
}