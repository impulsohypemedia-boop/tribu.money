import { describe, expect, it } from 'vitest'
import { readAuthFragment } from './account'

describe('readAuthFragment', () => {
    it('finds the access token Supabase sends back after Google', () => {
        expect(readAuthFragment('#access_token=abc.def&expires_in=3600&token_type=bearer')).toEqual({
            accessToken: 'abc.def',
        })
    })

    it('reports an error description', () => {
        expect(readAuthFragment('#error=access_denied&error_description=Cancelled')).toEqual({ error: 'Cancelled' })
    })

    it('ignores an empty fragment', () => {
        expect(readAuthFragment('')).toBeNull()
    })
})
