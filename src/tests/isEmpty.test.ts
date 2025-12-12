import { describe, expect, it } from 'vitest'

import { isEmpty } from '../utils/validation'

describe('isEmpty', () => {
    it('" " is empty', async () => {
        expect(isEmpty(" ")).toBeTruthy()
    })

    it('undefined is empty', async () => {
        expect(isEmpty(undefined)).toBeTruthy()
    })

    it('null is empty', async () => {
        expect(isEmpty(null)).toBeTruthy()
    })

    it('[] is empty', async () => {
        expect(isEmpty([])).toBeTruthy()
    })

    it('{} is empty', async () => {
        expect(isEmpty({})).toBeTruthy()
    })

    it('A string is not empty', async () => {
        expect(isEmpty('my string')).toBeFalsy()
    })

    it('A number is not empty', async () => {
        expect(isEmpty(1)).toBeFalsy()
    })

    it('A array with value is not empty', async () => {
        expect(isEmpty(['my string'])).toBeFalsy()
    })

    it('A array with defined property is not empty', async () => {
        expect(isEmpty({ test: 'my string' })).toBeFalsy()
    })

    it('0 is not empty', async () => {
        expect(isEmpty(0)).toBeFalsy()
    })

    it('false is not empty', async () => {
        expect(isEmpty(false)).toBeFalsy()
    })
})